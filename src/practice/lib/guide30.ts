/**
 * The 30% guide (SPEC §5.2, 30%): the keymap the author uses on the
 * BeThirty Ortho, offered step by step as proposals on a keyboard with
 * no modifier keys of its own. With three letter rows and a bottom row,
 * the letters themselves carry a hold (and on Q a double tap), the two
 * thumb keys open one layer each, and the layers hold what the base
 * layer cannot.
 *
 * Every step is a set of groups, each a handful of keys that stands or
 * falls together (the cursor block, the F keys...); a group may be turned
 * off before applying. Keys are found by the letter the keyboard's own
 * default keymap puts on them, so the same recipe fits the Ortho (39
 * keys) and the QAZ (36 keys, no key right of L and no centre thumb).
 */
import { testBoard, type TestBoard } from "../../keyTest/lib/boards";
import type { Mod, Trigger } from "../../keyTest/lib/triggers";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import {
  type Answers,
  type Answers30,
  type Change,
  type Proposal,
  sameTrigger,
  triggerForChar,
  type WorkingKeymap,
} from "./guide";
import { type KeyboardMeta, positionMap } from "./metadata";

export type Step30 =
  | "thumbs30"
  | "alpha30"
  | "layer1"
  | "layer2"
  | "extra30"
  | "terms30";

export const STEPS_30: Step30[] = [
  "thumbs30",
  "alpha30",
  "layer1",
  "layer2",
  "extra30",
  "terms30",
];

export function isStep30(id: string): id is Step30 {
  return (STEPS_30 as string[]).includes(id);
}

export interface Group30 {
  id: string;
  /** English title, translated by the page. */
  title: string;
  /** English explanation, translated by the page. */
  text: string;
  changes: Change[];
  /** Why the group is thin or empty. */
  note?: "layers-full" | "no-key";
}

/** The layers the recipe uses, in the working keymap's numbering. */
const L1 = 1;
const L2 = 2;
const L3 = 3;
const L4 = 4;

const NONE: Trigger = { kind: "none" };
const BLOCKED: Trigger = { kind: "none", blocked: true };

type KeyTrigger = Extract<Trigger, { kind: "key" }>;
const key = (code: string, mods: Mod[] = []): KeyTrigger => ({
  kind: "key",
  code,
  mods,
});

/** The key that types a character, as a key trigger. */
function charKey(ch: string, layout: LabelLayout): KeyTrigger | null {
  const t = triggerForChar(ch, layout);
  return t && t.kind === "key" ? t : null;
}

/* ------------------------------------------------------------------ */
/* Finding keys                                                         */
/* ------------------------------------------------------------------ */

/**
 * Where each key of the recipe sits on the board: letters and symbols by
 * what the keyboard's default keymap puts there (the connected keyboard
 * may already have been changed, so the registered keyboard is asked and
 * its positions carried over), and the bottom row by order.
 */
export interface Anchors {
  /** The key the default keymap gives `code` (KeyQ, Semicolon...), if any. */
  byCode: (code: string) => number | null;
  /** The bottom row, left to right. */
  bottom: number[];
  /** The key right of / below another, if any. */
  rightOf: (pos: number) => number | null;
  below: (pos: number) => number | null;
}

