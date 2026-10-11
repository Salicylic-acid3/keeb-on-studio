import { defaultPivot, moveKeys, rotateKeys } from "../edit";
import {
  findOverlaps,
  limitMove,
  limitRotation,
  nearestPoint,
  normalizeAngle,
  overlapVector,
  pivotTargets,
  separationFor,
  snapMoveToCorners,
  touchingCorners,
} from "../geometry";
import { exportKle, importKle } from "../kle";
import { sampleProject } from "../sample";

describe("normalizeAngle", () => {
  it("stays within half a turn either way", () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-0)).toBe(0);
  });
});

describe("overlap", () => {
  it("does not count keys that only touch", () => {
    const p = importKle([["A", "B"]]);
    expect(overlapVector(p.keys[0], p.keys[1])).toBeNull();
    expect(findOverlaps(p.keys).size).toBe(0);
    expect(findOverlaps(sampleProject().keys).size).toBe(0);
  });

  it("gives the shortest way out", () => {
    const p = importKle([["A", { x: -0.25 }, "B"]]);
    const v = overlapVector(p.keys[1], p.keys[0])!;
    expect(v.x).toBeCloseTo(0.25);
    expect(v.y).toBeCloseTo(0);
    expect(findOverlaps(p.keys)).toEqual(new Set([p.keys[0].id, p.keys[1].id]));
  });

  it("sees a turned key cutting a corner", () => {
    const p = importKle([["A"], [{ r: 45, rx: 1.2, ry: 0.2 }, "B"]]);
    expect(overlapVector(p.keys[0], p.keys[1])).not.toBeNull();
    const far = importKle([["A"], [{ r: 45, rx: 1.8, ry: 0.2 }, "B"]]);
    expect(overlapVector(far.keys[0], far.keys[1])).toBeNull();
  });

  it("ignores decals", () => {
    const p = importKle([["A", { x: -0.5, d: true }, "label"]]);
    expect(findOverlaps(p.keys).size).toBe(0);
  });
});

