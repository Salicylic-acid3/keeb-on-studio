/**
 * The connected ZMK keyboard as the guide and the practice see it: its
 * physical layout and keymap read through ZMK Studio turned into a
 * TestBoard plus a working keymap, and the guide's changes turned back
 * into bindings the keyboard accepts.
 *
 * Positions: a TestBoard key's index is its ZMK key position, and the
 * working keymap's layer index is the keymap's layer index (ids are mapped
 * on the way in and out, since a layer's id and index differ once layers
 * have been moved or removed).
 */
import type {
  BehaviorBinding,
  Keymap,
  PhysicalLayout,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { BehaviorDefinition } from "../../hooks/useKeymapSource";
import { importKle } from "../../layoutEditor/lib/kle";
import { zmkToKle } from "../../layoutEditor/lib/keyboards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { getBehaviorMetadata } from "../../lib/behaviorMetadata";
import {
  combineWithModifiers,
  createHidUsage,
  extractModifierFlags,
  getHidUsageCode,
  getHidUsagePage,
  HID_USAGE_PAGE_CONSUMER,
  HID_USAGE_PAGE_KEYBOARD,
} from "../../lib/keycodes";
import {
  labelOf,
  type TestBoard,
  type TestKey,
} from "../../keyTest/lib/boards";
import type { Mod, Trigger } from "../../keyTest/lib/triggers";
import { type Change, type WorkingKeymap } from "./guide";

/* ------------------------------------------------------------------ */
/* Key codes and HID usages                                             */
/* ------------------------------------------------------------------ */

/** KeyboardEvent.code → HID keyboard-page usage id (USB HID usage table 10). */
export const HID_BY_CODE: Record<string, number> = {
  ...Object.fromEntries(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c, i) => [`Key${c}`, 0x04 + i]),
  ),
  ...Object.fromEntries(
    "123456789".split("").map((d, i) => [`Digit${d}`, 0x1e + i]),
  ),
  Digit0: 0x27,
  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  Space: 0x2c,
  Minus: 0x2d,
  Equal: 0x2e,
  BracketLeft: 0x2f,
  BracketRight: 0x30,
  Backslash: 0x31,
  Semicolon: 0x33,
  Quote: 0x34,
  Backquote: 0x35,
  Comma: 0x36,
  Period: 0x37,
  Slash: 0x38,
  CapsLock: 0x39,
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 0x3a + i]),
  ),
  PrintScreen: 0x46,
  ScrollLock: 0x47,
  Pause: 0x48,
  Insert: 0x49,
  Home: 0x4a,
  PageUp: 0x4b,
  Delete: 0x4c,
  End: 0x4d,
  PageDown: 0x4e,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,
  NumLock: 0x53,
  NumpadDivide: 0x54,
  NumpadMultiply: 0x55,
  NumpadSubtract: 0x56,
  NumpadAdd: 0x57,
  NumpadEnter: 0x58,
  ...Object.fromEntries(
    "123456789".split("").map((d, i) => [`Numpad${d}`, 0x59 + i]),
  ),
  Numpad0: 0x62,
  NumpadDecimal: 0x63,
  IntlBackslash: 0x64,
  ContextMenu: 0x65,
  Power: 0x66,
  NumpadEqual: 0x67,
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`F${i + 13}`, 0x68 + i]),
  ),
  NumpadComma: 0x85,
  IntlRo: 0x87,
  KanaMode: 0x88,
  IntlYen: 0x89,
  Convert: 0x8a,
  NonConvert: 0x8b,
  Lang1: 0x90,
  Lang2: 0x91,
  ControlLeft: 0xe0,
  ShiftLeft: 0xe1,
  AltLeft: 0xe2,
  MetaLeft: 0xe3,
  ControlRight: 0xe4,
  ShiftRight: 0xe5,
  AltRight: 0xe6,
  MetaRight: 0xe7,
};

export const CODE_BY_HID: Record<number, string> = Object.fromEntries(
  Object.entries(HID_BY_CODE).map(([code, id]) => [id, code]),
);
// The ISO # key (0x32) types what Backslash does on such a layout.
CODE_BY_HID[0x32] = "Backslash";

/** KeyboardEvent.code → HID consumer-page usage id (volume and the like). */
export const CONSUMER_BY_CODE: Record<string, number> = {
  AudioVolumeUp: 0xe9,
  AudioVolumeDown: 0xea,
  AudioVolumeMute: 0xe2,
};
const CODE_BY_CONSUMER: Record<number, string> = Object.fromEntries(
  Object.entries(CONSUMER_BY_CODE).map(([code, id]) => [id, code]),
);

