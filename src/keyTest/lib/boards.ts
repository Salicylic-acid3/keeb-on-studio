/**
 * The keyboards the key test can draw, and each of their keys as something
 * a press can be matched to.
 *
 * Two are standard full-size keyboards (ANSI 104 and JIS 109): every key
 * there is simply the code it sends, so they work for any keyboard whose
 * keymap has been changed -- a press lights the key that means the same
 * thing. The rest are this workshop's keyboards, drawn the way the layout
 * editor draws them (vial.json for QMK, the firmware's physical layout for
 * ZMK) with the base layer of their default keymap.
 */
import {
  keyboardBindings,
  keyboardFirmware,
  keyboardTemplates,
} from "../../layoutEditor/lib/keyboards";
import { importKle, type KleDocument } from "../../layoutEditor/lib/kle";
import {
  labelForCode,
  type KeyLabel,
  type LabelLayout,
} from "../../layoutEditor/lib/keyLabels";
import type { LayoutKey } from "../../layoutEditor/lib/model";
import { qmkTrigger, zmkTrigger, type Mod, type Trigger } from "./triggers";

export type BoardGroup = "standard" | "zmk" | "qmk";

export interface TestBoardEntry {
  id: string;
  name: string;
  group: BoardGroup;
}

export interface TestKey {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  /** Second rectangle of a stepped key (ISO / JIS Enter), from the primary's top left. */
  second?: { x: number; y: number; w: number; h: number };
  trigger: Trigger;
  /**
   * What the key sends while a layer key is held, on each layer a layer
   * key of this keyboard turns on; only where that differs from `trigger`.
   */
  onLayers?: Array<{ layer: number; trigger: Trigger }>;
  /** Further codes the same key may send (Mac's 英数 / かな on a JIS board). */
  alsoCodes?: string[];
  label: KeyLabel;
}

export interface TestBoard {
  id: string;
  name: string;
  keys: TestKey[];
}

export const ANSI_ID = "standard_ansi";
export const JIS_ID = "standard_jis";

const L = (s: string) => s.split("").map((c) => `Key${c}`);
const D = "1234567890".split("").map((d) => `Digit${d}`);
const FROW: KleDocument[number] = [
  "Escape",
  { x: 1 },
  "F1",
  "F2",
  "F3",
  "F4",
  { x: 0.5 },
  "F5",
  "F6",
  "F7",
  "F8",
  { x: 0.5 },
  "F9",
  "F10",
  "F11",
  "F12",
  { x: 0.25 },
  "PrintScreen",
  "ScrollLock",
  "Pause",
];

/** ANSI 104: the legend of each key is the `KeyboardEvent.code` it sends. */
const ANSI: KleDocument = [
  FROW,
  [
    { y: 0.5 },
    "Backquote",
    ...D,
    "Minus",
    "Equal",
    { w: 2 },
    "Backspace",
    { x: 0.25 },
    "Insert",
    "Home",
    "PageUp",
    { x: 0.25 },
    "NumLock",
    "NumpadDivide",
    "NumpadMultiply",
    "NumpadSubtract",
  ],
  [
    { w: 1.5 },
    "Tab",
    ...L("QWERTYUIOP"),
    "BracketLeft",
    "BracketRight",
    { w: 1.5 },
    "Backslash",
    { x: 0.25 },
    "Delete",
    "End",
    "PageDown",
    { x: 0.25 },
    "Numpad7",
    "Numpad8",
    "Numpad9",
    { h: 2 },
    "NumpadAdd",
  ],
  [
    { w: 1.75 },
    "CapsLock",
    ...L("ASDFGHJKL"),
    "Semicolon",
    "Quote",
    { w: 2.25 },
    "Enter",
    { x: 3.5 },
    "Numpad4",
    "Numpad5",
    "Numpad6",
  ],
  [
    { w: 2.25 },
    "ShiftLeft",
    ...L("ZXCVBNM"),
    "Comma",
    "Period",
    "Slash",
    { w: 2.75 },
    "ShiftRight",
    { x: 1.25 },
    "ArrowUp",
    { x: 1.25 },
    "Numpad1",
    "Numpad2",
    "Numpad3",
    { h: 2 },
    "NumpadEnter",
  ],
  [
    { w: 1.25 },
    "ControlLeft",
    { w: 1.25 },
    "MetaLeft",
    { w: 1.25 },
    "AltLeft",
    { w: 6.25 },
    "Space",
    { w: 1.25 },
    "AltRight",
    { w: 1.25 },
    "MetaRight",
    { w: 1.25 },
    "ContextMenu",
    { w: 1.25 },
    "ControlRight",
    { x: 0.25 },
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    { x: 0.25, w: 2 },
    "Numpad0",
    "NumpadDecimal",
  ],
];