export function anchorsOf(board: TestBoard, meta: KeyboardMeta): Anchors {
  const registered = testBoard(meta.id) ?? board;
  const toBoard =
    registered === board ? (p: number) => p : positionMap(registered, board);
  const byCode = (code: string): number | null => {
    const i = registered.keys.findIndex(
      (k) => k.trigger.kind === "key" && k.trigger.code === code,
    );
    if (i < 0) return null;
    return toBoard(i);
  };
  const maxY = Math.max(...board.keys.map((k) => k.cy));
  const bottom = board.keys
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => Math.abs(k.cy - maxY) < 0.3)
    .sort((a, b) => a.k.cx - b.k.cx)
    .map(({ i }) => i);
  const near = (pos: number, dx: number, dy: number): number | null => {
    const k = board.keys[pos];
    if (!k) return null;
    let best: number | null = null;
    let bestD = 0.6;
    board.keys.forEach((o, i) => {
      if (i === pos) return;
      const d = Math.hypot(o.cx - (k.cx + dx), o.cy - (k.cy + dy));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };
  return {
    byCode,
    bottom,
    rightOf: (pos) => near(pos, 1, 0),
    below: (pos) => near(pos, 0, 1),
  };
}

/**
 * The bottom row's roles: three keys on the left, the thumb keys in the
 * middle (Enter, the centre key when there is one, Space), three on the
 * right. Null where the keyboard has no such key.
 */
export function bottomRoles(a: Anchors) {
  const b = a.bottom;
  const n = b.length;
  const at = (i: number): number | null => (i >= 0 && i < n ? b[i] : null);
  const middle = b.slice(3, Math.max(3, n - 3));
  return {
    left: [at(0), at(1), at(2)],
    enter: middle[0] ?? null,
    centre: middle.length >= 3 ? middle[1] : null,
    space: middle.length >= 2 ? middle[middle.length - 1] : null,
    right: [at(n - 3), at(n - 2), at(n - 1)],
  };
}

/** Whether layer `l` fits the keymap's limit. */
const fits = (km: WorkingKeymap, l: number) =>
  km.maxLayers === undefined || l < km.maxLayers;

/* ------------------------------------------------------------------ */
/* The steps                                                            */
/* ------------------------------------------------------------------ */

type Put = (
  pos: number | null | undefined,
  trigger: Trigger,
  layer?: number,
) => void;

function collector(layer: number) {
  const changes: Change[] = [];
  const put: Put = (pos, trigger, l = layer) => {
    if (pos !== null && pos !== undefined)
      changes.push({ layer: l, pos, trigger });
  };
  return { changes, put };
}

/** Delete on a layer: the centre thumb key, or on a keyboard without one the key right of Space. */
function deletePos(a: Anchors): number | null {
  const r = bottomRoles(a);
  return r.centre ?? r.right[0];
}

/** Step 2: the thumb keys and the rest of the bottom row. */
export function groupsThumbs(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
): Group30[] {
  const a = anchorsOf(board, meta);
  const r = bottomRoles(a);
  const home = collector(0);
  const l3ok = fits(km, L3);
  home.put(r.enter, { ...key("Enter"), holdLayer: L2 });
  home.put(r.centre, key("Backspace"));
  home.put(r.space, { ...key("Space"), holdLayer: L1 });
  const left = collector(0);
  left.put(r.left[0], key("Tab", ["meta"]));
  left.put(r.left[1], { ...key("Backquote"), hold: "ShiftLeft" });
  left.put(r.left[2], { ...key("NonConvert"), hold: "MetaLeft" });
  const right = collector(0);
  right.put(r.right[0], { ...key("Convert"), hold: "AltLeft" });
  right.put(r.right[1], key("ContextMenu"));
  right.put(
    r.right[2],
    l3ok ? { ...key("IntlRo"), holdLayer: L3 } : key("IntlRo"),
  );
  return [
    {
      id: "thumbs30:home",
      title: "Thumb home keys",
      text: r.centre
        ? "Space under the right thumb, Enter under the left, Backspace between them where either thumb reaches it. Space held opens layer 1, Enter held opens layer 2."
        : "Space under the right thumb and Enter under the left; held, they open layer 1 and layer 2. This keyboard has no key between them, so Backspace is not on the base layer: Delete sits on both layers instead.",
      changes: home.changes,
    },
    {
      id: "thumbs30:left",
      title: "Left of the thumbs",
      text: "Win+Tab (the task view), 半角/全角 with Shift on hold, 無変換 with Win on hold.",
      changes: left.changes,
    },
    {
      id: "thumbs30:right",
      title: "Right of the thumbs",
      text: "変換 with Alt on hold, the menu key, and ろ (\\) whose hold opens layer 3 for keys used now and then.",
      changes: right.changes,
      ...(l3ok ? {} : { note: "layers-full" as const }),
    },
  ];
}

/** Step 3: letters that carry a modifier on hold, and Tab on the Q key. */
export function groupsAlpha(
  board: TestBoard,
  meta: KeyboardMeta,
  answers: Answers30,
  layout: LabelLayout,
): Group30[] {
  const a = anchorsOf(board, meta);
  const shift = collector(0);
  shift.put(a.byCode("KeyZ"), { ...key("KeyZ"), hold: "ShiftLeft" });
  const l = a.byCode("KeyL");
  const pinkyHome = l !== null ? a.rightOf(l) : null;
  const pinkyBelow = pinkyHome !== null ? a.below(pinkyHome) : null;
  const pinky = collector(0);
  if (pinkyHome !== null) {
    // The key right of L: a hyphen, with Ctrl on hold; below it a slash
    // with Shift on hold, the right hand's Shift.
    const hyphen = charKey("-", layout) ?? key("Minus");
    pinky.put(pinkyHome, { ...hyphen, hold: "ControlRight" });
    const slash = charKey("/", layout) ?? key("Slash");
    pinky.put(pinkyBelow, { ...slash, hold: "ShiftRight" });
  } else {
    // No column right of L: L itself holds Ctrl and the period Shift.
    pinky.put(l, { ...key("KeyL"), hold: "ControlRight" });
    pinky.put(a.byCode("Period"), { ...key("Period"), hold: "ShiftRight" });
  }
  const ctrl = collector(0);
  ctrl.put(a.byCode("KeyA"), {
    ...key("KeyA"),
    hold: "ControlLeft",
    term: answers.terms.a,
  });
  ctrl.put(a.byCode("KeyQ"), {
    ...key("Tab"),
    hold: "ControlLeft",
    doubleTap: "KeyQ",
    term: answers.terms.tab,
  });
  return [
    {
      id: "alpha30:shift",
      title: "Shift on Z",
      text: "Z held is Shift: a tap types z, a hold with another key gives its capital or shifted symbol.",
      changes: shift.changes,
    },
    {
      id: "alpha30:pinky",
      title: "The right little finger",
      text:
        pinkyHome !== null
          ? "The key right of L types a hyphen and holds Ctrl; the key below it types a slash and holds Shift, so the right hand has a Shift too."
          : "With no key right of L, L itself holds Ctrl and the period holds Shift, so the right hand has both.",
      changes: pinky.changes,
    },
    {
      id: "alpha30:ctrl",
      title: "Ctrl on A, and Tab where Q was",
      text: "A held is Ctrl. The Q key types Tab on a tap, Ctrl on a hold and Q on two quick taps: Tab is typed far more often than Q. The timing is tuned in the tapping term step.",
      changes: ctrl.changes,
    },
  ];
}

/** Step 5: layer 1 (Space held): the cursor under the right hand, F keys under the left. */
export function groupsLayer1(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
): Group30[] {
  const a = anchorsOf(board, meta);
  const r = bottomRoles(a);
  const cursor = collector(L1);
  cursor.put(a.byCode("KeyI"), key("ArrowUp"));
  cursor.put(a.byCode("KeyJ"), key("ArrowLeft"));
  cursor.put(a.byCode("KeyK"), key("ArrowDown"));
  cursor.put(a.byCode("KeyL"), key("ArrowRight"));
  for (const c of [
    "KeyY",
    "KeyU",
    "KeyO",
    "KeyH",
    "KeyN",
    "KeyM",
    "Comma",
    "Period",
  ])
    cursor.put(a.byCode(c), BLOCKED);
  const fkeys = collector(L1);
  fkeys.put(a.byCode("KeyR"), key("F11"));
  fkeys.put(a.byCode("KeyT"), key("F12"));
  ["KeyS", "KeyD", "KeyF", "KeyG"].forEach((c, i) =>
    fkeys.put(a.byCode(c), key(`F${2 + i}`)),
  );
  ["KeyX", "KeyC", "KeyV", "KeyB"].forEach((c, i) =>
    fkeys.put(a.byCode(c), key(`F${7 + i}`)),
  );
  fkeys.put(r.left[0], key("F6"));
  const edit = collector(L1);
  edit.put(a.byCode("KeyQ"), key("Escape"));
  edit.put(a.byCode("KeyW"), key("Tab"));
  edit.put(a.byCode("KeyP"), key("Tab"));
  edit.put(a.byCode("KeyA"), key("ControlLeft"));
  edit.put(a.byCode("KeyZ"), key("ShiftLeft"));
  const l = a.byCode("KeyL");
  const pinkyHome = l !== null ? a.rightOf(l) : null;
  edit.put(pinkyHome, key("ControlRight"));
  edit.put(pinkyHome !== null ? a.below(pinkyHome) : null, key("ShiftRight"));
  edit.put(deletePos(a), key("Delete"));
  const l4ok = fits(km, L4);
  if (l4ok) edit.put(r.enter, { ...key("Enter"), holdLayer: L4 });
  return [
    {
      id: "layer1:cursor",
      title: "Cursor keys under the right hand",
      text: "An inverted T on the home row: ← ↓ → on J K L and ↑ on I, so the right hand moves the cursor while its thumb holds Space. The keys around them do nothing on this layer, so a slip presses nothing.",
      changes: cursor.changes,
    },
    {
      id: "layer1:fkeys",
      title: "F keys under the left hand",
      text: "F2 to F5 on S D F G and F7 to F10 on X C V B, from the home position outward; F11 and F12 on R and T, F6 at the bottom left. F1 is left out: it is seldom wanted.",
      changes: fkeys.changes,
    },
    {
      id: "layer1:edit",
      title: "Esc, Tab, Delete and modifiers",
      text: "Esc at the top left (the same key on every layer), Tab on W and P, Ctrl and Shift on the left for Ctrl+arrow and Shift+arrow, Delete under the thumb where Backspace is on the base layer. Enter held on this layer opens layer 4: both thumbs down.",
      changes: edit.changes,
      ...(l4ok ? {} : { note: "layers-full" as const }),
    },
  ];
}

/** The 30% symbol grid: the author's six columns squeezed into five, with ! " ' on the bottom row. */
export const SYMBOL_ROWS_30: string[][] = [
  ["", "?", "[", "]", "~"],
  ["#", "$", "(", ")", "@"],
  ["%", "&", ";", ":", "|"],
];
export const SYMBOL_BOTTOM_30 = ["!", '"', "'"];

/** Step 6: layer 2 (Enter held): symbols under the left hand, a numpad under the right. */
export function groupsLayer2(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  layout: LabelLayout,
): Group30[] {
  const a = anchorsOf(board, meta);
  const r = bottomRoles(a);
  const symbols = collector(L2);
  const rows = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"],
  ];
  symbols.put(a.byCode("KeyQ"), key("Escape"));
  rows.forEach((row, ri) =>
    row.forEach((c, ci) => {
      const ch = SYMBOL_ROWS_30[ri][ci];
      if (!ch) return;
      const t = triggerForChar(ch, layout);
      if (t) symbols.put(a.byCode(c), t);
    }),
  );
  SYMBOL_BOTTOM_30.forEach((ch, i) => {
    const t = triggerForChar(ch, layout);
    if (t) symbols.put(r.left[i], t);
  });
  const numpad = collector(L2);
  numpad.put(a.byCode("KeyY"), key("NumpadDivide"));
  ["KeyU", "KeyI", "KeyO"].forEach((c, i) =>
    numpad.put(a.byCode(c), key(`Digit${7 + i}`)),
  );
  numpad.put(a.byCode("KeyP"), key("NumpadMultiply"));
  const underscore = triggerForChar("_", layout);
  if (underscore) numpad.put(a.byCode("KeyH"), underscore);
  ["KeyJ", "KeyK", "KeyL"].forEach((c, i) =>
    numpad.put(a.byCode(c), key(`Digit${4 + i}`)),
  );
  numpad.put(a.byCode("KeyN"), key("Digit0"));
  ["KeyM", "Comma", "Period"].forEach((c, i) =>
    numpad.put(a.byCode(c), key(`Digit${1 + i}`)),
  );
  const l = a.byCode("KeyL");
  const pinkyHome = l !== null ? a.rightOf(l) : null;
  numpad.put(pinkyHome, key("NumpadSubtract"));
  numpad.put(pinkyHome !== null ? a.below(pinkyHome) : null, key("NumpadAdd"));
  if (r.centre !== null) {
    numpad.put(r.right[0], key("NumpadDecimal"));
    numpad.put(r.right[1], key("NumpadEnter"));
    numpad.put(r.right[2], key("NumLock"));
  } else {
    // Delete takes the key right of Space here, so the numpad's bottom
    // row keeps . and Enter and lets NumLock go.
    numpad.put(r.right[1], key("NumpadDecimal"));
    numpad.put(r.right[2], key("NumpadEnter"));
  }
  const edit = collector(L2);
  edit.put(deletePos(a), key("Delete"));
  const l4ok = fits(km, L4);
  if (l4ok) edit.put(r.space, { ...key("Space"), holdLayer: L4 });
  return [
    {
      id: "layer2:symbols",
      title: "Symbols under the left hand",
      text: "Every symbol is the layer key plus one key, no Shift: ? [ ] ~ on W E R T, # $ ( ) @ on the home row, % & ; : | below it, and ! \" ' on the three keys at the bottom left. Pairs sit side by side. Esc stays at the top left.",
      changes: symbols.changes,
    },
    {
      id: "layer2:numpad",
      title: "Numbers under the right hand",
      text: "A numpad: 7 8 9 on U I O, 4 5 6 on J K L, 1 2 3 on M , . with 0 on N; / * - + in the outer column, _ on H, and . Enter NumLock at the bottom right.",
      changes: numpad.changes,
    },
    {
      id: "layer2:edit",
      title: "Delete, and layer 4 on Space",
      text: "Delete under the thumb, as on layer 1. Space held on this layer opens layer 4: both thumbs down.",
      changes: edit.changes,
      ...(l4ok ? {} : { note: "layers-full" as const }),
    },
  ];
}