const FLAG: Record<Mod, number> = {
  ctrl: 0x01,
  shift: 0x02,
  alt: 0x04,
  meta: 0x08,
};

function modsOfFlags(flags: number): Mod[] {
  const out: Mod[] = [];
  (Object.keys(FLAG) as Mod[]).forEach((m) => {
    if (flags & FLAG[m] || flags & (FLAG[m] << 4)) out.push(m);
  });
  return out;
}

function flagsOfMods(mods: Mod[]): number {
  return mods.reduce((f, m) => f | FLAG[m], 0);
}

/** The HID usage (with page and modifier flags) a key trigger sends. */
function usageOf(code: string, mods: Mod[]): number | null {
  const id = HID_BY_CODE[code];
  if (id !== undefined) return combineWithModifiers(id, flagsOfMods(mods));
  const consumer = CONSUMER_BY_CODE[code];
  if (consumer === undefined) return null;
  return combineWithModifiers(
    createHidUsage(HID_USAGE_PAGE_CONSUMER, consumer),
    flagsOfMods(mods),
  );
}

/** The key code of a HID usage on the keyboard or consumer page, with its modifiers. */
function keyOfUsage(usage: number): { code: string; mods: Mod[] } | null {
  const page = getHidUsagePage(usage);
  const code =
    page === HID_USAGE_PAGE_KEYBOARD
      ? CODE_BY_HID[getHidUsageCode(usage)]
      : page === HID_USAGE_PAGE_CONSUMER
        ? CODE_BY_CONSUMER[getHidUsageCode(usage)]
        : undefined;
  if (!code) return null;
  return { code, mods: modsOfFlags(extractModifierFlags(usage)) };
}

/* ------------------------------------------------------------------ */
/* Behaviors                                                            */
/* ------------------------------------------------------------------ */

export type BehaviorRole =
  | "kp"
  | "mo"
  | "lt"
  | "mt"
  | "trans"
  | "none"
  | "mkp"
  | "to"
  | "tog"
  /** zmk-feature-runtime-tap-dance's &rtd: a tap dance slot, set up in the keyboard's settings. */
  | "rtd";

const ROLE_NAMES: Record<BehaviorRole, string> = {
  kp: "Key Press",
  mo: "Momentary Layer",
  lt: "Layer-Tap",
  mt: "Mod-Tap",
  trans: "Trans",
  none: "None",
  mkp: "Mouse Key Press",
  to: "To Layer",
  tog: "Toggle Layer",
  rtd: "Tap Dance",
};

/** Whether a key needs a tap dance: two taps for another key, or a tapping term of its own. */
export function needsTapDance(t: Trigger): boolean {
  return (
    t.kind === "key" && (t.doubleTap !== undefined || t.term !== undefined)
  );
}

/**
 * A runtime tap dance slot's contents, as the guide reads and writes them:
 * what one, two (and three) taps do, what each count does when held, and
 * the wait between taps.
 */
export interface Dance {
  taps: BehaviorBinding[];
  holds: Array<BehaviorBinding | null>;
  term?: number;
}

export type BehaviorIds = Partial<Record<BehaviorRole, number>>;

/** What a device behavior is, by its name, or null for one the guide does not use. */
export function behaviorRole(displayName: string): BehaviorRole | null {
  const meta = getBehaviorMetadata(displayName);
  if (!meta) return null;
  const variants = meta.displayNameVariants.map((v) => v.toLowerCase());
  for (const role of Object.keys(ROLE_NAMES) as BehaviorRole[])
    if (variants.includes(ROLE_NAMES[role].toLowerCase())) return role;
  return null;
}

/**
 * The behavior id to write for each role: the one the keymap already uses
 * for that role where it does (so a timing preset in use stays in use),
 * otherwise the plainly named one, otherwise any with that role.
 */
export function behaviorIds(
  behaviors: Map<number, BehaviorDefinition>,
  keymap: Keymap | null,
): BehaviorIds {
  const out: BehaviorIds = {};
  const roleOf = new Map<number, BehaviorRole | null>();
  for (const [id, b] of behaviors) roleOf.set(id, behaviorRole(b.displayName));
  for (const layer of keymap?.layers ?? [])
    for (const b of layer.bindings) {
      const role = roleOf.get(b.behaviorId);
      if (role && out[role] === undefined) out[role] = b.behaviorId;
    }
  for (const [id, b] of behaviors) {
    const role = roleOf.get(id);
    if (!role || out[role] !== undefined) continue;
    const plain =
      b.displayName.toLowerCase() === ROLE_NAMES[role].toLowerCase();
    if (plain) out[role] = id;
  }
  for (const [id] of behaviors) {
    const role = roleOf.get(id);
    if (role && out[role] === undefined) out[role] = id;
  }
  return out;
}

