/**
 * What the setup guide needs to know about a keyboard beyond its keymap
 * (SPEC §8): its size class, which keys the thumbs reach, the home row,
 * where Esc / Tab / CapsLock sit, where symbols may go, and which keys
 * are layer keys by default. Positions are indexes into the keyboard's
 * key list, the same order as its keymap bindings.
 *
 * src/practice/data/keyboards.json holds the reviewed values; a keyboard
 * missing from it gets an estimate from its default keymap, which is also
 * what the metadata editor starts from when a new keyboard is registered.
 */
import type { TestBoard, TestKey } from "../../keyTest/lib/boards";
import stored from "../data/keyboards.json";

export type SizeClass = "30" | "40" | "60" | "75" | "80" | "pad";
export type GuideKind = "30" | "40" | "60";
export type Hand = "L" | "R";

export interface ThumbKey {
  pos: number;
  hand: Hand;
}

export interface LayerKeyMeta {
  pos: number;
  layer: number;
  hand: Hand;
}

export interface KeyboardMeta {
  id: string;
  sizeClass: SizeClass;
  /** The guide this keyboard starts in; null for a pad, which has none. */
  defaultGuide: GuideKind | null;
  allowGuide: GuideKind[];
  split: boolean;
  thumbKeys: ThumbKey[];
  homeRow: { L: number[]; R: number[] };
  fixedKeys: {
    esc: number | null;
    tab: number | null;
    capslock: number | null;
  };
  symbolSlots: number[];
  defaultLayerKeys: LayerKeyMeta[];
  /** Set by hand once the values have been looked over. */
  reviewed: boolean;
}

export const SIZE_CLASSES: SizeClass[] = ["30", "40", "60", "75", "80", "pad"];

/** The guide a size class starts in, and the guides it may switch to. */
export function guidesFor(size: SizeClass): {
  defaultGuide: GuideKind | null;
  allowGuide: GuideKind[];
} {
  switch (size) {
    case "30":
      return { defaultGuide: "30", allowGuide: ["30"] };
    case "40":
      return { defaultGuide: "40", allowGuide: ["30", "40"] };
    case "60":
    case "75":
    case "80":
      return { defaultGuide: "60", allowGuide: ["60"] };
    case "pad":
      return { defaultGuide: null, allowGuide: [] };
  }
}

const SYMBOL_CODES = new Set([
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Backquote",
  "Slash",
  "IntlBackslash",
  "IntlRo",
  "IntlYen",
]);

const ARROW = new Set(["←", "↑", "↓", "→"]);

function midX(keys: TestKey[]): number {
  const xs = keys.map((k) => k.cx);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
}

function handOf(k: TestKey, mid: number): Hand {
  return k.cx < mid ? "L" : "R";
}

function rowOf(keys: TestKey[], label: string): number | null {
  const k = keys.find((x) => x.label.main === label);
  return k ? k.cy : null;
}

/** Whether a key sits right after the period on its row. */
function besidePeriod(keys: TestKey[], k: TestKey): boolean {
  return keys.some(
    (o) =>
      o.trigger.kind === "key" &&
      o.trigger.code === "Period" &&
      Math.abs(o.cy - k.cy) < 0.3 &&
      Math.abs(k.cx - o.cx - (k.w + o.w) / 2) < 0.3,
  );
}

/** Keys on the same row as `y`, left to right. */
function row(keys: TestKey[], y: number): TestKey[] {
  return keys
    .filter((k) => Math.abs(k.cy - y) < 0.3)
    .sort((a, b) => a.cx - b.cx);
}

