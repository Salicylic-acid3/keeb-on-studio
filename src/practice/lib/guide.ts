/**
 * The setup guide's working parts (SPEC §5): a keymap that proposals are
 * drawn on and applied to, and the proposals themselves, made by rule
 * from the person's answers and the keyboard's metadata (§5.5).
 *
 * The working keymap is the keymap as triggers per layer, which is what
 * the key test reads from a keyboard's default keymap and what the
 * practice draws. Applying a proposal changes it in the browser; writing
 * it to a keyboard goes through the remapper's own path (§13-3) and is
 * not done here.
 */
import {
  labelOf,
  type TestBoard,
  type TestKey,
} from "../../keyTest/lib/boards";
import type { Mod, Trigger } from "../../keyTest/lib/triggers";
import {
  labelForCode,
  type LabelLayout,
} from "../../layoutEditor/lib/keyLabels";
import type { Hand, KeyboardMeta } from "./metadata";

/* ------------------------------------------------------------------ */
/* Working keymap                                                       */
/* ------------------------------------------------------------------ */

export interface WorkingKeymap {
  /** layers[l][pos]: what key `pos` sends on layer l; layers[0] is the base. */
  layers: Trigger[][];
  /**
   * How many layers there may be at most (a keyboard with a block of
   * layers per OS allows the base and three more); unset means no limit.
   */
  maxLayers?: number;
}

const NONE: Trigger = { kind: "none" };
/** A key that does nothing on the layer, as opposed to showing the base layer through. */
const BLOCKED: Trigger = { kind: "none", blocked: true };

/** The keymap a board was drawn from, as layers of triggers. */
export function keymapOf(board: TestBoard): WorkingKeymap {
  let count = 1;
  for (const k of board.keys)
    for (const on of k.onLayers ?? []) count = Math.max(count, on.layer + 1);
  const layers: Trigger[][] = [];
  for (let l = 0; l < count; l++)
    layers.push(
      board.keys.map((k) => {
        if (l === 0) return k.trigger;
        return k.onLayers?.find((o) => o.layer === l)?.trigger ?? NONE;
      }),
    );
  return { layers };
}

export function sameTrigger(a: Trigger, b: Trigger): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "key" && b.kind === "key")
    return (
      a.code === b.code &&
      a.mods.length === b.mods.length &&
      a.mods.every((m) => b.mods.includes(m)) &&
      a.hold === b.hold &&
      a.holdLayer === b.holdLayer
    );
  if (a.kind === "mouse" && b.kind === "mouse") return a.button === b.button;
  if (a.kind === "layer" && b.kind === "layer") return a.layer === b.layer;
  if (a.kind === "other" && b.kind === "other") return a.label === b.label;
  if (a.kind === "none" && b.kind === "none")
    return !!a.blocked === !!b.blocked;
  return true;
}

/** The board redrawn with a working keymap. */
export function boardWith(
  board: TestBoard,
  km: WorkingKeymap,
  layout: LabelLayout,
): TestBoard {
  return {
    ...board,
    keys: board.keys.map((k, i): TestKey => {
      const trigger = km.layers[0]?.[i] ?? NONE;
      const onLayers = km.layers
        .map((layer, l) => ({ layer, l }))
        .filter(({ l }) => l > 0)
        .flatMap(({ layer, l }) => {
          const t = layer[i] ?? NONE;
          const sends =
            t.kind === "key" ||
            t.kind === "mouse" ||
            (t.kind === "none" && t.blocked);
          return sends && !sameTrigger(t, trigger)
            ? [{ layer: l, trigger: t }]
            : [];
        });
      const { onLayers: _old, ...rest } = k;
      void _old;
      return {
        ...rest,
        trigger,
        ...(onLayers.length ? { onLayers } : {}),
        label: labelOf(trigger, layout),
      };
    }),
  };
}

export interface Change {
  layer: number;
  pos: number;
  trigger: Trigger;
}

export interface Proposal {
  changes: Change[];
  /** Why the proposal is thin or empty, for the page to show. */
  note?: "no-slots" | "no-thumbs" | "one-layer" | "nothing" | "layers-full";
}

export function applyChanges(
  km: WorkingKeymap,
  changes: Change[],
): WorkingKeymap {
  const width = km.layers[0]?.length ?? 0;
  const layers = km.layers.map((l) => [...l]);
  for (const c of changes) {
    while (layers.length <= c.layer) layers.push(Array(width).fill(NONE));
    layers[c.layer][c.pos] = c.trigger;
  }
  return {
    layers,
    ...(km.maxLayers !== undefined ? { maxLayers: km.maxLayers } : {}),
  };
}

/**
 * Hands out layers for new layer keys: first any layer above the base that
 * is empty (every key transparent) and reached by no key, then new layers
 * up to the keymap's limit; null once there is none left.
 */