/** The trigger a tap dance slot stands for, or null for one the guide does not describe. */
export function danceToTrigger(
  dance: Dance,
  behaviors: Map<number, BehaviorDefinition>,
  layerIndexOf: (id: number) => number | undefined,
): Trigger | null {
  const plain = (b: BehaviorBinding | null | undefined) => {
    if (!b) return null;
    const t = bindingToTrigger(b, behaviors, layerIndexOf);
    return t.kind === "key" && !t.hold && t.holdLayer === undefined ? t : null;
  };
  const tap = plain(dance.taps[0]);
  if (!tap || dance.taps.length > 2) return null;
  const out: Extract<Trigger, { kind: "key" }> = {
    kind: "key",
    code: tap.code,
    mods: tap.mods,
  };
  const hold = dance.holds[0];
  if (hold) {
    const h = bindingToTrigger(hold, behaviors, layerIndexOf);
    if (h.kind === "key" && !h.mods.length && MODIFIER.test(h.code))
      out.hold = h.code;
    else if (!(h.kind === "none")) return null;
  }
  if (dance.taps[1]) {
    const d = plain(dance.taps[1]);
    if (!d || d.mods.length) return null;
    out.doubleTap = d.code;
  }
  if (dance.holds[1]) {
    const h2 = bindingToTrigger(dance.holds[1], behaviors, layerIndexOf);
    if (h2.kind !== "none") return null;
  }
  if (dance.term) out.term = dance.term;
  return out;
}

const MODIFIER = /^(Control|Shift|Alt|Meta)(Left|Right)$/;

/** The slot contents for a key that needs a tap dance, or null when the keyboard cannot express it. */
export function triggerToDance(
  trigger: Trigger,
  ids: BehaviorIds,
): Dance | null {
  if (trigger.kind !== "key" || trigger.holdLayer !== undefined) return null;
  const kp = ids.kp;
  if (kp === undefined) return null;
  const tap = usageOf(trigger.code, trigger.mods);
  if (tap === null) return null;
  const taps: BehaviorBinding[] = [{ behaviorId: kp, param1: tap, param2: 0 }];
  const holds: Array<BehaviorBinding | null> = [null];
  if (trigger.hold) {
    const h = usageOf(trigger.hold, []);
    if (h === null) return null;
    holds[0] = { behaviorId: kp, param1: h, param2: 0 };
  }
  if (trigger.doubleTap) {
    const d = usageOf(trigger.doubleTap, []);
    if (d === null) return null;
    taps.push({ behaviorId: kp, param1: d, param2: 0 });
    holds.push(null);
  }
  return { taps, holds, ...(trigger.term ? { term: trigger.term } : {}) };
}

/** Whether two slot contents are the same dance. */
export function sameDance(a: Dance, b: Dance): boolean {
  const same = (x: BehaviorBinding | null, y: BehaviorBinding | null) =>
    (x === null && y === null) ||
    (x !== null &&
      y !== null &&
      x.behaviorId === y.behaviorId &&
      x.param1 === y.param1 &&
      x.param2 === y.param2);
  return (
    a.taps.length === b.taps.length &&
    a.taps.every((t, i) => same(t, b.taps[i])) &&
    a.taps.every((_, i) => same(a.holds[i] ?? null, b.holds[i] ?? null)) &&
    (a.term ?? 200) === (b.term ?? 200)
  );
}

const MOUSE_MASK = [1, 4, 2, 8, 16]; // Trigger.button 0..4 = L, M, R, B4, B5

