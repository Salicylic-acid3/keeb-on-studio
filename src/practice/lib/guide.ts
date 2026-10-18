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

export type ThumbRole = "Backspace" | "Delete" | "Enter";
export type CapsChoice = "ctrl" | "esc" | "keep";

export interface Answers {
  /** Symbols by how often they are typed, most first. */
  symbols: string[];
  capslock: CapsChoice;
  /** The thumb key for Space; null until chosen. */
  spacePos: number | null;
  /** Backspace / Delete / Enter by how often they are used. */
  thumbOrder: ThumbRole[];
  /** Thumb keys that get a layer on hold. */
  layerKeyPos: number[];
  /** The hand whose thumb layer carries the cursor; "auto" picks the right. */
  cursorHand: "auto" | Hand;
  /** Swap the numpad and the F keys between hands. */
  otherMirror: boolean;
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
  capslock: "ctrl",
  spacePos: null,
  thumbOrder: ["Backspace", "Enter", "Delete"],
  layerKeyPos: [],
  cursorHand: "auto",
  otherMirror: false,
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

/** Step 2: the most used symbols take the base layer's symbol slots. */
export function proposeSymbols(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  const slots = meta.symbolSlots.filter((p) => p < board.keys.length);
  if (!slots.length) return { changes: [], note: "no-slots" };
  const changes: Change[] = [];
  answers.symbols.slice(0, slots.length).forEach((ch, i) => {
    const t = triggerForChar(ch, layout);
    if (t) changes.push({ layer: 0, pos: slots[i], trigger: t });
  });
  return { changes: dedupe(km, changes) };
}

/** Step 3: CapsLock becomes Ctrl or Esc, or stays. */
export function proposeDuplicates(
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const pos = meta.fixedKeys.capslock;
  if (pos === null || answers.capslock === "keep")
    return { changes: [], note: "nothing" };
  const code = answers.capslock === "ctrl" ? "ControlLeft" : "Escape";
  return { changes: dedupe(km, [{ layer: 0, pos, trigger: key(code) }]) };
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

/**
 * Step 4: Space where the thumb lands, then Backspace / Delete / Enter on
 * the thumb keys nearest to it, in the order they are used.
 */
export function proposeThumbs(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const thumbs = meta.thumbKeys.filter((t) => t.pos < board.keys.length);
  if (!thumbs.length) return { changes: [], note: "no-thumbs" };
  const space = answers.spacePos ?? currentSpace(meta, km) ?? thumbs[0].pos;
  const sx = board.keys[space].cx;
  const rest = thumbs
    .filter((t) => t.pos !== space)
    .sort(
      (a, b) =>
        Math.abs(board.keys[a.pos].cx - sx) -
        Math.abs(board.keys[b.pos].cx - sx),
    );
  const assigned = new Map<number, Trigger>([[space, key("Space")]]);
  answers.thumbOrder.forEach((role, i) => {
    const th = rest[i];
    if (th) assigned.set(th.pos, key(role));
  });
  // The thumb keys left over take the taps that were pushed out, so no
  // key is lost and none is doubled: a 変換 that sat where Enter now
  // goes moves to the key Enter came from.
  const codeOf = (t: Trigger | undefined) =>
    t?.kind === "key" && t.mods.length === 0 ? t.code : null;
  const used = new Set([...assigned.values()].map(codeOf));
  const pool = thumbs
    .map((t) => km.layers[0]?.[t.pos])
    .filter((t): t is Trigger => t !== undefined && !used.has(codeOf(t)))
    .filter((t) => t.kind !== "none");
  for (const th of thumbs) {
    if (assigned.has(th.pos)) continue;
    const now = km.layers[0]?.[th.pos];
    if (now && !used.has(codeOf(now))) continue; // keeps what it has
    const next = pool.shift();
    if (next) {
      const { holdLayer: _h, ...tap } =
        next.kind === "key" ? next : { ...next, holdLayer: undefined };
      void _h;
      assigned.set(th.pos, tap as Trigger);
    }
  }
  const changes: Change[] = [...assigned.entries()].map(([pos, t]) => ({
    layer: 0,
    pos,
    trigger: keep(km, pos, t),
  }));
  return { changes: dedupe(km, changes) };
}

/** A new tap on a key keeps the hold layer it already has. */
function keep(km: WorkingKeymap, pos: number, t: Trigger): Trigger {
  const now = km.layers[0]?.[pos];
  if (t.kind === "key" && now?.kind === "key" && now.holdLayer !== undefined)
    return { ...t, holdLayer: now.holdLayer };
  return t;
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

function cursorLayer(
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): { layer: number; hand: Hand } | null {
  const keys = thumbLayerKeys(meta, km);
  if (!keys.length) return null;
  const hand: Hand = answers.cursorHand === "auto" ? "R" : answers.cursorHand;
  const same = keys.find((k) => k.hand === hand);
  const k = same ?? keys[0];
  return { layer: k.layer, hand };
}

/**
 * Step 7: on the layer under one thumb, the cursor on that hand's home
 * row (with Home / End / PgUp / PgDn above) and the symbols that did not
 * fit the base layer on the other hand.
 */
export function proposeOneHand(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  const target = cursorLayer(meta, km, answers);
  if (!target) return { changes: [], note: "one-layer" };
  const { layer, hand } = target;
  const other: Hand = hand === "L" ? "R" : "L";
  const home = meta.homeRow[hand].filter((p) => p < board.keys.length);
  const changes: Change[] = [];
  const arrows = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"];
  const nav = ["Home", "PageDown", "PageUp", "End"];
  home.slice(0, 4).forEach((pos, i) => {
    changes.push({ layer, pos, trigger: key(arrows[i]) });
    const up = above(board, pos);
    if (up !== null) changes.push({ layer, pos: up, trigger: key(nav[i]) });
  });

  // Symbols not on the base layer, most used first.
  const onBase = new Set(
    (km.layers[0] ?? [])
      .map((t) => charOf(t, layout))
      .filter((c): c is string => c !== null),
  );
  const left = answers.symbols.filter((ch) => !onBase.has(ch));
  const otherHome = meta.homeRow[other].filter((p) => p < board.keys.length);
  const slots = [
    ...otherHome,
    ...otherHome
      .map((p) => above(board, p))
      .filter((p): p is number => p !== null),
    ...otherHome
      .map((p) => below(board, p))
      .filter((p): p is number => p !== null),
  ];
  left.forEach((ch, i) => {
    const t = triggerForChar(ch, layout);
    const pos = slots[i];
    if (t && pos !== undefined) changes.push({ layer, pos, trigger: t });
  });
  return { changes: dedupe(km, changes) };
}

/**
 * Step 8: on the other thumb's layer, a numpad under one hand and the F
 * keys under the other.
 */
export function proposeOther(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
): Proposal {
  const keys = thumbLayerKeys(meta, km);
  const cursor = cursorLayer(meta, km, answers);
  const otherKey = keys.find((k) => k.layer !== cursor?.layer);
  if (!otherKey) return { changes: [], note: "one-layer" };
  const layer = otherKey.layer;
  const numHand: Hand = answers.otherMirror ? "L" : "R";
  const fnHand: Hand = numHand === "L" ? "R" : "L";
  const changes: Change[] = [];

  const numHome = meta.homeRow[numHand]
    .filter((p) => p < board.keys.length)
    .slice(0, 3);
  const pad = (digits: string[], row: (number | null)[]) =>
    row.forEach((pos, i) => {
      if (pos !== null && digits[i])
        changes.push({ layer, pos, trigger: key(`Digit${digits[i]}`) });
    });
  pad(
    ["7", "8", "9"],
    numHome.map((p) => above(board, p)),
  );
  pad(["4", "5", "6"], numHome);
  pad(
    ["1", "2", "3"],
    numHome.map((p) => below(board, p)),
  );
  const fourth = meta.homeRow[numHand][3];
  const zero = fourth !== undefined ? below(board, fourth) : null;
  if (zero !== null) changes.push({ layer, pos: zero, trigger: key("Digit0") });

  const fnHome = meta.homeRow[fnHand]
    .filter((p) => p < board.keys.length)
    .slice(0, 4);
  const fn = (from: number, row: (number | null)[]) =>
    row.forEach((pos, i) => {
      if (pos !== null)
        changes.push({ layer, pos, trigger: key(`F${from + i}`) });
    });
  fn(
    1,
    fnHome.map((p) => above(board, p)),
  );
  fn(5, fnHome);
  fn(
    9,
    fnHome.map((p) => below(board, p)),
  );
  return { changes: dedupe(km, changes) };
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
    const hold =
      c.trigger.kind === "key" && c.trigger.holdLayer !== undefined
        ? ` / L${c.trigger.holdLayer}`
        : "";
    m.set(c.pos, { layer: c.layer, label: `${l.main}${hold}` });
  }
  return m;
}