function layerAllocator(km: WorkingKeymap): () => number | null {
  const reached = new Set<number>();
  for (const layer of km.layers)
    for (const t of layer) {
      if (t.kind === "key" && t.holdLayer !== undefined)
        reached.add(t.holdLayer);
      if (t.kind === "layer" && t.layer !== undefined) reached.add(t.layer);
    }
  const free: number[] = [];
  km.layers.forEach((layer, i) => {
    if (i === 0 || reached.has(i)) return;
    if (layer.every((t) => t.kind === "none" && !t.blocked)) free.push(i);
  });
  let next = Math.max(1, km.layers.length);
  const max = km.maxLayers ?? Infinity;
  return () => {
    const f = free.shift();
    if (f !== undefined) {
      reached.add(f);
      return f;
    }
    while (reached.has(next)) next++;
    if (next >= max) return null;
    reached.add(next);
    return next++;
  };
}

/** Changes that would leave the keymap as it is are not worth proposing. */
function dedupe(km: WorkingKeymap, changes: Change[]): Change[] {
  return changes.filter((c) => {
    const now = km.layers[c.layer]?.[c.pos] ?? NONE;
    return !sameTrigger(now, c.trigger);
  });
}

/* ------------------------------------------------------------------ */
/* Characters and codes                                                 */
/* ------------------------------------------------------------------ */

const SYMBOL_CODES = [
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Backquote",
  "Slash",
  "Comma",
  "Period",
  "IntlBackslash",
  "IntlRo",
  "IntlYen",
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
];

/** The key (and Shift) that types a character on the OS layout. */
export function triggerForChar(
  ch: string,
  layout: LabelLayout,
): Trigger | null {
  if (/^[a-z]$/i.test(ch))
    return { kind: "key", code: `Key${ch.toUpperCase()}`, mods: [] };
  for (const code of SYMBOL_CODES) {
    const label = labelForCode(code, layout);
    if (!label) continue;
    if (label.main === ch) return { kind: "key", code, mods: [] };
    if (label.sub === ch) return { kind: "key", code, mods: ["shift"] };
  }
  return null;
}

const key = (code: string, mods: Mod[] = []): Trigger => ({
  kind: "key",
  code,
  mods,
});

/** The character a base-layer key types, for finding which symbols are already there. */
export function charOf(t: Trigger, layout: LabelLayout): string | null {
  if (t.kind !== "key") return null;
  const label = labelForCode(t.code, layout);
  if (!label) return null;
  if (t.mods.length === 0) return label.main.length === 1 ? label.main : null;
  if (t.mods.length === 1 && t.mods[0] === "shift" && label.sub)
    return label.sub;
  return null;
}

/* ------------------------------------------------------------------ */
/* Answers                                                              */
/* ------------------------------------------------------------------ */

export type HoldChoice = "none" | "shift" | "ctrl" | "alt" | "meta" | "layer";
export type CursorShape = "t" | "row";
export type CursorAround = "nav" | "none" | "leave";

/**
 * The author's symbol layer, as rows above / on / below the home row,
 * from the outer edge of the hand (the modifier column) inward: ! on Q,
 * ~ on T, " left of A, @ on G, ' left of Z, | on B.
 */
export const SYMBOL_GRID_COLUMNS = 6;
export const SALICYLIC_SYMBOL_GRID: string[][] = [
  ["", "!", "?", "[", "]", "~"],
  ['"', "#", "$", "(", ")", "@"],
  ["'", "%", "&", ";", ":", "|"],
];
export type LayerContent = "none" | "cursor" | "digits" | "symbols" | "fkeys";

/** What a thumb key does: its tap (a code, or "keep" for what it has) and its hold. */
export interface ThumbAssign {
  tap: string;
  hold: HoldChoice;
}

export interface Answers {
  /** Symbols by how often they are typed, most first. */
  symbols: string[];
  /** Hand-picked symbols for slots, by position: a character, or "keep" to leave the key. */
  symbolOverride: Record<string, string>;
  /** Replacements for CapsLock, the IME key and doubled modifiers, by position; "keep" leaves one. */
  replace: Record<string, string>;
  /** The thumb keys, by position. */
  thumbs: Record<string, ThumbAssign>;
  /** Thumb keys that get a layer on hold. */
  layerKeyPos: number[];
  /** How the cursor keys lie: an inverted T, or a row like Vim's hjkl. */
  cursorShape: CursorShape;
  /**
   * The keys around the cursor keys: Home / End / PgUp / PgDn, nothing at
   * all (so a slip presses nothing), or left as they are.
   */
  cursorAround: CursorAround;
  /**
   * The symbols on a layer, three rows (above the home row, the home row,
   * below it) by up to six columns, laid out to be remembered: pairs side
   * by side, in the number row's order.
   */
  symbolGrid: string[][];
  /**
   * Step 7: which thumb layer each kind of content goes on, under the
   * hand whose thumb holds that layer. Missing means the default; null
   * means nowhere.
   */
  oneHand: Partial<Record<LayerContent, number | null>>;
  /** Step 8: the same, under the other hand. */
  otherHand: Partial<Record<LayerContent, number | null>>;
  /** Occasional keys to tuck into a layer, by code. */
  rare: string[];
}

export const SYMBOL_CHOICES = [
  "-",
  ":",
  ";",
  "'",
  "/",
  "\\",
  "[",
  "]",
  "=",
  "`",
];
export const SYMBOL_NAMES: Record<string, string> = {
  "-": "Hyphen",
  ":": "Colon",
  ";": "Semicolon",
  "'": "Quote",
  "/": "Slash",
  "\\": "Backslash",
  "[": "Left bracket",
  "]": "Right bracket",
  "=": "Equals",
  "`": "Backquote",
};

