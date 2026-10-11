/**
 * Every change the editor makes to a layout, as plain functions from one
 * layout to the next, so undo is just "the layout before".
 */
import { rotatedKey } from "./geometry";
import { importKle, newId } from "./kle";
import {
  keyCorners,
  rotatePoint,
  type Bounds,
  type LayoutKey,
  type LayoutProject,
  type Point,
  type RotationGroup,
} from "./model";

/** Grid steps the editor offers, in u. The first is the default. */
export const SNAP_STEPS = [0.25, 0.125, 0.0625] as const;
/** Key widths offered as one-tap choices, in u. */
export const SIZE_PRESETS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 3, 6.25, 7];
export const MIN_KEY_SIZE = 0.25;
export const MAX_KEY_SIZE = 20;

function tidy(value: number): number {
  const r = Math.round(value * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

/** `value` on the grid, or as it is when snapping is off (`step` null). */
export function snapValue(value: number, step: number | null): number {
  if (!step) return tidy(value);
  return tidy(Math.round(value / step) * step);
}

function clampSize(value: number): number {
  return Math.min(MAX_KEY_SIZE, Math.max(MIN_KEY_SIZE, value));
}

/** The box around the given keys as drawn, or null when there are none. */
export function keysBounds(keys: LayoutKey[]): Bounds | null {
  if (keys.length === 0) return null;
  const b: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const key of keys) {
    for (const p of keyCorners(key)) {
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
  }
  return b;
}

/** Ids of the keys whose drawn box touches the rectangle (in u). */
export function keysInRect(project: LayoutProject, rect: Bounds): string[] {
  return project.keys
    .filter((key) => {
      const b = keysBounds([key])!;
      return (
        b.maxX > rect.minX &&
        b.minX < rect.maxX &&
        b.maxY > rect.minY &&
        b.minY < rect.maxY
      );
    })
    .map((key) => key.id);
}

/** Drop rotation groups no key belongs to any more. */
function pruneGroups(project: LayoutProject): LayoutProject {
  const used = new Set(project.keys.map((k) => k.groupId).filter(Boolean));
  if (project.groups.every((g) => used.has(g.id))) return project;
  return { ...project, groups: project.groups.filter((g) => used.has(g.id)) };
}

/**
 * Move keys by (dx, dy) u. A rotation group's pivot goes along when every
 * key of the group moves, so the group still turns around the same spot
 * relative to its keys.
 */
export function moveKeys(
  project: LayoutProject,
  ids: Iterable<string>,
  dx: number,
  dy: number,
): LayoutProject {
  const moving = new Set(ids);
  if (moving.size === 0 || (dx === 0 && dy === 0)) return project;
  const keys = project.keys.map((k) =>
    moving.has(k.id) ? { ...k, cx: tidy(k.cx + dx), cy: tidy(k.cy + dy) } : k,
  );
  const groups = project.groups.map((g) => {
    const members = project.keys.filter((k) => k.groupId === g.id);
    const whole = members.length > 0 && members.every((k) => moving.has(k.id));
    return whole
      ? { ...g, pivot: { x: tidy(g.pivot.x + dx), y: tidy(g.pivot.y + dy) } }
      : g;
  });
  return { ...project, keys, groups };
}

/**
 * Turn keys by `delta` degrees around `pivot`. The turned keys become a
 * rotation group of their own around that pivot (one per resulting angle,
 * which is what a KLE cluster is); keys left at 0 degrees belong to none.
 */
export function rotateKeys(
  project: LayoutProject,
  ids: Iterable<string>,
  pivot: Point,
  delta: number,
): LayoutProject {
  const target = new Set(ids);
  if (target.size === 0 || delta === 0) return project;
  const origin = { x: tidy(pivot.x), y: tidy(pivot.y) };
  const groups: RotationGroup[] = [];
  const byAngle = new Map<number, string>();
  const keys = project.keys.map((k) => {
    if (!target.has(k.id)) return k;
    const { groupId: _old, ...turned } = rotatedKey(k, origin, delta);
    void _old;
    if (turned.angle === 0) return turned;
    let groupId = byAngle.get(turned.angle);
    if (!groupId) {
      groupId = newId("g");
      byAngle.set(turned.angle, groupId);
      groups.push({ id: groupId, pivot: origin });
    }
    return { ...turned, groupId };
  });
  return pruneGroups({
    ...project,
    keys,
    groups: [...project.groups, ...groups],
  });
}

/**
 * Where the keys turn around until someone says otherwise: their group's
 * pivot when they are one whole-angle group, else the middle of their box.
 */
export function defaultPivot(
  project: LayoutProject,
  keys: LayoutKey[],
): Point | null {
  if (keys.length === 0) return null;
  const groupId = keys[0].groupId;
  if (groupId && keys.every((k) => k.groupId === groupId)) {
    const group = project.groups.find((g) => g.id === groupId);
    if (group) return group.pivot;
  }
  const b = keysBounds(keys)!;
  return { x: tidy((b.minX + b.maxX) / 2), y: tidy((b.minY + b.maxY) / 2) };
}

/**
 * The key at a new size, its top-left corner (in its own turned frame)
 * staying where it is, the way dragging the right edge feels.
 */
export function resizedKey(key: LayoutKey, w: number, h = key.h): LayoutKey {
  const nw = clampSize(w);
  const nh = clampSize(h);
  if (nw === key.w && nh === key.h) return key;
  const shift = rotatePoint(
    { x: (nw - key.w) / 2, y: (nh - key.h) / 2 },
    { x: 0, y: 0 },
    key.angle,
  );
  const next: LayoutKey = {
    ...key,
    w: nw,
    h: nh,
    cx: tidy(key.cx + shift.x),
    cy: tidy(key.cy + shift.y),
  };
  if (key.kle) {
    // A stepped key's second rectangle no longer fits a new size.
    const { x2: _x2, y2: _y2, w2: _w2, h2: _h2, ...rest } = key.kle;
    void _x2;
    void _y2;
    void _w2;
    void _h2;
    if (Object.keys(rest).length > 0) next.kle = rest;
    else delete next.kle;
  }
  return next;
}

export function resizeKeys(
  project: LayoutProject,
  ids: Iterable<string>,
  size: { w?: number; h?: number },
): LayoutProject {
  const target = new Set(ids);
  let changed = false;
  const keys = project.keys.map((k) => {
    if (!target.has(k.id)) return k;
    const next = resizedKey(k, size.w ?? k.w, size.h ?? k.h);
    if (next !== k) changed = true;
    return next;
  });
  return changed ? { ...project, keys } : project;
}

export function deleteKeys(
  project: LayoutProject,
  ids: Iterable<string>,
): LayoutProject {
  const gone = new Set(ids);
  if (gone.size === 0) return project;
  return pruneGroups({
    ...project,
    keys: project.keys.filter((k) => !gone.has(k.id)),
  });
}

/**
 * A key's two everyday legends. KLE prints a lone legend top left; with a
 * shifted legend too, the shifted one goes on top and the main one moves to
 * the bottom left ("!" over "1").
 */
export function mainAndSub(key: LayoutKey): { main: string; sub: string } {
  return key.legends[6]
    ? { main: key.legends[6], sub: key.legends[0] ?? "" }
    : { main: key.legends[0] ?? "", sub: "" };
}

function withMainAndSub(key: LayoutKey, main: string, sub: string): LayoutKey {
  const legends = key.legends.slice();
  while (legends.length < 12) legends.push("");
  if (sub) {
    legends[0] = sub;
    legends[6] = main;
  } else {
    legends[0] = main;
    legends[6] = "";
  }
  return { ...key, legends };
}

function mapKey(
  project: LayoutProject,
  id: string,
  change: (key: LayoutKey) => LayoutKey,
): LayoutProject {
  let changed = false;
  const keys = project.keys.map((k) => {
    if (k.id !== id) return k;
    const next = change(k);
    if (next !== k) changed = true;
    return next;
  });
  return changed ? { ...project, keys } : project;
}

export function setMainAndSub(
  project: LayoutProject,
  id: string,
  main: string,
  sub: string,
): LayoutProject {
  return mapKey(project, id, (k) => {
    const now = mainAndSub(k);
    return now.main === main && now.sub === sub
      ? k
      : withMainAndSub(k, main, sub);
  });
}

/** One of the twelve KLE legend positions, set directly. */
export function setLegendSlot(
  project: LayoutProject,
  id: string,
  slot: number,
  text: string,
): LayoutProject {
  return mapKey(project, id, (k) => {
    if ((k.legends[slot] ?? "") === text) return k;
    const legends = k.legends.slice();
    while (legends.length < 12) legends.push("");
    legends[slot] = text;
    return { ...k, legends };
  });
}

/** Pour legends into keys, one each in the order given. */
export function fillLegends(
  project: LayoutProject,
  ids: string[],
  labels: Array<{ main: string; sub?: string }>,
): LayoutProject {
  const byId = new Map(ids.map((id, i) => [id, labels[i]]));
  return {
    ...project,
    keys: project.keys.map((k) => {
      const label = byId.get(k.id);
      return label ? withMainAndSub(k, label.main, label.sub ?? "") : k;
    }),
  };
}

/** Give keys matrix positions; null takes a key's position away. */
export function setMatrix(
  project: LayoutProject,
  positions: Map<string, { row: number; col: number } | null>,
): LayoutProject {
  let changed = false;
  const keys = project.keys.map((k) => {
    if (!positions.has(k.id)) return k;
    const next = positions.get(k.id) ?? null;
    if (!next) {
      if (!k.matrix) return k;
      changed = true;
      const { matrix: _gone, ...rest } = k;
      void _gone;
      return rest;
    }
    if (k.matrix && k.matrix.row === next.row && k.matrix.col === next.col) {
      return k;
    }
    changed = true;
    return { ...k, matrix: { row: next.row, col: next.col } };
  });
  return changed ? { ...project, keys } : project;
}

/**
 * The key to select once these are deleted: the one to their left on the
 * same row, so pressing Delete again and again eats a row leftwards. With
 * nothing to the left, the nearest key that remains.
 */
export function keyAfterDelete(
  project: LayoutProject,
  ids: Iterable<string>,
): string | null {
  const gone = new Set(ids);
  const removed = project.keys.filter((k) => gone.has(k.id));
  const rest = project.keys.filter((k) => !gone.has(k.id));
  if (removed.length === 0 || rest.length === 0) return null;
  // Work from the leftmost deleted key.
  const from = removed.reduce((a, b) => (b.cx < a.cx ? b : a));
  const sameRow = rest.filter(
    (k) => k.cx < from.cx && Math.abs(k.cy - from.cy) < from.h / 2,
  );
  const pool = sameRow.length > 0 ? sameRow : rest;
  const dist = (k: LayoutKey) => Math.hypot(k.cx - from.cx, k.cy - from.cy);
  return pool.reduce((a, b) => (dist(b) < dist(a) ? b : a)).id;
}

/** Mark keys as taking convex caps, or as plain again. */
export function setConvex(
  project: LayoutProject,
  ids: Iterable<string>,
  convex: boolean,
): LayoutProject {
  const target = new Set(ids);
  let changed = false;
  const keys = project.keys.map((k) => {
    if (!target.has(k.id) || Boolean(k.convex) === convex) return k;
    changed = true;
    const { convex: _was, ...rest } = k;
    void _was;
    return convex ? { ...rest, convex: true } : rest;
  });
  return changed ? { ...project, keys } : project;
}

/** The ISO / JIS Enter: 1.25u x 2u with a 1.5u top row reaching left. */
const ISO_ENTER = { w: 1.25, h: 2, x2: -0.25, y2: 0, w2: 1.5, h2: 1 };

export function isIsoEnter(key: LayoutKey): boolean {
  return (
    key.w === ISO_ENTER.w &&
    key.h === ISO_ENTER.h &&
    key.kle?.x2 === ISO_ENTER.x2 &&
    key.kle?.w2 === ISO_ENTER.w2 &&
    key.kle?.h2 === ISO_ENTER.h2
  );
}

/**
 * Turn keys into ISO / JIS Enters. The top-right corner stays put: an Enter
 * sits at the right end of its rows, so that is the corner already in place.
 */
export function makeIsoEnter(
  project: LayoutProject,
  ids: Iterable<string>,
): LayoutProject {
  const target = new Set(ids);
  const keys = project.keys.map((k) => {
    if (!target.has(k.id) || isIsoEnter(k)) return k;
    const sized = resizedKey(k, ISO_ENTER.w, ISO_ENTER.h);
    // resizedKey keeps the top left; slide so the top right is kept instead.
    const slide = rotatePoint(
      { x: k.w - ISO_ENTER.w, y: 0 },
      { x: 0, y: 0 },
      k.angle,
    );
    return {
      ...sized,
      cx: tidy(sized.cx + slide.x),
      cy: tidy(sized.cy + slide.y),
      kle: {
        ...sized.kle,
        x2: ISO_ENTER.x2,
        y2: ISO_ENTER.y2,
        w2: ISO_ENTER.w2,
        h2: ISO_ENTER.h2,
      },
    };
  });
  return { ...project, keys };
}

function blankKey(cx: number, cy: number, w = 1, h = 1): LayoutKey {
  return {
    id: newId("k"),
    cx: tidy(cx),
    cy: tidy(cy),
    w,
    h,
    angle: 0,
    legends: new Array<string>(12).fill(""),
  };
}

export interface Added {
  project: LayoutProject;
  /** The keys that were added, to select them. */
  ids: string[];
}

/** Where a new row starts: under everything, at the left edge. */
function nextRowOrigin(project: LayoutProject): { x: number; y: number } {
  const b = keysBounds(project.keys);
  if (!b) return { x: 0, y: 0 };
  return { x: snapValue(b.minX, 0.25), y: Math.ceil(b.maxY * 4 - 1e-6) / 4 };
}

/**
 * One more key: to the right of `anchorId`, same size and angle, in its
 * rotation group; with no anchor, at the left of a new bottom row.
 */
export function addKey(project: LayoutProject, anchorId: string | null): Added {
  const anchor = anchorId
    ? project.keys.find((k) => k.id === anchorId)
    : undefined;
  let key: LayoutKey;
  if (anchor) {
    const centre = rotatePoint(
      { x: anchor.cx + anchor.w, y: anchor.cy },
      { x: anchor.cx, y: anchor.cy },
      anchor.angle,
    );
    key = {
      ...blankKey(centre.x, centre.y, anchor.w, anchor.h),
      angle: anchor.angle,
      ...(anchor.groupId ? { groupId: anchor.groupId } : {}),
    };
  } else {
    const o = nextRowOrigin(project);
    key = blankKey(o.x + 0.5, o.y + 0.5);
  }
  return {
    project: { ...project, keys: [...project.keys, key] },
    ids: [key.id],
  };
}

/** A row of `count` 1u keys under everything. */
export function addRow(project: LayoutProject, count: number): Added {
  const o = nextRowOrigin(project);
  const keys = Array.from({ length: Math.max(1, count) }, (_, i) =>
    blankKey(o.x + i + 0.5, o.y + 0.5),
  );
  return {
    project: { ...project, keys: [...project.keys, ...keys] },
    ids: keys.map((k) => k.id),
  };
}

/** Keys lifted out of a layout, with the rotation groups they refer to. */
export interface Clip {
  keys: LayoutKey[];
  groups: RotationGroup[];
}

export function copyKeys(project: LayoutProject, ids: Iterable<string>): Clip {
  const wanted = new Set(ids);
  const keys = project.keys.filter((k) => wanted.has(k.id));
  const groupIds = new Set(keys.map((k) => k.groupId).filter(Boolean));
  return { keys, groups: project.groups.filter((g) => groupIds.has(g.id)) };
}

/** Put a clip into the layout, moved by (dx, dy), under fresh ids. */
export function pasteClip(
  project: LayoutProject,
  clip: Clip,
  dx: number,
  dy: number,
): Added {
  if (clip.keys.length === 0) return { project, ids: [] };
  const groupIds = new Map<string, string>();
  const groups = clip.groups.map((g) => {
    const id = newId("g");
    groupIds.set(g.id, id);
    return { id, pivot: { x: tidy(g.pivot.x + dx), y: tidy(g.pivot.y + dy) } };
  });
  const keys = clip.keys.map((k): LayoutKey => {
    const { groupId, ...rest } = k;
    const mapped = groupId ? groupIds.get(groupId) : undefined;
    return {
      ...rest,
      id: newId("k"),
      cx: tidy(k.cx + dx),
      cy: tidy(k.cy + dy),
      legends: k.legends.slice(),
      ...(mapped ? { groupId: mapped } : {}),
    };
  });
  return {
    project: {
      ...project,
      keys: [...project.keys, ...keys],
      groups: [...project.groups, ...groups],
    },
    ids: keys.map((k) => k.id),
  };
}

/** How far down a copy of these keys goes to sit right under them. */
export function offsetBelow(keys: LayoutKey[]): number {
  const b = keysBounds(keys);
  if (!b) return 1;
  return Math.max(0.25, Math.ceil((b.maxY - b.minY) * 4 - 1e-6) / 4);
}

/** A copy of the keys right under them. */
export function duplicateKeys(
  project: LayoutProject,
  ids: Iterable<string>,
): Added {
  const clip = copyKeys(project, ids);
  return pasteClip(project, clip, 0, offsetBelow(clip.keys));
}

/** Gap, in u, left between a set of keys and its mirror image. */
export const MIRROR_GAP = 1;

/**
 * A left-right mirror image of the keys, placed to their right: the other
 * hand of a split keyboard. Angles and pivots flip with them.
 */
export function mirrorKeys(
  project: LayoutProject,
  ids: Iterable<string>,
): Added {
  const clip = copyKeys(project, ids);
  const b = keysBounds(clip.keys);
  if (!b) return { project, ids: [] };
  const axis = b.maxX + MIRROR_GAP / 2;
  const flip = (x: number) => tidy(2 * axis - x);
  const mirrored: Clip = {
    groups: clip.groups.map((g) => ({
      ...g,
      pivot: { x: flip(g.pivot.x), y: g.pivot.y },
    })),
    keys: clip.keys.map((k) => {
      const next: LayoutKey = {
        ...k,
        cx: flip(k.cx),
        angle: k.angle === 0 ? 0 : -k.angle,
      };
      if (k.kle?.w2 !== undefined) {
        next.kle = { ...k.kle, x2: tidy(k.w - ((k.kle.x2 ?? 0) + k.kle.w2)) };
      }
      return next;
    }),
  };
  return pasteClip(project, mirrored, 0, 0);
}

// prettier-ignore
const TEMPLATES = {
  ortho40: [
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
  ],
  ansi60: [
    ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", { w: 2 }, "BS"],
    [{ w: 1.5 }, "Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", { w: 1.5 }, "\\"],
    [{ w: 1.75 }, "Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", { w: 2.25 }, "Enter"],
    [{ w: 2.25 }, "Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", { w: 2.75 }, "Shift"],
    [{ w: 1.25 }, "Ctrl", { w: 1.25 }, "Win", { w: 1.25 }, "Alt", { w: 6.25 }, "Space", { w: 1.25 }, "Alt", { w: 1.25 }, "Win", { w: 1.25 }, "Menu", { w: 1.25 }, "Ctrl"],
  ],
  split36: [
    ["", "", "", "", "", "", { x: 2 }, "", "", "", "", "", ""],
    ["", "", "", "", "", "", { x: 2 }, "", "", "", "", "", ""],
    ["", "", "", "", "", "", { x: 2 }, "", "", "", "", "", ""],
    [{ x: 3.5 }, "", "", "", { x: 1 }, "", "", ""],
  ],
};

export type TemplateId = keyof typeof TEMPLATES | "empty";

export function templateProject(id: TemplateId): LayoutProject {
  if (id === "empty") return { name: "", keys: [], groups: [] };
  return importKle(TEMPLATES[id]);
}