describe("stopping at other keys", () => {
  const p = importKle([["A", { x: 1 }, "B"]]);
  const a = p.keys[0];

  it("lets a move through when the way is clear", () => {
    expect(limitMove(p, [a.id], 0.5, 0)).toEqual({ x: 0.5, y: 0 });
    expect(limitMove(p, [a.id], 0, 3)).toEqual({ x: 0, y: 3 });
  });

  it("stops a move at the key in the way", () => {
    expect(limitMove(p, [a.id], 1.5, 0)).toEqual({ x: 1, y: 0 });
    // Already touching: not even a hair further.
    const flush = importKle([["A", "B"]]);
    expect(limitMove(flush, [flush.keys[0].id], 0.5, 0)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("lets an already overlapping key out", () => {
    const stuck = moveKeys(p, [a.id], 1.5, 0);
    expect(limitMove(stuck, [a.id], 2, 0)).toEqual({ x: 2, y: 0 });
  });

  it("stops a turn before it hits", () => {
    const q = importKle([["A"], [{ y: 0.1 }, "B"]]);
    const allowed = limitRotation(q, [q.keys[0].id], { x: 0, y: 0 }, 30);
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThan(30);
    const turned = rotateKeys(q, [q.keys[0].id], { x: 0, y: 0 }, allowed);
    expect(findOverlaps(turned.keys).size).toBe(0);
  });
});

describe("snapping and separating", () => {
  it("lands a corner on a nearby corner", () => {
    const p = importKle([["A", { x: 1 }, "B"]]);
    const v = snapMoveToCorners(p, [p.keys[1].id], -0.95, 0.03, 0.15);
    expect(v).toEqual({ x: -1, y: 0 });
    expect(snapMoveToCorners(p, [p.keys[1].id], -0.5, 0, 0.15)).toEqual({
      x: -0.5,
      y: 0,
    });
  });

  it("pushes overlapping keys just clear", () => {
    const p = importKle([["A", { x: -0.25 }, "B"]]);
    const v = separationFor(p, [p.keys[1].id]);
    const q = moveKeys(p, [p.keys[1].id], v.x, v.y);
    expect(findOverlaps(q.keys).size).toBe(0);
    expect(Math.hypot(v.x, v.y)).toBeLessThan(0.26);
    expect(separationFor(q, [q.keys[1].id])).toEqual({ x: 0, y: 0 });
  });
});

describe("pivots", () => {
  it("finds the corners shared with a neighbour", () => {
    const p = importKle([["A", "B"]]);
    expect(touchingCorners(p, [p.keys[1].id])).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    const apart = importKle([["A", { x: 1 }, "B"]]);
    expect(touchingCorners(apart, [apart.keys[1].id])).toEqual([]);
  });

  it("offers centres, corners, edge midpoints and neighbours' corners", () => {
    const p = importKle([["A", { x: 1 }, "B"]]);
    const targets = pivotTargets(p, [p.keys[0].id]);
    expect(targets).toHaveLength(9 + 4);
    expect(nearestPoint({ x: 0.52, y: 0.49 }, targets, 0.2)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(nearestPoint({ x: 5, y: 5 }, targets, 0.2)).toBeNull();
  });

  it("defaults to the group's pivot, else the middle of the keys", () => {
    const p = importKle([
      ["A", "B"],
      [{ r: 10, rx: 4, ry: 2 }, "C"],
    ]);
    expect(defaultPivot(p, [p.keys[2]])).toEqual({ x: 4, y: 2 });
    expect(defaultPivot(p, [p.keys[0], p.keys[1]])).toEqual({ x: 1, y: 0.5 });
    expect(defaultPivot(p, [])).toBeNull();
  });
});

describe("rotateKeys", () => {
  it("turns keys around the pivot into one KLE cluster", () => {
    const p = importKle([["A", "B", "C"]]);
    const q = rotateKeys(p, [p.keys[1].id, p.keys[2].id], { x: 1, y: 1 }, 15);
    expect(q.keys[0].angle).toBe(0);
    expect(q.keys[1].angle).toBe(15);
    expect(q.groups).toHaveLength(1);
    expect(q.keys[1].groupId).toBe(q.keys[2].groupId);
    expect(exportKle(q, "legend")).toEqual([
      ["A"],
      [{ r: 15, rx: 1, ry: 1, y: -1 }, "B", "C"],
    ]);
  });

  it("keeps a key that shares the pivot corner flush with its neighbour", () => {
    const p = importKle([["A", "B"]]);
    const q = rotateKeys(p, [p.keys[1].id], { x: 1, y: 1 }, 20);
    expect(findOverlaps(q.keys).size).toBe(0);
    const shared = touchingCorners(q, [q.keys[1].id]);
    expect(shared).toHaveLength(1);
    expect(shared[0].x).toBeCloseTo(1);
    expect(shared[0].y).toBeCloseTo(1);
  });

  it("drops the group when turned back to level", () => {
    const p = importKle([["A"]]);
    const there = rotateKeys(p, [p.keys[0].id], { x: 0, y: 0 }, 30);
    const back = rotateKeys(there, [p.keys[0].id], { x: 0, y: 0 }, -30);
    expect(back.keys[0].angle).toBe(0);
    expect(back.keys[0].groupId).toBeUndefined();
    expect(back.groups).toEqual([]);
    expect(back.keys[0].cx).toBeCloseTo(0.5);
  });

  it("adds to an angle already there", () => {
    const p = importKle([[{ r: 10, rx: 0, ry: 0 }, "A"]]);
    const q = rotateKeys(p, [p.keys[0].id], { x: 0, y: 0 }, 5);
    expect(q.keys[0].angle).toBe(15);
    expect(q.groups).toHaveLength(1);
  });
});
