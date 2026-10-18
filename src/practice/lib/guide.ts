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
}

const NONE: Trigger = { kind: "none" };

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
          const sends = t.kind === "key" || t.kind === "mouse";
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
  note?: "no-slots" | "no-thumbs" | "one-layer" | "nothing";
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
  return { layers };
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
export type LayerContent = "none" | "cursor" | "digits" | "symbols" | "fkeys";

/** What a thumb key does: its tap (a code, or "keep" for what it has) and its hold. */
export interface ThumbAssign {
  tap: string;
  hold: HoldChoice;
}

export interface Answers {
  /** Symbols by how often they are typed, most first. */
  symbols: string[];
  /** Replacements for CapsLock, the IME key and doubled modifiers, by position; "keep" leaves one. */
  replace: Record<string, string>;
  /** The thumb keys, by position. */
  thumbs: Record<string, ThumbAssign>;
  /** Thumb keys that get a layer on hold. */
  layerKeyPos: number[];
  /** How the cursor keys lie: an inverted T, or a row like Vim's hjkl. */
  cursorShape: CursorShape;
  /** Home / End / PgUp / PgDn around the cursor keys, or not. */
  navKeys: boolean;
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
    | "layer-keys"
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
  { id: "layer-keys", title: "Layer keys" },
  { id: "practice-base", title: "Practice: base layer", practice: true },
  { id: "layer-one-hand", title: "Layer contents: one hand" },
  { id: "layer-other", title: "Layer contents: other side" },
  { id: "practice-layers", title: "Practice: layer tasks", practice: true },
  { id: "rare", title: "Occasional keys" },
  { id: "practice-all", title: "Practice: everything", practice: true },
];

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
  replace: {},
  thumbs: {},
  layerKeyPos: [],
  cursorShape: "t",
  navKeys: false,
  oneHand: {},
  otherHand: {},
  rare: ["PrintScreen", "Insert"],
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

/**
 * The recommended thumb row: from Space, the keys towards the middle of
 * the keyboard take what is tapped on its own while writing (Backspace,
 * Delete, then Enter with a layer on hold, then 変換 with Alt), and the
 * keys outward of Space take 無変換 with Win on hold, then Shift and Ctrl.
 * That is one person's layout, offered as a starting point.
 */