/**
 * JIS 109. A Mac's JIS keyboard sends 英数 / かな (Lang2 / Lang1) from the
 * keys beside the space bar, where a Windows one has 無変換 / 変換, so
 * those two keys take either ("NonConvert|Lang2").
 */
const JIS: KleDocument = [
  FROW,
  [
    { y: 0.5 },
    "Backquote",
    ...D,
    "Minus",
    "Equal",
    "IntlYen",
    "Backspace",
    { x: 0.25 },
    "Insert",
    "Home",
    "PageUp",
    { x: 0.25 },
    "NumLock",
    "NumpadDivide",
    "NumpadMultiply",
    "NumpadSubtract",
  ],
  [
    { w: 1.5 },
    "Tab",
    ...L("QWERTYUIOP"),
    "BracketLeft",
    "BracketRight",
    { x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 },
    "Enter",
    { x: 0.25 },
    "Delete",
    "End",
    "PageDown",
    { x: 0.25 },
    "Numpad7",
    "Numpad8",
    "Numpad9",
    { h: 2 },
    "NumpadAdd",
  ],
  [
    { w: 1.75 },
    "CapsLock",
    ...L("ASDFGHJKL"),
    "Semicolon",
    "Quote",
    "Backslash",
    { x: 4.75 },
    "Numpad4",
    "Numpad5",
    "Numpad6",
  ],
  [
    { w: 2.25 },
    "ShiftLeft",
    ...L("ZXCVBNM"),
    "Comma",
    "Period",
    "Slash",
    "IntlRo",
    { w: 1.75 },
    "ShiftRight",
    { x: 1.25 },
    "ArrowUp",
    { x: 1.25 },
    "Numpad1",
    "Numpad2",
    "Numpad3",
    { h: 2 },
    "NumpadEnter",
  ],
  [
    { w: 1.5 },
    "ControlLeft",
    "MetaLeft",
    "AltLeft",
    { w: 1.25 },
    "NonConvert|Lang2",
    { w: 3.5 },
    "Space",
    { w: 1.25 },
    "Convert|Lang1",
    { w: 1.25 },
    "KanaMode",
    "AltRight",
    "MetaRight",
    "ContextMenu",
    { w: 1.25 },
    "ControlRight",
    { x: 0.25 },
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    { x: 0.25, w: 2 },
    "Numpad0",
    "NumpadDecimal",
  ],
];

/** Every keyboard on offer: the two standard ones first. */
export function testBoardEntries(): TestBoardEntry[] {
  return [
    { id: ANSI_ID, name: "ANSI (US) Full size", group: "standard" },
    { id: JIS_ID, name: "JIS Full size", group: "standard" },
    ...keyboardTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      group: keyboardFirmware(t.id) ?? ("qmk" as const),
    })),
  ];
}

function geometry(key: LayoutKey): Omit<TestKey, "trigger" | "label"> {
  const k = key.kle;
  return {
    id: key.id,
    cx: key.cx,
    cy: key.cy,
    w: key.w,
    h: key.h,
    angle: key.angle,
    ...(k?.w2 !== undefined && k.h2 !== undefined && (k.w2 > 0 || k.h2 > 0)
      ? { second: { x: k.x2 ?? 0, y: k.y2 ?? 0, w: k.w2, h: k.h2 } }
      : {}),
  };
}

const MOD_SIGN: Record<Mod, string> = {
  shift: "⇧",
  ctrl: "⌃",
  alt: "⌥",
  meta: "⌘",
};

const MOUSE_LABEL = ["L Click", "M Click", "R Click", "Back", "Forward"];