export interface GuideStep {
  id:
    | "intro"
    | "symbols"
    | "duplicates"
    | "thumbs"
    | "practice-base"
    | "layer-one-hand"
    | "layer-other"
    | "practice-layers"
    | "rare"
    | "practice-all";
  title: string;
  /** A practice step, not a question. */
  practice?: boolean;
}

/** The 40%-and-under guide, one entry per step of SPEC §5.2. */
export const GUIDE_40: GuideStep[] = [
  { id: "intro", title: "Introduction" },
  { id: "symbols", title: "Symbol priority" },
  { id: "duplicates", title: "Rarely used keys" },
  { id: "thumbs", title: "Thumb keys" },
  { id: "practice-base", title: "Practice: base layer", practice: true },
  { id: "layer-one-hand", title: "Layer contents: one hand" },
  { id: "layer-other", title: "Layer contents: other side" },
  { id: "practice-layers", title: "Practice: layer tasks", practice: true },
  { id: "rare", title: "Occasional keys" },
  { id: "practice-all", title: "Practice: everything", practice: true },
];

/**
 * The steps as shown: with a keyboard connected, practice follows every
 * finished layer; in demo mode there is nothing to type on, so the
 * practice steps are left out and the guide ends with saving the keymap.
 */
export function guideSteps(withPractice: boolean): GuideStep[] {
  return withPractice ? GUIDE_40 : GUIDE_40.filter((s) => !s.practice);
}

export const RARE_CHOICES = [
  "PrintScreen",
  "Insert",
  "ScrollLock",
  "Pause",
  "ContextMenu",
  "CapsLock",
];

export const DEFAULT_ANSWERS: Answers = {
  symbols: SYMBOL_CHOICES,
  symbolOverride: {},
  replace: {},
  thumbs: {},
  layerKeyPos: [],
  cursorShape: "t",
  cursorAround: "leave",
  symbolGrid: SALICYLIC_SYMBOL_GRID.map((r) => [...r]),
  oneHand: {},
  otherHand: {},
  rare: [],
};

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                     */
/* ------------------------------------------------------------------ */