/** Step 8: layer 3 (ろ held) for occasional keys, layer 4 (both thumbs) for shortcuts. */
export function groupsExtra(
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
): Group30[] {
  const a = anchorsOf(board, meta);
  const letters = [
    "KeyQ",
    "KeyW",
    "KeyE",
    "KeyR",
    "KeyT",
    "KeyY",
    "KeyU",
    "KeyI",
    "KeyO",
    "KeyP",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyZ",
    "KeyX",
    "KeyC",
    "KeyV",
    "KeyB",
    "KeyN",
    "KeyM",
    "Comma",
    "Period",
  ];
  const rare = collector(L3);
  const l3ok = fits(km, L3);
  if (l3ok) {
    const set = new Map<string, Trigger>([
      ["KeyQ", key("Escape")],
      ["KeyW", key("Tab")],
      ["KeyR", key("PrintScreen", ["alt"])],
      ["KeyT", key("PrintScreen")],
      ["KeyG", key("AudioVolumeUp")],
      ["KeyB", key("AudioVolumeDown")],
      ["KeyA", key("KeyA", ["ctrl"])],
      ["KeyZ", key("KeyZ", ["ctrl"])],
    ]);
    for (const c of letters) rare.put(a.byCode(c), set.get(c) ?? BLOCKED);
    rare.put(deletePos(a), key("Delete"));
  }
  const shortcuts = collector(L4);
  const l4ok = fits(km, L4);
  if (l4ok) {
    for (const c of [
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyH",
      "KeyJ",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyV",
      "KeyB",
      "KeyN",
      "KeyM",
      "KeyY",
      "KeyP",
    ])
      shortcuts.put(a.byCode(c), key(c, ["ctrl"]));
    shortcuts.put(a.byCode("KeyT"), key("KeyT", ["ctrl", "shift"]));
    shortcuts.put(a.byCode("KeyQ"), key("Tab"));
    for (const c of [
      "KeyW",
      "KeyE",
      "KeyR",
      "KeyU",
      "KeyI",
      "KeyO",
      "KeyK",
      "KeyL",
      "Comma",
      "Period",
    ])
      shortcuts.put(a.byCode(c), BLOCKED);
  }
  return [
    {
      id: "extra30:rare",
      title: "Layer 3: keys used now and then",
      text: "Held ろ at the bottom right: PrintScreen on T and Alt+PrintScreen (the active window) on R, volume up and down on G and B, Ctrl+A and Ctrl+Z on A and Z, Esc and Tab at the top left. Every other letter does nothing here.",
      changes: rare.changes,
      ...(l3ok ? {} : { note: "layers-full" as const }),
    },
    {
      id: "extra30:shortcuts",
      title: "Layer 4: shortcuts on single keys",
      text: "Both thumbs held: Ctrl with the same letter on A S D F G H J, Z X C V B N M, Y and P, so copy, paste, undo and the rest are one key each; Ctrl+Shift+T on T reopens a closed browser tab.",
      changes: shortcuts.changes,
      ...(l4ok ? {} : { note: "layers-full" as const }),
    },
  ];
}

