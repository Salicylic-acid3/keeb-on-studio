/**
 * Where keys are in relation to each other: overlap, touching corners, and
 * the snapping and stopping the canvas does while keys are dragged or
 * turned. Keys are treated as their primary rectangle.
 */
import {
  keyCorners,
  rotatePoint,
  type LayoutKey,
  type LayoutProject,
  type Point,
} from "./model";

/** Keys closer than this, in u, count as touching rather than overlapping. */
const TOUCH_EPS = 0.004;
/** Corners closer than this, in u, are the same corner. */
const SAME_POINT = 0.02;

/** Degrees kept to four decimals, in (-180, 180]. */
export function normalizeAngle(degrees: number): number {
  let a = degrees % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  a = Math.round(a * 1e4) / 1e4;
  return Object.is(a, -0) ? 0 : a;
}

/** The key turned by `delta` degrees around `pivot`. */
export function rotatedKey(
  key: LayoutKey,
  pivot: Point,
  delta: number,
): LayoutKey {
  if (delta === 0) return key;
  const c = rotatePoint({ x: key.cx, y: key.cy }, pivot, delta);
  return {
    ...key,
    cx: Math.round(c.x * 1e6) / 1e6,
    cy: Math.round(c.y * 1e6) / 1e6,
    angle: normalizeAngle(key.angle + delta),
  };
}

function axesOf(corners: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < 2; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    axes.push({ x: (b.x - a.x) / len, y: (b.y - a.y) / len });
  }
  return axes;
}

function span(corners: Point[], axis: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of corners) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/**
 * How far `a` has to move to stop overlapping `b` (the shortest way out),
 * or null when they do not overlap. Touching edges do not count.
 */
export function overlapVector(a: LayoutKey, b: LayoutKey): Point | null {
  // Cheap rejection first: centres further apart than the two half-diagonals.
  const reach = (Math.hypot(a.w, a.h) + Math.hypot(b.w, b.h)) / 2;
  if (Math.hypot(a.cx - b.cx, a.cy - b.cy) >= reach) return null;

  const ca = keyCorners(a);
  const cb = keyCorners(b);
  let best: Point | null = null;
  let bestDepth = Infinity;
  for (const axis of [...axesOf(ca), ...axesOf(cb)]) {
    const [minA, maxA] = span(ca, axis);
    const [minB, maxB] = span(cb, axis);
    const depth = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (depth <= TOUCH_EPS) return null;
    if (depth < bestDepth) {
      bestDepth = depth;
      const side = (a.cx - b.cx) * axis.x + (a.cy - b.cy) * axis.y < 0 ? -1 : 1;
      best = { x: axis.x * depth * side, y: axis.y * depth * side };
    }
  }
  return best;
}

/** Ids of every key that overlaps another. */
export function findOverlaps(keys: LayoutKey[]): Set<string> {
  const hit = new Set<string>();
  const solid = keys.filter((k) => !k.kle?.decal);
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (overlapVector(solid[i], solid[j])) {
        hit.add(solid[i].id);
        hit.add(solid[j].id);
      }
    }
  }
  return hit;
}

/** Whether any of `moving` overlaps any of `others`. */
export function collides(moving: LayoutKey[], others: LayoutKey[]): boolean {
  for (const a of moving) {
    if (a.kle?.decal) continue;
    for (const b of others) {
      if (b.kle?.decal) continue;
      if (overlapVector(a, b)) return true;
    }
  }
  return false;
}

function split(project: LayoutProject, ids: Iterable<string>) {
  const set = new Set(ids);
  return {
    moving: project.keys.filter((k) => set.has(k.id)),
    others: project.keys.filter((k) => !set.has(k.id)),
  };
}

const shifted = (keys: LayoutKey[], dx: number, dy: number) =>
  keys.map((k) => ({ ...k, cx: k.cx + dx, cy: k.cy + dy }));

/**
 * As much of the move (dx, dy) as can be made before the keys run into
 * another key. Keys that already overlap something are let through, so a
 * stuck key can always be dragged out.
 */
export function limitMove(
  project: LayoutProject,
  ids: Iterable<string>,
  dx: number,
  dy: number,
): Point {
  const { moving, others } = split(project, ids);
  if (collides(moving, others) || !collides(shifted(moving, dx, dy), others)) {
    return { x: dx, y: dy };
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (collides(shifted(moving, dx * mid, dy * mid), others)) hi = mid;
    else lo = mid;
  }
  // Whole hundredths of a u, on the safe side: keys that already touch do
  // not creep into each other by the touching tolerance.
  const whole = (v: number) => Math.trunc(v * lo * 100) / 100;
  return { x: whole(dx), y: whole(dy) };
}