/** A device binding as a trigger. `layerIndexOf` turns a layer id into its index. */
export function bindingToTrigger(
  binding: BehaviorBinding,
  behaviors: Map<number, BehaviorDefinition>,
  layerIndexOf: (id: number) => number | undefined,
  dances?: Map<number, Dance>,
): Trigger {
  const def = behaviors.get(binding.behaviorId);
  const name = def?.displayName ?? `#${binding.behaviorId}`;
  const role = behaviorRole(name);
  const layer = (id: number) => layerIndexOf(id) ?? id;
  switch (role) {
    case "rtd": {
      const dance = dances?.get(binding.param1);
      const t = dance ? danceToTrigger(dance, behaviors, layerIndexOf) : null;
      return t ?? { kind: "other", label: `TD ${binding.param1}` };
    }
    case "trans":
      return { kind: "none" };
    case "none":
      return { kind: "none", blocked: true };
    case "kp": {
      const key = keyOfUsage(binding.param1);
      return key ? { kind: "key", ...key } : { kind: "other", label: name };
    }
    case "mo":
    case "to":
    case "tog":
      return { kind: "layer", layer: layer(binding.param1) };
    case "lt": {
      const tap = keyOfUsage(binding.param2);
      if (!tap) return { kind: "layer", layer: layer(binding.param1) };
      return { kind: "key", ...tap, holdLayer: layer(binding.param1) };
    }
    case "mt": {
      const tap = keyOfUsage(binding.param2);
      if (!tap) return { kind: "none" };
      const hold = keyOfUsage(binding.param1);
      return { kind: "key", ...tap, ...(hold ? { hold: hold.code } : {}) };
    }
    case "mkp": {
      const button = MOUSE_MASK.indexOf(binding.param1);
      return button >= 0
        ? { kind: "mouse", button }
        : { kind: "other", label: name };
    }
    default: {
      // The custom click behaviors of these keyboards (drag_lclk...).
      const click = /(l|r|m)clk$/i.exec(name);
      if (click)
        return {
          kind: "mouse",
          button: { l: 0, r: 2, m: 1 }[
            click[1].toLowerCase() as "l" | "r" | "m"
          ],
        };
      return { kind: "other", label: name };
    }
  }
}

/**
 * The binding that sends `trigger`, or null when the keyboard has no
 * behavior for it. `layerIdOf` turns a working-keymap layer index into
 * the device's layer id.
 */