function keyNear(
  board: TestBoard,
  pos: number,
  dx: number,
  dy: number,
): number | null {
  const k = board.keys[pos];
  if (!k) return null;
  let bestI: number | null = null;
  let bestD = 0.6;
  for (let i = 0; i < board.keys.length; i++) {
    if (i === pos) continue;
    const o = board.keys[i];
    const d = Math.hypot(o.cx - (k.cx + dx), o.cy - (k.cy + dy));
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

const above = (b: TestBoard, pos: number) => keyNear(b, pos, 0, -1);
const below = (b: TestBoard, pos: number) => keyNear(b, pos, 0, 1);

/* ------------------------------------------------------------------ */
/* Proposals                                                            */
/* ------------------------------------------------------------------ */

const PAIR: Record<string, string> = {
  "[": "]",
  "]": "[",
  "(": ")",
  ")": "(",
  "{": "}",
  "}": "{",
};

/** The symbol slots nearest the home row first: the key beside L comes before the top row. */
export function orderedSymbolSlots(
  board: TestBoard,
  meta: KeyboardMeta,
): number[] {
  const home = [...meta.homeRow.L, ...meta.homeRow.R]
    .map((p) => board.keys[p])
    .filter((k) => k !== undefined);
  const dist = (pos: number) => {
    const k = board.keys[pos];
    if (!home.length) return k.cy * 10 + k.cx;
    return Math.min(...home.map((h) => Math.hypot(k.cx - h.cx, k.cy - h.cy)));
  };
  return meta.symbolSlots
    .filter((p) => p < board.keys.length)
    .sort((a, b) => dist(a) - dist(b) || board.keys[a].cx - board.keys[b].cx);
}

function sideBySide(board: TestBoard, a: number, b: number): boolean {
  const ka = board.keys[a];
  const kb = board.keys[b];
  return (
    Math.abs(ka.cy - kb.cy) < 0.3 &&
    Math.abs(Math.abs(ka.cx - kb.cx) - (ka.w + kb.w) / 2) < 0.3
  );
}

/**
 * Step 2: the most used symbols take the base layer's symbol slots, the
 * nearest to the home row first; a pair of brackets goes on two keys side
 * by side, the opening one on the left.
 */
export function proposeSymbols(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  const slots = orderedSymbolSlots(board, meta);
  if (!slots.length) return { changes: [], note: "no-slots" };
  const wanted = answers.symbols.slice(0, slots.length);
  const remaining = [...slots];
  const placed = new Map<string, number>();
  for (const ch of wanted) {
    if (placed.has(ch)) continue;
    const partner = PAIR[ch];
    if (partner && wanted.includes(partner) && !placed.has(partner)) {
      // Two neighbouring free slots, the nearest pair first.
      let found: [number, number] | null = null;
      for (const a of remaining) {
        const b = remaining.find((x) => x !== a && sideBySide(board, a, x));
        if (b !== undefined) {
          found = board.keys[a].cx <= board.keys[b].cx ? [a, b] : [b, a];
          break;
        }
      }
      if (found) {
        const opening = "[({".includes(ch) ? ch : partner;
        const closing = PAIR[opening];
        placed.set(opening, found[0]);
        placed.set(closing, found[1]);
        remaining.splice(remaining.indexOf(found[0]), 1);
        remaining.splice(remaining.indexOf(found[1]), 1);
        continue;
      }
    }
    const slot = remaining.shift();
    if (slot !== undefined) placed.set(ch, slot);
  }
  // Hand-picked symbols win over the order: a symbol put on a slot by
  // hand leaves wherever the order had put it, and a slot kept as it is
  // gives up its symbol.
  for (const [p, ch] of Object.entries(answers.symbolOverride)) {
    const pos = Number(p);
    if (!slots.includes(pos)) continue;
    for (const [c, at] of [...placed]) if (at === pos) placed.delete(c);
    if (ch !== "keep") placed.set(ch, pos);
  }
  const changes: Change[] = [];
  for (const [ch, pos] of placed) {
    const t = triggerForChar(ch, layout);
    if (t) changes.push({ layer: 0, pos, trigger: t });
  }
  return { changes: dedupe(km, changes) };
}

/** What a key under review may become; "keep" leaves it. */
export const REPLACE_CHOICES = [
  "keep",
  "ControlLeft",
  "Escape",
  "ShiftLeft",
  "AltLeft",
  "MetaLeft",
  "Tab",
  "Backquote",
  "CapsLock",
  "Backspace",
  "Delete",
];

const MODIFIER_LIKE =
  /^(Control|Shift|Alt|Meta)(Left|Right)$|^(Escape|Tab|CapsLock|Backquote)$/;

const SAME_MOD: Record<string, string> = {
  ControlRight: "ControlLeft",
  ShiftRight: "ShiftLeft",
  AltRight: "AltLeft",
  MetaRight: "MetaLeft",
};

export interface ReviewKey {
  pos: number;
  code: string;
  reason: "capslock" | "ime" | "doubled";
}

/**
 * Step 3: the keys worth a second look on the base layer, with the
 * replacements chosen so far applied: CapsLock, the IME toggle, and any
 * modifier that appears more than once (a Ctrl made out of CapsLock
 * doubles the Ctrl in the corner, which then comes up here too).
 */
export function reviewKeys(
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): ReviewKey[] {
  const base = (km.layers[0] ?? []).map((t, pos) => {
    const r = answers.replace[String(pos)];
    return r && r !== "keep" ? key(r) : t;
  });
  const out: ReviewKey[] = [];
  const seen = new Map<string, number[]>();
  // Shown by what the key is now, not by what it is about to become.
  const original = (pos: number) => {
    const t = km.layers[0]?.[pos];
    return t?.kind === "key" ? t.code : "";
  };
  base.forEach((t, pos) => {
    if (t.kind !== "key" || t.mods.length) return;
    if (original(pos) === "CapsLock")
      out.push({ pos, code: "CapsLock", reason: "capslock" });
    else if (original(pos) === "Backquote" && layout === "jis")
      out.push({ pos, code: "Backquote", reason: "ime" });
    if (MODIFIER_LIKE.test(t.code)) {
      const family = SAME_MOD[t.code] ?? t.code;
      seen.set(family, [...(seen.get(family) ?? []), pos]);
    }
  });
  for (const [, positions] of seen) {
    if (positions.length < 2) continue;
    for (const pos of positions) {
      if (out.some((r) => r.pos === pos)) continue;
      out.push({ pos, code: original(pos), reason: "doubled" });
    }
  }
  // A key given a replacement stays listed, so the choice can be undone.
  for (const p of Object.keys(answers.replace)) {
    const pos = Number(p);
    if (answers.replace[p] === "keep" || out.some((r) => r.pos === pos))
      continue;
    if (km.layers[0]?.[pos])
      out.push({ pos, code: original(pos), reason: "doubled" });
  }
  return out.sort((a, b) => a.pos - b.pos);
}

/** Step 3: the chosen replacements. */
export function proposeDuplicates(
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const changes: Change[] = [];
  for (const [p, code] of Object.entries(answers.replace)) {
    const pos = Number(p);
    if (code === "keep" || !Number.isFinite(pos)) continue;
    changes.push({ layer: 0, pos, trigger: key(code) });
  }
  const deduped = dedupe(km, changes);
  return { changes: deduped, ...(deduped.length ? {} : { note: "nothing" }) };
}

/** The thumb key currently sending Space, if any. */
export function currentSpace(
  meta: KeyboardMeta,
  km: WorkingKeymap,
): number | null {
  for (const th of meta.thumbKeys) {
    const t = km.layers[0]?.[th.pos];
    if (t?.kind === "key" && t.code === "Space") return th.pos;
  }
  return null;
}

/** Taps a thumb key may be given. */
export const THUMB_TAPS = [
  "Space",
  "Backspace",
  "Delete",
  "Enter",
  "Tab",
  "Escape",
  "Convert",
  "NonConvert",
  "Lang1",
  "Lang2",
  "ShiftLeft",
  "ControlLeft",
  "AltLeft",
  "MetaLeft",
  "Backquote",
  "CapsLock",
];

const HOLD_CODE: Record<Exclude<HoldChoice, "none" | "layer">, string> = {
  shift: "ShiftLeft",
  ctrl: "ControlLeft",
  alt: "AltLeft",
  meta: "MetaLeft",
};

/** The thumb keys left to right, as the page lists them. */
export function thumbsLeftToRight(board: TestBoard, meta: KeyboardMeta) {
  return meta.thumbKeys
    .filter((t) => t.pos < board.keys.length)
    .sort((a, b) => board.keys[a.pos].cx - board.keys[b.pos].cx);
}

/** What a thumb key does now, as an assignment. */
export function currentThumb(km: WorkingKeymap, pos: number): ThumbAssign {
  const t = km.layers[0]?.[pos];
  if (t?.kind !== "key") return { tap: "keep", hold: "none" };
  const hold: HoldChoice =
    t.holdLayer !== undefined
      ? "layer"
      : t.hold
        ? ((Object.entries(HOLD_CODE).find(([, c]) => c === t.hold)?.[0] as
            | HoldChoice
            | undefined) ?? "none")
        : "none";
  return { tap: t.code, hold };
}

/** How many thumb keys may open a layer: a keyboard with a block per OS has the base and three. */
export const MAX_LAYER_KEYS = 3;

/** The author's thumb row, left to right, as a starting point. */
export function recommendThumbs(
  board: TestBoard,
  meta: KeyboardMeta,
): Record<string, ThumbAssign> {
  const thumbs = thumbsLeftToRight(board, meta);
  if (!thumbs.length) return {};
  // Left to right: 無変換 / Win, Space / layer, Backspace, Delete, Enter /
  // layer, 変換 / Alt. With five thumb keys or fewer, Delete is left out:
  // the row is usually built without it.
  const seq: ThumbAssign[] = [
    { tap: "NonConvert", hold: "meta" },
    { tap: "Space", hold: "layer" },
    { tap: "Backspace", hold: "none" },
    ...(thumbs.length >= 6
      ? [{ tap: "Delete", hold: "none" } as ThumbAssign]
      : []),
    { tap: "Enter", hold: "layer" },
    { tap: "Convert", hold: "alt" },
  ];
  // With seven thumb keys the middle one is left as it is, three a side.
  if (thumbs.length >= 7) seq.splice(3, 0, { tap: "keep", hold: "none" });
  const out: Record<string, ThumbAssign> = {};
  thumbs.forEach((th, i) => {
    out[th.pos] = seq[i] ?? { tap: "keep", hold: "none" };
  });
  return out;
}

/** Step 4: the thumb keys as assigned; a layer on hold gets a layer number. */
export function proposeThumbs(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const thumbs = thumbsLeftToRight(board, meta);
  if (!thumbs.length) return { changes: [], note: "no-thumbs" };
  const allocate = layerAllocator(km);
  let layersFull = false;
  // At most three thumb keys open a layer: the base and three layers is
  // what a keyboard with a block per OS has.
  let layerKeys = 0;
  const changes: Change[] = [];
  for (const th of thumbs) {
    const a = answers.thumbs[String(th.pos)];
    if (!a) continue;
    const now = km.layers[0]?.[th.pos];
    const tapCode =
      a.tap === "keep" ? (now?.kind === "key" ? now.code : null) : a.tap;
    if (!tapCode) continue;
    const t: Extract<Trigger, { kind: "key" }> = {
      kind: "key",
      code: tapCode,
      mods: [],
    };
    if (a.hold === "layer") {
      if (layerKeys >= MAX_LAYER_KEYS) layersFull = true;
      else if (now?.kind === "key" && now.holdLayer !== undefined) {
        t.holdLayer = now.holdLayer;
        layerKeys++;
      } else {
        const layer = allocate();
        // No layer left for it: the key keeps its tap and gets no hold.
        if (layer === null) layersFull = true;
        else {
          t.holdLayer = layer;
          layerKeys++;
        }
      }
    } else if (a.hold !== "none") {
      t.hold = HOLD_CODE[a.hold];
    }
    changes.push({ layer: 0, pos: th.pos, trigger: t });
  }
  return {
    changes: dedupe(km, changes),
    ...(layersFull ? { note: "layers-full" as const } : {}),
  };
}

/** The layer keys among the thumbs, with the layer each holds. */
export function thumbLayerKeys(
  meta: KeyboardMeta,
  km: WorkingKeymap,
): Array<{ pos: number; layer: number; hand: Hand }> {
  const out: Array<{ pos: number; layer: number; hand: Hand }> = [];
  for (const th of meta.thumbKeys) {
    const t = km.layers[0]?.[th.pos];
    const layer =
      t?.kind === "key"
        ? t.holdLayer
        : t?.kind === "layer"
          ? t.layer
          : undefined;
    if (layer !== undefined && layer > 0)
      out.push({ pos: th.pos, layer, hand: th.hand });
  }
  return out;
}

/**
 * The thumb keys a layer suits: Space and Enter, not Backspace or Delete;
 * at most two, so each hand gets one.
 */
export function suggestedLayerKeys(
  meta: KeyboardMeta,
  km: WorkingKeymap,
): number[] {
  const spaces: number[] = [];
  const enters: number[] = [];
  for (const th of meta.thumbKeys) {
    const t = km.layers[0]?.[th.pos];
    if (t?.kind !== "key") continue;
    if (t.code === "Space") spaces.push(th.pos);
    if (t.code === "Enter") enters.push(th.pos);
  }
  const handOf = (pos: number) =>
    meta.thumbKeys.find((t) => t.pos === pos)?.hand;
  const first = spaces[0];
  if (first === undefined) return enters.slice(0, 2);
  // An Enter under the other thumb, if there is one.
  const other = enters.find((p) => handOf(p) !== handOf(first)) ?? enters[0];
  return other !== undefined ? [first, other] : [first];
}

/** Step 5: the chosen thumb keys hold a layer each, keeping their tap. */
export function proposeLayerKeys(
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const chosen = answers.layerKeyPos.filter((p) =>
    meta.thumbKeys.some((t) => t.pos === p),
  );
  if (!chosen.length) return { changes: [], note: "nothing" };
  const allocate = layerAllocator(km);
  let layersFull = false;
  const changes: Change[] = [];
  for (const pos of chosen) {
    const now = km.layers[0]?.[pos] ?? NONE;
    if (now.kind === "key" && now.holdLayer !== undefined) continue;
    const layer = allocate();
    if (layer === null) {
      layersFull = true;
      continue;
    }
    const tap: Extract<Trigger, { kind: "key" }> =
      now.kind === "key" ? now : { kind: "key", code: "Space", mods: [] };
    changes.push({ layer: 0, pos, trigger: { ...tap, holdLayer: layer } });
  }
  // Every thumb key not chosen loses its hold layer.
  for (const th of meta.thumbKeys) {
    if (chosen.includes(th.pos)) continue;
    const now = km.layers[0]?.[th.pos];
    if (now?.kind === "key" && now.holdLayer !== undefined) {
      const { holdLayer: _h, ...tap } = now;
      void _h;
      changes.push({ layer: 0, pos: th.pos, trigger: tap });
    }
  }
  return {
    changes: dedupe(km, changes),
    ...(layersFull ? { note: "layers-full" as const } : {}),
  };
}

/** The contents a layer may be given, in the order the steps list them. */
export const CONTENTS: LayerContent[] = [
  "cursor",
  "digits",
  "symbols",
  "fkeys",
];

/**
 * Which layer each content goes on by default: the cursor on the right
 * thumb's layer (one-hand side), the numbers on the other thumb's layer
 * (other-hand side), and nothing else until chosen.
 */
export function defaultContentLayers(
  meta: KeyboardMeta,
  km: WorkingKeymap,
  side: "one" | "other",
): Partial<Record<LayerContent, number | null>> {
  const keys = thumbLayerKeys(meta, km);
  if (!keys.length) return {};
  const right = keys.find((k) => k.hand === "R") ?? keys[0];
  const other = keys.find((k) => k.layer !== right.layer) ?? null;
  if (side === "one") return { cursor: right.layer };
  return other ? { digits: other.layer } : {};
}

/** The layer a content was given on a side, with the default filled in. */
export function contentLayer(
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  side: "one" | "other",
  content: LayerContent,
): number | null {
  const chosen = (side === "one" ? answers.oneHand : answers.otherHand)[
    content
  ];
  if (chosen !== undefined) return chosen;
  return defaultContentLayers(meta, km, side)[content] ?? null;
}

/**
 * The columns the symbol grid covers under a hand, outer edge first: the
 * home row from the hand's outer edge (the modifier column, when the row
 * has one) to the key inward of the index finger, at most the grid's
 * width. A 30% without the modifier column has five.
 */
export function symbolColumns(
  board: TestBoard,
  meta: KeyboardMeta,
  hand: Hand,
): number[] {
  const home = meta.homeRow[hand].filter((p) => p < board.keys.length);
  if (!home.length) return [];
  const inward = hand === "L" ? 1 : -1;
  const sorted = [...home].sort((p, q) => board.keys[p].cx - board.keys[q].cx);
  const innerHome = hand === "L" ? sorted[sorted.length - 1] : sorted[0];
  const outerHome = hand === "L" ? sorted[0] : sorted[sorted.length - 1];
  const cols = [...sorted];
  const inner = keyNear(board, innerHome, inward, 0);
  if (inner !== null && !cols.includes(inner)) cols.push(inner);
  let edge: number | null = outerHome;
  while (cols.length < SYMBOL_GRID_COLUMNS && edge !== null) {
    const next: number | null = keyNear(board, edge, -inward, 0);
    if (next === null || cols.includes(next)) break;
    const k = board.keys[next];
    // Only a key of ordinary width: a wide Shift or Enter is not a column.
    if (k.w > 2) break;
    cols.push(next);
    edge = next;
  }
  cols.sort((p, q) => board.keys[p].cx - board.keys[q].cx);
  // Aligned to the inner edge: the outermost columns are dropped first.
  return hand === "L"
    ? cols.slice(-SYMBOL_GRID_COLUMNS)
    : cols.slice(0, SYMBOL_GRID_COLUMNS);
}

/** The key of the row `dy` above (-1) or below (1) each column, nearest by x. */
function rowBeside(
  board: TestBoard,
  cols: number[],
  dy: number,
): (number | null)[] {
  // Each column's own neighbour: on a column-staggered keyboard the rows
  // do not line up, so the key above D is found from D, not from the row.
  const used = new Set<number>();
  return cols.map((p) => {
    const c = board.keys[p];
    let best: number | null = null;
    let bestD = Infinity;
    board.keys.forEach((k, i) => {
      if (i === p || used.has(i) || k.w > 2) return;
      const dx = Math.abs(k.cx - c.cx);
      const ddy = Math.abs(k.cy - (c.cy + dy));
      if (dx >= 0.6 || ddy >= 0.5) return;
      const d = Math.hypot(dx, ddy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== null) used.add(best);
    return best;
  });
}

/** Changes that put `content` under `hand` on `layer`. */
export function placeContent(
  board: TestBoard,
  meta: KeyboardMeta,
  layer: number,
  hand: Hand,
  content: LayerContent,
  answers: Answers,
  layout: LabelLayout,
): Change[] {
  const home = meta.homeRow[hand].filter((p) => p < board.keys.length);
  const changes: Change[] = [];
  const put = (pos: number | null | undefined, code: string) => {
    if (pos !== null && pos !== undefined)
      changes.push({ layer, pos, trigger: key(code) });
  };
  // The keys touching a set of keys do nothing on the layer, so a slip
  // beside the cursor keys presses nothing (blocked, not transparent).
  const clearAround = (keys: number[]) => {
    const inside = new Set(keys);
    const around = new Set<number>();
    for (const k of inside)
      for (const n of [
        above(board, k),
        below(board, k),
        keyNear(board, k, -1, 0),
        keyNear(board, k, 1, 0),
      ])
        if (n !== null && !inside.has(n)) around.add(n);
    for (const n of around) changes.push({ layer, pos: n, trigger: BLOCKED });
  };
  switch (content) {
    case "none":
      return [];
    case "cursor": {
      if (answers.cursorShape === "row") {
        ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"].forEach((c, i) =>
          put(home[i], c),
        );
        if (answers.cursorAround === "nav")
          ["Home", "PageDown", "PageUp", "End"].forEach((c, i) =>
            put(home[i] !== undefined ? above(board, home[i]) : null, c),
          );
        if (answers.cursorAround === "none") clearAround(home.slice(0, 4));
      } else {
        // An inverted T from the index finger: ← ↓ → on J K L (the home
        // row's first three), ↑ above the middle one; Home / End above
        // the ends and PgUp / PgDn on the fourth key and above it. Under
        // the left hand it is mirrored: ← ↓ → on S D F, ↑ on E, the
        // fourth key is A.
        const [h0, h1, h2, h3] =
          hand === "L" ? [home[1], home[2], home[3], home[0]] : home;
        put(h0, "ArrowLeft");
        put(h1, "ArrowDown");
        put(h2, "ArrowRight");
        put(h1 !== undefined ? above(board, h1) : null, "ArrowUp");
        if (answers.cursorAround === "nav") {
          put(h0 !== undefined ? above(board, h0) : null, "Home");
          put(h2 !== undefined ? above(board, h2) : null, "End");
          put(h3 !== undefined ? above(board, h3) : null, "PageUp");
          put(h3, "PageDown");
        }
        if (answers.cursorAround === "none")
          clearAround(
            [h0, h1, h2, h1 !== undefined ? above(board, h1) : null].filter(
              (p): p is number => p !== undefined && p !== null,
            ),
          );
      }
      return changes;
    }
    case "digits": {
      // A numpad under the three fingers beside the index finger's column:
      // right hand 7 8 9 / 4 5 6 / 1 2 3 on U I O / J K L / M , . with 0
      // on N; left hand on W E R / S D F / X C V with 0 on B. The little
      // finger's column holds * - + from the top.
      const three = hand === "L" ? home.slice(1, 4) : home.slice(0, 3);
      const row = (digits: string[], ps: (number | null | undefined)[]) =>
        ps.forEach((p, i) => digits[i] && put(p, `Digit${digits[i]}`));
      row(
        ["7", "8", "9"],
        three.map((p) => above(board, p)),
      );
      row(["4", "5", "6"], three);
      row(
        ["1", "2", "3"],
        three.map((p) => below(board, p)),
      );
      const indexHome = hand === "L" ? home[home.length - 1] : home[0];
      const innerKey =
        indexHome !== undefined
          ? keyNear(board, indexHome, hand === "L" ? 1 : -1, 0)
          : null;
      put(innerKey !== null ? below(board, innerKey) : null, "Digit0");
      const pinky = hand === "L" ? home[0] : home[3];
      if (pinky !== undefined) {
        const sym = (pos: number | null, ch: string) => {
          const t = pos !== null ? triggerForChar(ch, layout) : null;
          if (t && pos !== null) changes.push({ layer, pos, trigger: t });
        };
        sym(above(board, pinky), "*");
        sym(pinky, "-");
        sym(below(board, pinky), "+");
      }
      return changes;
    }
    case "fkeys": {
      const four = home.slice(0, 4);
      const row = (from: number, ps: (number | null | undefined)[]) =>
        ps.forEach((p, i) => put(p, `F${from + i}`));
      row(
        1,
        four.map((p) => above(board, p)),
      );
      row(5, four);
      row(
        9,
        four.map((p) => below(board, p)),
      );
      return changes;
    }
    case "symbols": {
      // The grid under the hand, from its outer edge inward; rows above /
      // on / below the home row. On a hand with fewer columns than the
      // grid, the grid's outer columns are the ones left out.
      const cols = symbolColumns(board, meta, hand);
      const rows = [
        rowBeside(board, cols, -1),
        cols.map((p): number | null => p),
        rowBeside(board, cols, 1),
      ];
      const skip = SYMBOL_GRID_COLUMNS - cols.length;
      answers.symbolGrid.forEach((row, r) =>
        row.forEach((ch, c) => {
          const gc = hand === "L" ? c - skip : c;
          const pos = rows[r]?.[gc];
          if (!ch || gc < 0 || pos === null || pos === undefined) return;
          const t = triggerForChar(ch, layout);
          if (t) changes.push({ layer, pos, trigger: t });
        }),
      );
      return changes;
    }
  }
}

function placeSide(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
  side: "one" | "other",
): Proposal {
  const keys = thumbLayerKeys(meta, km);
  if (!keys.length) return { changes: [], note: "one-layer" };
  const changes: Change[] = [];
  const taken = new Set<number>();
  for (const content of CONTENTS) {
    const layer = contentLayer(meta, km, answers, side, content);
    if (layer === null) continue;
    const key = keys.find((k) => k.layer === layer);
    if (!key) continue;
    // One kind of content per layer on a side: two under the same hand on
    // the same layer would land on top of each other.
    if (taken.has(layer)) continue;
    taken.add(layer);
    const hand: Hand = side === "one" ? key.hand : key.hand === "L" ? "R" : "L";
    changes.push(
      ...placeContent(board, meta, layer, hand, content, answers, layout),
    );
  }
  const deduped = dedupe(km, changes);
  return { changes: deduped, ...(deduped.length ? {} : { note: "nothing" }) };
}

/**
 * Step 7: what one hand finishes on its own, each kind on the layer
 * chosen for it, under the hand whose thumb holds that layer.
 */
export function proposeOneHand(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  return placeSide(board, meta, km, answers, layout, "one");
}

/**
 * Step 8: what is typed with the other hand while a thumb holds a layer,
 * each kind on the layer chosen for it.
 */
export function proposeOther(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  return placeSide(board, meta, km, answers, layout, "other");
}

/**
 * Step 10: the occasional keys picked go on free keys of the last thumb
 * layer, the ones farthest from the home row first, so nothing that is
 * typed often is in the way. Nothing is picked by default.
 */
export function proposeRare(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const keys = thumbLayerKeys(meta, km);
  if (!keys.length) return { changes: [], note: "one-layer" };
  const layer = keys[keys.length - 1].layer;
  const homeKeys = [...meta.homeRow.L, ...meta.homeRow.R]
    .map((p) => board.keys[p])
    .filter(Boolean);
  const distFromHome = (k: TestKey) =>
    homeKeys.length
      ? Math.min(...homeKeys.map((h) => Math.hypot(h.cx - k.cx, h.cy - k.cy)))
      : 0;
  const taken = new Set([...meta.thumbKeys.map((t) => t.pos)]);
  const free = board.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => {
      if (taken.has(i)) return false;
      const t = km.layers[layer]?.[i] ?? NONE;
      const base = km.layers[0]?.[i];
      const isMod =
        base?.kind === "key" && /^(Shift|Control|Alt|Meta)/.test(base.code);
      return (
        t.kind === "none" && !t.blocked && !isMod && k.trigger.kind === "key"
      );
    })
    // Farthest from the home row first.
    .map((e) => ({ ...e, d: distFromHome(e.k) }))
    .sort((a, b) => b.d - a.d || a.k.cy - b.k.cy || a.k.cx - b.k.cx)
    .map(({ i }) => i);
  const changes: Change[] = [];
  answers.rare.forEach((code, i) => {
    const pos = free[i];
    if (pos !== undefined) changes.push({ layer, pos, trigger: key(code) });
  });
  return {
    changes: dedupe(km, changes),
    ...(changes.length ? {} : { note: "nothing" }),
  };
}

/** What a proposal shows on each key it changes, for drawing it. */
export function proposalLabels(
  changes: Change[],
  layout: LabelLayout,
  layerBase = 0,
): Array<{ pos: number; layer: number; label: string }> {
  // One entry per change: a key changed on two layers keeps both labels.
  return changes.map((c) => {
    if (c.trigger.kind === "none")
      return { pos: c.pos, layer: c.layer, label: "None" };
    const l = labelOf(c.trigger, layout);
    let hold = "";
    if (c.trigger.kind === "key" && c.trigger.holdLayer !== undefined)
      hold = ` / L${c.trigger.holdLayer + layerBase}`;
    else if (c.trigger.kind === "key" && c.trigger.hold)
      hold = ` / ${labelForCode(c.trigger.hold, layout)?.main ?? c.trigger.hold}`;
    return { pos: c.pos, layer: c.layer, label: `${l.main}${hold}` };
  });
}