export function recommendThumbs(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  spacePos: number | null,
): Record<string, ThumbAssign> {
  const thumbs = thumbsLeftToRight(board, meta);
  if (!thumbs.length) return {};
  const space =
    spacePos ??
    currentSpace(meta, km) ??
    thumbs[Math.floor((thumbs.length - 1) / 2)].pos;
  const sx = board.keys[space].cx;
  const spaceHand = meta.thumbKeys.find((t) => t.pos === space)?.hand ?? "L";
  const inward = (pos: number) =>
    spaceHand === "L" ? board.keys[pos].cx > sx : board.keys[pos].cx < sx;
  const byDistance = (a: number, b: number) =>
    Math.abs(board.keys[a].cx - sx) - Math.abs(board.keys[b].cx - sx);
  const inner = thumbs
    .map((t) => t.pos)
    .filter((p) => p !== space && inward(p))
    .sort(byDistance);
  const outer = thumbs
    .map((t) => t.pos)
    .filter((p) => p !== space && !inward(p))
    .sort(byDistance);
  const innerSeq: ThumbAssign[] = [
    { tap: "Backspace", hold: "none" },
    { tap: "Delete", hold: "none" },
    { tap: "Enter", hold: "layer" },
    { tap: "Convert", hold: "alt" },
    { tap: "ShiftLeft", hold: "none" },
    { tap: "ControlLeft", hold: "none" },
  ];
  const outerSeq: ThumbAssign[] = [
    { tap: "NonConvert", hold: "meta" },
    { tap: "ShiftLeft", hold: "none" },
    { tap: "ControlLeft", hold: "none" },
  ];
  const out: Record<string, ThumbAssign> = {
    [space]: { tap: "Space", hold: "layer" },
  };
  inner.forEach((pos, i) => {
    out[pos] = innerSeq[i] ?? { tap: "keep", hold: "none" };
  });
  outer.forEach((pos, i) => {
    out[pos] = outerSeq[i] ?? { tap: "keep", hold: "none" };
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
  const used = new Set<number>();
  for (const t of km.layers[0] ?? [])
    if (t.kind === "key" && t.holdLayer !== undefined) used.add(t.holdLayer);
  let next = Math.max(1, km.layers.length);
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
      if (now?.kind === "key" && now.holdLayer !== undefined)
        t.holdLayer = now.holdLayer;
      else {
        while (used.has(next)) next++;
        used.add(next);
        t.holdLayer = next++;
      }
    } else if (a.hold !== "none") {
      t.hold = HOLD_CODE[a.hold];
    }
    changes.push({ layer: 0, pos: th.pos, trigger: t });
  }
  return { changes: dedupe(km, changes) };
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
  let next = Math.max(1, km.layers.length);
  const used = new Set<number>();
  for (const t of km.layers[0] ?? [])
    if (t.kind === "key" && t.holdLayer !== undefined) used.add(t.holdLayer);
  const changes: Change[] = [];
  for (const pos of chosen) {
    const now = km.layers[0]?.[pos] ?? NONE;
    if (now.kind === "key" && now.holdLayer !== undefined) continue;
    while (used.has(next)) next++;
    used.add(next);
    const tap: Extract<Trigger, { kind: "key" }> =
      now.kind === "key" ? now : { kind: "key", code: "Space", mods: [] };
    changes.push({ layer: 0, pos, trigger: { ...tap, holdLayer: next } });
    next++;
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
  return { changes: dedupe(km, changes) };
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

/** Changes that put `content` under `hand` on `layer`. */
export function placeContent(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
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
  switch (content) {
    case "none":
      return [];
    case "cursor": {
      if (answers.cursorShape === "row") {
        ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"].forEach((c, i) =>
          put(home[i], c),
        );
        if (answers.navKeys)
          ["Home", "PageDown", "PageUp", "End"].forEach((c, i) =>
            put(home[i] !== undefined ? above(board, home[i]) : null, c),
          );
      } else {
        // An inverted T under the three fingers nearest the middle, Home /
        // End at the ends, PgUp / PgDn above and below the middle.
        const [h0, h1, h2, h3] = home;
        put(h1, "ArrowLeft");
        put(h2, "ArrowDown");
        put(h3, "ArrowRight");
        put(h2 !== undefined ? above(board, h2) : null, "ArrowUp");
        if (answers.navKeys) {
          put(h0, "Home");
          put(h3 !== undefined ? above(board, h3) : null, "End");
          put(h1 !== undefined ? above(board, h1) : null, "PageUp");
          put(h2 !== undefined ? below(board, h2) : null, "PageDown");
        }
      }
      return changes;
    }
    case "digits": {
      const three = home.slice(0, 3);
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
      put(home[3] !== undefined ? below(board, home[3]) : null, "Digit0");
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
      // The symbols not on the base layer, most used first.
      const onBase = new Set(
        (km.layers[0] ?? [])
          .map((t) => charOf(t, layout))
          .filter((c): c is string => c !== null),
      );
      const left = answers.symbols.filter((ch) => !onBase.has(ch));
      const slots = [
        ...home,
        ...home
          .map((p) => above(board, p))
          .filter((p): p is number => p !== null),
        ...home
          .map((p) => below(board, p))
          .filter((p): p is number => p !== null),
      ];
      left.forEach((ch, i) => {
        const t = triggerForChar(ch, layout);
        const pos = slots[i];
        if (t && pos !== undefined) changes.push({ layer, pos, trigger: t });
      });
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
  for (const content of CONTENTS) {
    const layer = contentLayer(meta, km, answers, side, content);
    if (layer === null) continue;
    const key = keys.find((k) => k.layer === layer);
    if (!key) continue;
    const hand: Hand = side === "one" ? key.hand : key.hand === "L" ? "R" : "L";
    changes.push(
      ...placeContent(board, meta, km, layer, hand, content, answers, layout),
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

/** Step 10: occasional keys go on free keys of the second layer, from the bottom. */
export function proposeRare(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const keys = thumbLayerKeys(meta, km);
  if (!keys.length) return { changes: [], note: "one-layer" };
  const layer = keys[keys.length - 1].layer;
  const taken = new Set([...meta.thumbKeys.map((t) => t.pos)]);
  const free = board.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => {
      if (taken.has(i)) return false;
      const t = km.layers[layer]?.[i] ?? NONE;
      const base = km.layers[0]?.[i];
      const isMod =
        base?.kind === "key" && /^(Shift|Control|Alt|Meta)/.test(base.code);
      return t.kind === "none" && !isMod && k.trigger.kind === "key";
    })
    // Lowest row first, left to right.
    .sort((a, b) => b.k.cy - a.k.cy || a.k.cx - b.k.cx)
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
): Map<number, { layer: number; label: string }> {
  const m = new Map<number, { layer: number; label: string }>();
  for (const c of changes) {
    const l = labelOf(c.trigger, layout);
    let hold = "";
    if (c.trigger.kind === "key" && c.trigger.holdLayer !== undefined)
      hold = ` / L${c.trigger.holdLayer}`;
    else if (c.trigger.kind === "key" && c.trigger.hold)
      hold = ` / ${labelForCode(c.trigger.hold, layout)?.main ?? c.trigger.hold}`;
    m.set(c.pos, { layer: c.layer, label: `${l.main}${hold}` });
  }
  return m;
}