/** As much of the turn `delta` (degrees) as can be made before a collision. */
export function limitRotation(
  project: LayoutProject,
  ids: Iterable<string>,
  pivot: Point,
  delta: number,
): number {
  const { moving, others } = split(project, ids);
  const turned = (d: number) => moving.map((k) => rotatedKey(k, pivot, d));
  if (collides(moving, others) || !collides(turned(delta), others)) {
    return delta;
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (collides(turned(delta * mid), others)) hi = mid;
    else lo = mid;
  }
  // Whole tenths of a degree, on the safe side.
  const safe = Math.floor(Math.abs(delta * lo) * 10) / 10;
  return delta < 0 ? -safe : safe;
}

/**
 * The move (dx, dy) nudged so that a corner of the moving keys lands
 * exactly on a corner of another key, when one is within `tolerance` u.
 * Keys that share corners sit flush, at whatever angle they are.
 */
export function snapMoveToCorners(
  project: LayoutProject,
  ids: Iterable<string>,
  dx: number,
  dy: number,
  tolerance: number,
): Point {
  const { moving, others } = split(project, ids);
  let best: Point | null = null;
  let bestDist = tolerance;
  const targets = others.flatMap(keyCorners);
  for (const key of moving) {
    for (const c of keyCorners(key)) {
      const px = c.x + dx;
      const py = c.y + dy;
      for (const t of targets) {
        const d = Math.hypot(t.x - px, t.y - py);
        if (d < bestDist) {
          bestDist = d;
          best = { x: t.x - c.x, y: t.y - c.y };
        }
      }
    }
  }
  return best ?? { x: dx, y: dy };
}

/**
 * Move the keys the shortest way out of whatever they overlap, as one
 * body. Gives up after a few rounds if they are boxed in.
 */
export function separationFor(
  project: LayoutProject,
  ids: Iterable<string>,
): Point {
  const { moving, others } = split(project, ids);
  let dx = 0;
  let dy = 0;
  for (let round = 0; round < 24; round++) {
    const now = shifted(moving, dx, dy);
    let push: Point | null = null;
    let depth = 0;
    for (const a of now) {
      if (a.kle?.decal) continue;
      for (const b of others) {
        if (b.kle?.decal) continue;
        const v = overlapVector(a, b);
        if (v && Math.hypot(v.x, v.y) > depth) {
          depth = Math.hypot(v.x, v.y);
          push = v;
        }
      }
    }
    if (!push) break;
    // A hair more than needed, so rounding does not leave them overlapping.
    dx += push.x * 1.001;
    dy += push.y * 1.001;
  }
  return { x: Math.round(dx * 1e4) / 1e4, y: Math.round(dy * 1e4) / 1e4 };
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < SAME_POINT)) {
      out.push(p);
    }
  }
  return out;
}

/** Corners the chosen keys share with a key outside the choice. */
export function touchingCorners(
  project: LayoutProject,
  ids: Iterable<string>,
): Point[] {
  const { moving, others } = split(project, ids);
  const targets = others.flatMap(keyCorners);
  const found: Point[] = [];
  for (const key of moving) {
    for (const c of keyCorners(key)) {
      if (targets.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < SAME_POINT)) {
        found.push(c);
      }
    }
  }
  return dedupe(found);
}

/**
 * Spots a pivot snaps to: centres, corners and edge midpoints of the chosen
 * keys, and the corners of every other key.
 */
export function pivotTargets(
  project: LayoutProject,
  ids: Iterable<string>,
): Point[] {
  const { moving, others } = split(project, ids);
  const points: Point[] = [];
  for (const key of moving) {
    const corners = keyCorners(key);
    points.push({ x: key.cx, y: key.cy }, ...corners);
    corners.forEach((c, i) => {
      const n = corners[(i + 1) % corners.length];
      points.push({ x: (c.x + n.x) / 2, y: (c.y + n.y) / 2 });
    });
  }
  points.push(...others.flatMap(keyCorners));
  return dedupe(points);
}

/** The target within `tolerance` u of `p` that is nearest, if any. */
export function nearestPoint(
  p: Point,
  targets: Point[],
  tolerance: number,
): Point | null {
  let best: Point | null = null;
  let bestDist = tolerance;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}