/** Step 9: the tapping terms of the two tap-dance keys, as changes to those keys. */
export function groupsTerms(
  board: TestBoard,
  meta: KeyboardMeta,
  answers: Answers30,
  layout: LabelLayout,
): Group30[] {
  const ctrl = groupsAlpha(board, meta, answers, layout).find(
    (g) => g.id === "alpha30:ctrl",
  );
  return [
    {
      id: "terms30:terms",
      title: "Tapping term of Q and A",
      text: "A letter with a hold has to tell a tap from a hold by time. Q is hard to tap quickly, so its term is longer; A must be tapped short or it turns into Ctrl, so its term is shorter. Vial keeps a term per tap dance; ZMK keeps it in the firmware, so there the values here are a note only.",
      changes: ctrl?.changes ?? [],
    },
  ];
}

/** The groups of a 30% step. */
export function groups30(
  step: Step30,
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Group30[] {
  switch (step) {
    case "thumbs30":
      return groupsThumbs(board, meta, km);
    case "alpha30":
      return groupsAlpha(board, meta, answers.thirty, layout);
    case "layer1":
      return groupsLayer1(board, meta, km);
    case "layer2":
      return groupsLayer2(board, meta, km, layout);
    case "extra30":
      return groupsExtra(board, meta, km);
    case "terms30":
      return groupsTerms(board, meta, answers.thirty, layout);
  }
}

/** A step's proposal: every group not turned off, with unchanged keys left out. */
export function propose30(
  step: Step30,
  board: TestBoard,
  meta: KeyboardMeta,
  km: WorkingKeymap,
  answers: Answers,
  layout: LabelLayout,
): Proposal {
  const groups = groups30(step, board, meta, km, answers, layout);
  const changes: Change[] = [];
  for (const g of groups) {
    if (answers.thirty.off.includes(g.id)) continue;
    changes.push(...g.changes);
  }
  const deduped = changes.filter((c) => {
    const now = km.layers[c.layer]?.[c.pos] ?? NONE;
    return !sameTrigger(now, c.trigger);
  });
  const full = groups.some((g) => g.note === "layers-full");
  return {
    changes: deduped,
    ...(full
      ? { note: "layers-full" as const }
      : deduped.length
        ? {}
        : { note: "nothing" as const }),
  };
}

/** The layers a step draws, with the base-layer key held for each (null for the base). */
export function layersShown30(
  step: Step30,
  board: TestBoard,
  meta: KeyboardMeta,
): Array<{ layer: number; held: number[] }> {
  const a = anchorsOf(board, meta);
  const r = bottomRoles(a);
  const held = (...ps: Array<number | null>) =>
    ps.filter((p): p is number => p !== null);
  switch (step) {
    case "thumbs30":
    case "alpha30":
    case "terms30":
      return [{ layer: 0, held: [] }];
    case "layer1":
      return [{ layer: L1, held: held(r.space) }];
    case "layer2":
      return [{ layer: L2, held: held(r.enter) }];
    case "extra30":
      return [
        { layer: L3, held: held(r.right[2]) },
        { layer: L4, held: held(r.enter, r.space) },
      ];
  }
}
