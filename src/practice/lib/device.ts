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
  extractModifierFlags,
  getHidUsageCode,
  getHidUsagePage,
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
  if (id === undefined) return null;
  return combineWithModifiers(id, flagsOfMods(mods));
}

/** The key code of a HID usage on the keyboard page, with its modifiers. */
function keyOfUsage(usage: number): { code: string; mods: Mod[] } | null {
  if (getHidUsagePage(usage) !== HID_USAGE_PAGE_KEYBOARD) return null;
  const code = CODE_BY_HID[getHidUsageCode(usage)];
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
  | "tog";

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
};

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
): Partial<Record<BehaviorRole, number>> {
  const out: Partial<Record<BehaviorRole, number>> = {};
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

const MOUSE_MASK = [1, 4, 2, 8, 16]; // Trigger.button 0..4 = L, M, R, B4, B5

/** A device binding as a trigger. `layerIndexOf` turns a layer id into its index. */
export function bindingToTrigger(
  binding: BehaviorBinding,
  behaviors: Map<number, BehaviorDefinition>,
  layerIndexOf: (id: number) => number | undefined,
): Trigger {
  const def = behaviors.get(binding.behaviorId);
  const name = def?.displayName ?? `#${binding.behaviorId}`;
  const role = behaviorRole(name);
  const layer = (id: number) => layerIndexOf(id) ?? id;
  switch (role) {
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
  ids: Partial<Record<BehaviorRole, number>>,
  layerIdOf: (index: number) => number | undefined,
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

export interface LiveKeyboard {
  board: TestBoard;
  keymap: WorkingKeymap;
  /** Device layer id by working-keymap layer index. */
  layerIds: number[];
}

/** The connected keyboard's layout and keymap as the guide uses them. */
export function liveKeyboard(
  id: string,
  name: string,
  layout: PhysicalLayout,
  keymap: Keymap,
  behaviors: Map<number, BehaviorDefinition>,
  labelLayout: LabelLayout,
): LiveKeyboard {
  const project = importKle(zmkToKle(layout));
  const layerIds = keymap.layers.map((l) => l.id);
  const indexOf = (lid: number) => {
    const i = layerIds.indexOf(lid);
    return i >= 0 ? i : undefined;
  };
  const layers: Trigger[][] = keymap.layers.map((l) =>
    project.keys.map((_, pos) => {
      const b = l.bindings[pos];
      return b
        ? bindingToTrigger(b, behaviors, indexOf)
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
  return { board: { id, name, keys }, keymap: { layers }, layerIds };
}

/** A change the keyboard could not take, and why. */
export interface Unwritable {
  change: Change;
  reason: "behavior" | "keycode" | "layer" | "rejected";
}

/**
 * The bindings to write for a set of changes, in order, with the ones
 * the keyboard has no behavior for set aside. Layers beyond the keymap
 * are reported as "layer" and are the caller's to add first.
 */
export function bindingsFor(
  changes: Change[],
  ids: Partial<Record<BehaviorRole, number>>,
  layerIds: number[],
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
    const binding = triggerToBinding(change.trigger, ids, layerIdOf);
    if (!binding) {
      unwritable.push({ change, reason: "behavior" });
      continue;
    }
    writes.push({ change, layerId, binding });
  }
  return { writes, unwritable };
}