/** What a key shows on screen. */
export function labelOf(trigger: Trigger, layout: LabelLayout): KeyLabel {
  switch (trigger.kind) {
    case "key": {
      // A JIS-only key (¥, \\_) keeps its JIS legend on any keyboard.
      const base = labelForCode(trigger.code, layout) ??
        labelForCode(trigger.code, "jis") ?? { main: trigger.code };
      // A shifted bracket of its own reads as the character it types.
      if (trigger.mods.length === 1 && trigger.mods[0] === "shift" && base.sub)
        return { main: base.sub };
      if (trigger.mods.length === 0) return base;
      return {
        main: `${trigger.mods.map((m) => MOD_SIGN[m]).join("")}${base.main}`,
      };
    }
    case "mouse":
      return { main: MOUSE_LABEL[trigger.button] ?? "Click" };
    case "layer":
      return { main: "Fn" };
    case "other":
      return { main: trigger.label.length > 6 ? "—" : trigger.label };
    case "none":
      return { main: "" };
  }
}

function standardBoard(id: string): TestBoard {
  const jis = id === JIS_ID;
  const layout: LabelLayout = jis ? "jis" : "us";
  const project = importKle(jis ? JIS : ANSI);
  return {
    id,
    name: jis ? "JIS Full size" : "ANSI (US) Full size",
    keys: project.keys.map((key) => {
      const [code, ...alsoCodes] = (key.legends.find(Boolean) ?? "").split("|");
      const trigger: Trigger = { kind: "key", code, mods: [] };
      return {
        ...geometry(key),
        trigger,
        ...(alsoCodes.length ? { alsoCodes } : {}),
        label: labelOf(trigger, layout),
      };
    }),
  };
}

/** A keyboard to test, by id; null for one that is not on offer. */
export function testBoard(id: string): TestBoard | null {
  if (id === ANSI_ID || id === JIS_ID) return standardBoard(id);
  const found = keyboardBindings(id);
  if (!found) return null;
  const { project, bindings, layers, firmware, layout } = found;
  const parse = firmware === "zmk" ? zmkTrigger : qmkTrigger;
  const triggers = bindings.map(parse);
  // The layers a key of the base layer turns on, and so can be tested.
  const reachable = new Set<number>();
  for (const t of triggers) {
    if (t.kind === "layer" && t.layer !== undefined) reachable.add(t.layer);
    if (t.kind === "key" && t.holdLayer !== undefined)
      reachable.add(t.holdLayer);
  }
  const keys = project.keys
    // Decals are drawings, not keys.
    .filter((key) => !key.kle?.decal)
    .map((key) => {
      const index = project.keys.indexOf(key);
      const trigger = triggers[index];
      const onLayers = [...reachable]
        .filter((layer) => layer >= 1 && layer - 1 < layers.length)
        .flatMap((layer) => {
          const t = parse(layers[layer - 1][index]);
          const sends = t.kind === "key" || t.kind === "mouse";
          return sends && !sameTrigger(t, trigger)
            ? [{ layer, trigger: t }]
            : [];
        });
      return {
        ...geometry(key),
        trigger,
        ...(onLayers.length ? { onLayers } : {}),
        label: labelOf(trigger, layout),
      };
    });
  return { id, name: project.name, keys };
}

function sameTrigger(a: Trigger, b: Trigger): boolean {
  if (a.kind === "key" && b.kind === "key")
    return (
      a.code === b.code &&
      a.mods.length === b.mods.length &&
      a.mods.every((m) => b.mods.includes(m))
    );
  if (a.kind === "mouse" && b.kind === "mouse") return a.button === b.button;
  return false;
}

/** The layers a keyboard's keys send something on while a layer key is held. */
export function testableLayers(board: TestBoard): Set<number> {
  const layers = new Set<number>();
  for (const key of board.keys)
    for (const on of key.onLayers ?? []) layers.add(on.layer);
  return layers;
}

/**
 * Whether pressing the key shows anything on the page: a key or a mouse
 * button does; a layer key only when some key sends something on its layer.
 */
export function isTestable(key: TestKey, layers?: Set<number>): boolean {
  const t = key.trigger;
  if (t.kind === "key" || t.kind === "mouse") return true;
  return (
    t.kind === "layer" &&
    t.layer !== undefined &&
    (layers?.has(t.layer) ?? false)
  );
}