export function triggerToBinding(
  trigger: Trigger,
  ids: BehaviorIds,
  layerIdOf: (index: number) => number | undefined,
  /** The tap dance slot set up for a key that needs one. */
  slot?: number,
): BehaviorBinding | null {
  const make = (
    role: BehaviorRole,
    param1 = 0,
    param2 = 0,
  ): BehaviorBinding | null => {
    const behaviorId = ids[role];
    return behaviorId === undefined ? null : { behaviorId, param1, param2 };
  };
  switch (trigger.kind) {
    case "none":
      return trigger.blocked ? (make("none") ?? make("trans")) : make("trans");
    case "mouse": {
      const mask = MOUSE_MASK[trigger.button];
      return mask === undefined ? null : make("mkp", mask);
    }
    case "layer": {
      if (trigger.layer === undefined) return null;
      const id = layerIdOf(trigger.layer);
      return id === undefined ? null : make("mo", id);
    }
    case "key": {
      const tap = usageOf(trigger.code, trigger.mods);
      if (tap === null) return null;
      // A tap dance is a slot of the runtime tap dance module, set up
      // beforehand; the key binds the slot.
      if (needsTapDance(trigger))
        return slot === undefined ? null : make("rtd", slot);
      if (trigger.holdLayer !== undefined) {
        const id = layerIdOf(trigger.holdLayer);
        return id === undefined ? null : make("lt", id, tap);
      }
      if (trigger.hold) {
        const hold = usageOf(trigger.hold, []);
        return hold === null ? null : make("mt", hold, tap);
      }
      return make("kp", tap);
    }
    case "other":
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* The connected keyboard as a board                                    */
/* ------------------------------------------------------------------ */

/** The registered board a connected ZMK keyboard corresponds to. */
export function boardIdForDevice(
  deviceName: string | undefined,
): string | null {
  const n = (deviceName ?? "").trim().toLowerCase();
  if (n.includes("ergotrack")) return "clickboard_ergotrack";
  if (n.includes("goforty-max") || n.includes("gofortymax"))
    return "goforty_max_ortho";
  return null;
}

/**
 * The layers of the keymap the guide works in: on a keyboard with a block
 * of layers per OS, the current OS's block (its base layer and the three
 * after it); otherwise the whole keymap. Working-keymap layer i is device
 * layer start + i.
 */
export interface LayerBlock {
  start: number;
  size: number;
}

export interface LiveKeyboard {
  board: TestBoard;
  keymap: WorkingKeymap;
  /** Device layer id by working-keymap layer index (the block's layers that exist). */
  layerIds: number[];
  block: LayerBlock;
}

/**
 * A trigger's layer numbers moved from the device's numbering into the
 * block's: a layer outside the block is left alone, as "other", so the
 * guide neither draws nor rewrites it.
 */
export function windowTrigger(t: Trigger, block: LayerBlock): Trigger {
  const inside = (l: number) =>
    l >= block.start && l < block.start + block.size;
  if (t.kind === "key" && t.holdLayer !== undefined) {
    if (inside(t.holdLayer))
      return { ...t, holdLayer: t.holdLayer - block.start };
    return { kind: "other", label: `L${t.holdLayer}` };
  }
  if (t.kind === "layer" && t.layer !== undefined) {
    if (inside(t.layer)) return { ...t, layer: t.layer - block.start };
    return { kind: "other", label: `L${t.layer}` };
  }
  return t;
}

/** The block of the whole keymap: base 0, and at least four layers allowed. */
export function wholeBlock(layerCount: number): LayerBlock {
  return { start: 0, size: Math.max(4, layerCount) };
}

/** The connected keyboard's layout and keymap as the guide uses them. */
export function liveKeyboard(
  id: string,
  name: string,
  layout: PhysicalLayout,
  keymap: Keymap,
  behaviors: Map<number, BehaviorDefinition>,
  labelLayout: LabelLayout,
  block: LayerBlock = wholeBlock(keymap.layers.length),
  dances?: Map<number, Dance>,
): LiveKeyboard {
  const project = importKle(zmkToKle(layout));
  const allIds = keymap.layers.map((l) => l.id);
  const indexOf = (lid: number) => {
    const i = allIds.indexOf(lid);
    return i >= 0 ? i : undefined;
  };
  const inBlock = keymap.layers.slice(block.start, block.start + block.size);
  const layerIds = inBlock.map((l) => l.id);
  const layers: Trigger[][] = inBlock.map((l) =>
    project.keys.map((_, pos) => {
      const b = l.bindings[pos];
      return b
        ? windowTrigger(bindingToTrigger(b, behaviors, indexOf, dances), block)
        : ({ kind: "none" } as Trigger);
    }),
  );
  const keys: TestKey[] = project.keys.map((key, pos) => {
    const trigger = layers[0]?.[pos] ?? { kind: "none" };
    const onLayers = layers
      .map((layer, l) => ({ t: layer[pos], l }))
      .filter(
        ({ t, l }) =>
          l > 0 &&
          (t.kind === "key" ||
            t.kind === "mouse" ||
            (t.kind === "none" && t.blocked)),
      )
      .map(({ t, l }) => ({ layer: l, trigger: t }));
    return {
      id: key.id,
      cx: key.cx,
      cy: key.cy,
      w: key.w,
      h: key.h,
      angle: key.angle,
      trigger,
      ...(onLayers.length ? { onLayers } : {}),
      label: labelOf(trigger, labelLayout),
    };
  });
  return {
    board: { id, name, keys },
    keymap: { layers, maxLayers: block.size },
    layerIds,
    block,
  };
}

/** A change the keyboard could not take, and why. */
export interface Unwritable {
  change: Change;
  /** "tapdance": the key needs a tap dance and the keyboard has no slot or entry for it. */
  reason: "behavior" | "keycode" | "layer" | "rejected" | "tapdance";
}

/**
 * The bindings to write for a set of changes, in order, with the ones
 * the keyboard has no behavior for set aside. Layers beyond the keymap
 * are reported as "layer" and are the caller's to add first.
 */
export function bindingsFor(
  changes: Change[],
  ids: BehaviorIds,
  layerIds: number[],
  /** The tap dance slot set up for a change that needs one. */
  slotOf: (change: Change) => number | undefined = () => undefined,
): {
  writes: Array<{ change: Change; layerId: number; binding: BehaviorBinding }>;
  unwritable: Unwritable[];
} {
  const writes: Array<{
    change: Change;
    layerId: number;
    binding: BehaviorBinding;
  }> = [];
  const unwritable: Unwritable[] = [];
  const layerIdOf = (i: number) => layerIds[i];
  for (const change of changes) {
    const layerId = layerIds[change.layer];
    if (layerId === undefined) {
      unwritable.push({ change, reason: "layer" });
      continue;
    }
    const binding = triggerToBinding(
      change.trigger,
      ids,
      layerIdOf,
      slotOf(change),
    );
    if (!binding) {
      unwritable.push({
        change,
        reason: needsTapDance(change.trigger) ? "tapdance" : "behavior",
      });
      continue;
    }
    writes.push({ change, layerId, binding });
  }
  return { writes, unwritable };
}
