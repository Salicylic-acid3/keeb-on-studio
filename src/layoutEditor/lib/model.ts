/**
 * The layout editor's own model.
 *
 * Keyboard Layout Editor stores each key relative to the key before it and
 * to a rotation origin, so moving the origin moves the key. Here every key
 * carries its own centre and angle in absolute units (1 = 1u), and a
 * rotation group only remembers the pivot the keys were turned around.
 * KLE's r / rx / ry are worked out when exporting (see kle.ts).
 */

/** Number of legend positions on a KLE key (9 on top, 3 on the front). */
export const LEGEND_SLOTS = 12;

/** KLE properties the editor does not edit but keeps for the way back. */
export interface KleExtras {
  color?: string;
  textColor?: string;
  profile?: string;
  decal?: boolean;
  ghost?: boolean;
  nub?: boolean;
  stepped?: boolean;
  /** Second rectangle of a stepped key (ISO / JIS Enter), from the primary's top left. */
  x2?: number;
  y2?: number;
  w2?: number;
  h2?: number;
}

export interface LayoutKey {
  id: string;
  /** Centre of the primary rectangle, in u. */
  cx: number;
  cy: number;
  /** Size of the primary rectangle, in u. */
  w: number;
  h: number;
  /** Degrees, clockwise. */
  angle: number;
  /** Rotation group this key was turned with, if any. */
  groupId?: string;
  /** Legends by KLE position (0 = top left ... 8 = bottom right, 9-11 front). */
  legends: string[];
  matrix?: { row: number; col: number };
  /**
   * The key takes a convex cap (thumb keys, mostly). A convex cap is a
   * different shape from a plain one of the same size, so the keycap check
   * only ever puts convex caps here, and nowhere else.
   */
  convex?: boolean;
  /** VIA / Vial layout option this key belongs to; kept, not edited yet. */
  option?: { index: number; choice: number };
  kle?: KleExtras;
}

export interface RotationGroup {
  id: string;
  /** The pivot the group's keys turn around, in u. */
  pivot: { x: number; y: number };
}

export interface LayoutProject {
  name: string;
  keys: LayoutKey[];
  groups: RotationGroup[];
}

/**
 * Which of a key's two sets of text the canvas shows and an export carries;
 * "both" is the legends with the matrix position small beside them.
 */
export type LayoutLayer = "legend" | "matrix" | "both";

export interface Point {
  x: number;
  y: number;
}

export function emptyProject(): LayoutProject {
  return { name: "", keys: [], groups: [] };
}

/** Rotate `p` around `origin` by `degrees`, clockwise on screen (y down). */
export function rotatePoint(p: Point, origin: Point, degrees: number): Point {
  if (degrees === 0) return { x: p.x, y: p.y };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** The four corners of a key's primary rectangle, in u, as drawn. */
export function keyCorners(key: LayoutKey): Point[] {
  const centre = { x: key.cx, y: key.cy };
  const hw = key.w / 2;
  const hh = key.h / 2;
  return [
    { x: key.cx - hw, y: key.cy - hh },
    { x: key.cx + hw, y: key.cy - hh },
    { x: key.cx + hw, y: key.cy + hh },
    { x: key.cx - hw, y: key.cy + hh },
  ].map((p) => rotatePoint(p, centre, key.angle));
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The box around every key as drawn, or null for an empty layout. */
export function projectBounds(project: LayoutProject): Bounds | null {
  if (project.keys.length === 0) return null;
  const b: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const key of project.keys) {
    for (const p of keyCorners(key)) {
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
  }
  return b;
}
