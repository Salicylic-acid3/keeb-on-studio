import {
  addKey,
  addRow,
  copyKeys,
  deleteKeys,
  duplicateKeys,
  keysInRect,
  mirrorKeys,
  moveKeys,
  pasteClip,
  resizeKeys,
  resizedKey,
  snapValue,
  templateProject,
} from "../edit";
import { exportKle, importKle } from "../kle";

const at = (p: ReturnType<typeof importKle>) =>
  p.keys.map((k) => [k.cx, k.cy, k.w, k.angle]);

describe("snapValue", () => {
  it("snaps to the step, or not at all", () => {
    expect(snapValue(1.13, 0.25)).toBe(1.25);
    expect(snapValue(1.13, 0.125)).toBe(1.125);
    expect(snapValue(1.04, 0.0625)).toBe(1.0625);
    expect(snapValue(1.13, null)).toBe(1.13);
  });
});

describe("moveKeys", () => {
  it("moves only the chosen keys", () => {
    const p = importKle([["A", "B"]]);
    const moved = moveKeys(p, [p.keys[1].id], 0.5, 1);
    expect(at(moved)).toEqual([
      [0.5, 0.5, 1, 0],
      [2, 1.5, 1, 0],
    ]);
  });

  it("takes the pivot along only when the whole group moves", () => {
    const p = importKle([[{ r: 10, rx: 3, ry: 3 }, "A", "B"]]);
    const [a, b] = p.keys;
    expect(moveKeys(p, [a.id], 1, 0).groups[0].pivot).toEqual({ x: 3, y: 3 });
    expect(moveKeys(p, [a.id, b.id], 1, 2).groups[0].pivot).toEqual({
      x: 4,
      y: 5,
    });
  });

  it("returns the same layout when nothing moves", () => {
    const p = importKle([["A"]]);
    expect(moveKeys(p, [p.keys[0].id], 0, 0)).toBe(p);
    expect(moveKeys(p, [], 1, 1)).toBe(p);
  });
});

describe("resizing", () => {
  it("keeps the left edge where it is", () => {
    const p = importKle([["A"]]);
    const k = resizedKey(p.keys[0], 2);
    expect([k.cx - k.w / 2, k.cy - k.h / 2, k.w]).toEqual([0, 0, 2]);
  });

  it("grows along a turned key's own direction", () => {
    const p = importKle([[{ r: 90, rx: 0, ry: 0 }, "A"]]);
    const before = p.keys[0];
    const k = resizedKey(before, 2);
    // Turned a quarter, "right" is down.
    expect(k.cx).toBeCloseTo(before.cx);
    expect(k.cy).toBeCloseTo(before.cy + 0.5);
  });

  it("clamps and drops a stepped key's second rectangle", () => {
    const p = importKle([[{ w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, "E"]]);
    const q = resizeKeys(p, [p.keys[0].id], { w: 0.01, h: 1 });
    expect(q.keys[0].w).toBe(0.25);
    expect(q.keys[0].kle).toBeUndefined();
  });
});

describe("adding and removing", () => {
  it("adds next to a key, same size and angle", () => {
    const p = importKle([[{ w: 1.5 }, "A"]]);
    const { project, ids } = addKey(p, p.keys[0].id);
    const k = project.keys.find((x) => x.id === ids[0])!;
    expect([k.cx, k.cy, k.w]).toEqual([2.25, 0.5, 1.5]);
  });

  it("adds along a turned key and into its group", () => {
    const p = importKle([[{ r: 90, rx: 0, ry: 0 }, "A"]]);
    const { project, ids } = addKey(p, p.keys[0].id);
    const k = project.keys.find((x) => x.id === ids[0])!;
    expect(k.cx).toBeCloseTo(p.keys[0].cx);
    expect(k.cy).toBeCloseTo(p.keys[0].cy + 1);
    expect(k.groupId).toBe(p.keys[0].groupId);
    // Still one KLE cluster on the way out.
    expect(exportKle(project, "legend")).toEqual([
      [{ r: 90, rx: 0, ry: 0 }, "A", ""],
    ]);
  });

  it("starts a new bottom row without an anchor", () => {
    const p = importKle([["A", "B"], ["C"]]);
    const one = addKey(p, null);
    const k = one.project.keys[one.project.keys.length - 1];
    expect([k.cx, k.cy]).toEqual([0.5, 2.5]);
    expect(addKey(templateProject("empty"), null).project.keys[0].cx).toBe(0.5);
    expect(addRow(p, 3).ids).toHaveLength(3);
  });

  it("deletes keys and the groups left empty", () => {
    const p = importKle([["A"], [{ r: 10, rx: 3, ry: 3 }, "B"]]);
    const q = deleteKeys(p, [p.keys[1].id]);
    expect(q.keys).toHaveLength(1);
    expect(q.groups).toEqual([]);
  });
});

describe("copies", () => {
  it("duplicates right under the keys", () => {
    const p = importKle([["A", "B"]]);
    const { project, ids } = duplicateKeys(
      p,
      p.keys.map((k) => k.id),
    );
    expect(ids).toHaveLength(2);
    expect(at(project).slice(2)).toEqual([
      [0.5, 1.5, 1, 0],
      [1.5, 1.5, 1, 0],
    ]);
  });

  it("gives a pasted group its own pivot", () => {
    const p = importKle([[{ r: 10, rx: 3, ry: 3 }, "A"]]);
    const { project } = pasteClip(p, copyKeys(p, [p.keys[0].id]), 2, 0);
    expect(project.groups).toHaveLength(2);
    expect(project.groups[1].pivot).toEqual({ x: 5, y: 3 });
    expect(project.keys[1].groupId).toBe(project.groups[1].id);
    expect(project.keys[1].legends).not.toBe(project.keys[0].legends);
  });

  it("mirrors to the right with the angles flipped", () => {
    const p = importKle([
      ["A", "B"],
      [{ r: 15, rx: 2, ry: 1 }, "T"],
    ]);
    const { project, ids } = mirrorKeys(
      p,
      p.keys.map((k) => k.id),
    );
    const added = project.keys.filter((k) => ids.includes(k.id));
    const [a, b, t] = added;
    expect(a.cx - b.cx).toBe(1); // order is reversed
    expect(a.cy).toBe(0.5);
    expect(t.angle).toBe(-15);
    const pivot = project.groups[1].pivot;
    // The mirrored key sits as far left of its pivot as the original sat right.
    expect(pivot.x - t.cx).toBeCloseTo(p.keys[2].cx - 2);
    // And the mirror image is to the right of the original.
    const leftMax = Math.max(...p.keys.map((k) => k.cx));
    const rightMin = Math.min(...added.map((k) => k.cx));
    expect(rightMin).toBeGreaterThan(leftMax);
  });
});

describe("keysInRect", () => {
  it("finds the keys a rectangle touches", () => {
    const p = importKle([["A", "B", "C"]]);
    const ids = keysInRect(p, { minX: 0.9, minY: 0.2, maxX: 1.5, maxY: 0.4 });
    expect(ids).toEqual([p.keys[0].id, p.keys[1].id]);
  });
});

describe("templates", () => {
  it("has the sizes it says", () => {
    expect(templateProject("ortho40").keys).toHaveLength(48);
    expect(templateProject("ansi60").keys).toHaveLength(61);
    expect(templateProject("split36").keys).toHaveLength(42);
    expect(templateProject("empty").keys).toHaveLength(0);
  });
});