/** A first guess at the metadata, from the drawing and the default keymap. */
export function estimateMeta(board: TestBoard): KeyboardMeta {
  const keys = board.keys;
  const index = new Map(keys.map((k, i) => [k.id, i]));
  const pos = (k: TestKey) => index.get(k.id)!;
  const mid = midX(keys);
  const xs = keys.map((k) => k.cx);
  const width = Math.max(...xs) - Math.min(...xs) + 1;

  const sizeClass: SizeClass =
    keys.length <= 20
      ? "pad"
      : width < 11
        ? "30"
        : width <= 14
          ? "40"
          : width <= 16
            ? "60"
            : width <= 17.5
              ? "75"
              : "80";

  // A split: a gap wider than a key and a half somewhere along the home row.
  const homeY = rowOf(keys, "F") ?? rowOf(keys, "J");
  const homeRow = homeY !== null ? row(keys, homeY) : [];
  let split = false;
  for (let i = 1; i < homeRow.length; i++) {
    const a = homeRow[i - 1];
    const b = homeRow[i];
    if (b.cx - b.w / 2 - (a.cx + a.w / 2) > 1.5) split = true;
  }

  // Thumbs: the Space keys of the bottom row and the keys touching them
  // outward until a modifier or an arrow, at most seven. A keyboard whose
  // bottom row is Space on several keys is what the guide expects.
  const maxY = Math.max(...keys.map((k) => k.cy));
  const bottom = row(keys, maxY);
  const stops = (k: TestKey) =>
    ARROW.has(k.label.main) ||
    (k.trigger.kind === "key" &&
      /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(k.trigger.code));
  const spaceIdx = bottom
    .map((k, i) => (k.label.main === "Space" ? i : -1))
    .filter((i) => i >= 0);
  let thumbs: TestKey[] = [];
  if (spaceIdx.length) {
    let lo = Math.min(...spaceIdx);
    let hi = Math.max(...spaceIdx);
    while (lo > 0 && !stops(bottom[lo - 1]) && hi - lo + 1 < 7) lo--;
    while (hi < bottom.length - 1 && !stops(bottom[hi + 1]) && hi - lo + 1 < 7)
      hi++;
    thumbs = bottom.slice(lo, hi + 1);
  } else if (sizeClass !== "pad") {
    thumbs = bottom.filter((k) => k.w >= 1.25 && !stops(k)).slice(0, 7);
  }

  const byLabel = (label: string) =>
    keys.find((k) => k.label.main === label) ?? null;
  const posOf = (k: TestKey | null) => (k ? pos(k) : null);
  const home = (labels: string[]) =>
    labels.map(byLabel).filter((k): k is TestKey => k !== null);
  // The right hand's fourth home key is whatever sits right of L on its
  // row (; on a US board, + on JIS, something else on an ortho).
  const rightHome = home(["J", "K", "L"]);
  const l = byLabel("L");
  if (l) {
    const next = row(keys, l.cy).find((k) => k.cx > l.cx + l.w / 2 - 0.01);
    if (next) rightHome.push(next);
  }

  const layerKeys = keys.flatMap((k) => {
    const t = k.trigger;
    const layer =
      t.kind === "layer" ? t.layer : t.kind === "key" ? t.holdLayer : undefined;
    return layer !== undefined
      ? [{ pos: pos(k), layer, hand: handOf(k, mid) }]
      : [];
  });

  return {
    id: board.id,
    sizeClass,
    ...guidesFor(sizeClass),
    split,
    thumbKeys: thumbs.map((k) => ({ pos: pos(k), hand: handOf(k, mid) })),
    homeRow: {
      L: home(["A", "S", "D", "F"]).map(pos),
      R: rightHome.map(pos),
    },
    fixedKeys: {
      esc: posOf(byLabel("Esc")),
      tab: posOf(byLabel("Tab")),
      capslock: posOf(byLabel("Caps")),
    },
    // A symbol with or without Shift (a { on a 40%'s middle column is
    // Shift+[) is a slot a symbol may take. The slash right beside the
    // period is kept as it is, being placed with care; a slash set apart
    // from it by the arrow keys is a slot like any other.
    symbolSlots: keys
      .filter(
        (k) =>
          k.trigger.kind === "key" &&
          k.trigger.mods.every((m) => m === "shift") &&
          SYMBOL_CODES.has(k.trigger.code) &&
          !(k.trigger.code === "Slash" && besidePeriod(keys, k)),
      )
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .map(pos),
    defaultLayerKeys: layerKeys,
    reviewed: false,
  };
}

const STORED = stored as Record<string, Omit<KeyboardMeta, "id">>;

/** The metadata of a keyboard: the stored values, or an estimate. */
export function keyboardMeta(board: TestBoard): KeyboardMeta {
  const s = STORED[board.id];
  return s ? { id: board.id, ...s } : estimateMeta(board);
}

export function hasStoredMeta(id: string): boolean {
  return id in STORED;
}

/**
 * The metadata of a registered board carried over to another drawing of
 * the same keyboard (one read from the connected device), whose keys may
 * come in a different order: each position is matched by where its key
 * sits, and one with no key there is dropped.
 */
/**
 * Where each key of one drawing of a keyboard sits in another drawing of
 * it, by position; null where the other has no key there.
 */
export function positionMap(
  from: TestBoard,
  to: TestBoard,
): (pos: number) => number | null {
  return (pos: number): number | null => {
    const k = from.keys[pos];
    if (!k) return null;
    let best: number | null = null;
    let bestD = 0.3;
    to.keys.forEach((o, i) => {
      const d = Math.hypot(o.cx - k.cx, o.cy - k.cy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
}

export function metaForBoard(
  meta: KeyboardMeta,
  from: TestBoard,
  to: TestBoard,
): KeyboardMeta {
  const at = positionMap(from, to);
  const list = (ps: number[]) =>
    ps.map(at).filter((p): p is number => p !== null);
  const one = (p: number | null) => (p === null ? null : at(p));
  return {
    ...meta,
    thumbKeys: meta.thumbKeys.flatMap((t) => {
      const pos = at(t.pos);
      return pos === null ? [] : [{ ...t, pos }];
    }),
    homeRow: { L: list(meta.homeRow.L), R: list(meta.homeRow.R) },
    fixedKeys: {
      esc: one(meta.fixedKeys.esc),
      tab: one(meta.fixedKeys.tab),
      capslock: one(meta.fixedKeys.capslock),
    },
    symbolSlots: list(meta.symbolSlots),
    defaultLayerKeys: meta.defaultLayerKeys.flatMap((l) => {
      const pos = at(l.pos);
      return pos === null ? [] : [{ ...l, pos }];
    }),
  };
}
