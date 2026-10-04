/**
 * The shared keymap UI (KeyboardLayout, KeycodeSelector, QuickAssignBar)
 * speaks ZMK: a keymap is layers of {behaviorId, param1, param2}, behaviors
 * are a map of {id, displayName, metadata}, and plain keys are HID usages
 * with ZMK's modifier flags in the top byte.
 *
 * A QMK keymap is layers of 16-bit numbers. This module makes QMK look like
 * ZMK to that UI: a fixed list of pretend behaviors ("Key Press", "Momentary
 * Layer", "Mod-Tap", ...) and a lossless translation both ways. Anything the
 * UI can express that QMK cannot (a left and a right modifier in one key)
 * comes back as an error rather than a silently different key.
 */
import type { BehaviorBinding } from "../../hooks/useKeymap";
import type { BehaviorDefinition } from "../../hooks/useKeymapSource";
import {
  createHidUsage,
  combineWithModifiers,
  decodeMouseMove,
  encodeMouseMove,
  extractModifierFlags,
  dropModifierFlags,
  getHidUsagePage,
  getHidUsageCode,
  HID_USAGE_PAGE_CONSUMER,
  HID_USAGE_PAGE_KEYBOARD,
  ZMK_POINTING_DEFAULT_MOVE_VAL,
  ZMK_POINTING_DEFAULT_SCRL_VAL,
} from "../../lib/keycodes";
import { registerBehaviorMetadata } from "../../lib/behaviorMetadata";
import {
  decodeKeycode,
  encodeKeycode,
  keycodeByName,
  keycodeShortName,
  keycodeToText,
  KC_NO,
  KC_TRANSPARENT,
  MOD_LALT,
  MOD_LCTL,
  MOD_LGUI,
  MOD_LSFT,
  MOD_RIGHT,
  type LayerOp,
} from "./keycodes/qmkKeycode";

/** Pretend behavior ids. Stable: shares and saved keymaps never see them. */
export const QMK_BEHAVIOR = {
  keyPress: 1,
  momentaryLayer: 2,
  toLayer: 3,
  toggleLayer: 4,
  layerTap: 5,
  trans: 6,
  none: 7,
  modTap: 8,
  stickyKey: 9,
  stickyLayer: 10,
  tapDance: 11,
  macro: 12,
  bootloader: 13,
  sysReset: 14,
  mouseButton: 15,
  mouseMove: 16,
  mouseScroll: 17,
  layerTapToggle: 18,
  defaultLayer: 19,
  mouseSpeed: 20,
  qmkKeycode: 21,
} as const;

const LAYER_BEHAVIOR_BY_OP: Record<LayerOp, number> = {
  MO: QMK_BEHAVIOR.momentaryLayer,
  TO: QMK_BEHAVIOR.toLayer,
  TG: QMK_BEHAVIOR.toggleLayer,
  OSL: QMK_BEHAVIOR.stickyLayer,
  TT: QMK_BEHAVIOR.layerTapToggle,
  DF: QMK_BEHAVIOR.defaultLayer,
};
const OP_BY_LAYER_BEHAVIOR = new Map<number, LayerOp>(
  (Object.entries(LAYER_BEHAVIOR_BY_OP) as Array<[LayerOp, number]>).map(
    ([op, id]) => [id, op],
  ),
);

/** QMK media/system keys <-> HID consumer page usages. */
const CONSUMER_BY_QMK_NAME: Record<string, number> = {
  KC_MUTE: 0xe2,
  KC_VOLU: 0xe9,
  KC_VOLD: 0xea,
  KC_MPLY: 0xcd,
  KC_MNXT: 0xb5,
  KC_MPRV: 0xb6,
  KC_MSTP: 0xb7,
  KC_EJCT: 0xb8,
  KC_MFFD: 0xb3,
  KC_MRWD: 0xb4,
  KC_BRIU: 0x6f,
  KC_BRID: 0x70,
  KC_MSEL: 0x183,
  KC_MYCM: 0x194,
  KC_CALC: 0x192,
  KC_MAIL: 0x18a,
  KC_WSCH: 0x221,
  KC_WHOM: 0x223,
  KC_WBAK: 0x224,
  KC_WFWD: 0x225,
  KC_WSTP: 0x226,
  KC_WREF: 0x227,
  KC_WFAV: 0x22a,
};
const QMK_NAME_BY_CONSUMER = new Map(
  Object.entries(CONSUMER_BY_QMK_NAME).map(([name, usage]) => [usage, name]),
);

const MOUSE_BUTTON_BY_QMK_NAME: Record<string, number> = {
  MS_BTN1: 1,
  MS_BTN2: 2,
  MS_BTN3: 4,
  MS_BTN4: 8,
  MS_BTN5: 16,
};
const QMK_NAME_BY_MOUSE_BUTTON = new Map(
  Object.entries(MOUSE_BUTTON_BY_QMK_NAME).map(([name, value]) => [
    value,
    name,
  ]),
);

const MOUSE_SPEED_NAMES = ["MS_ACL0", "MS_ACL1", "MS_ACL2"];

/** ZMK modifier flag bits (bits 24-31 of a usage) <-> QMK 5-bit mask. */
const ZMK_MOD_FLAGS = {
  LC: 0x01,
  LS: 0x02,
  LA: 0x04,
  LG: 0x08,
  RC: 0x10,
  RS: 0x20,
  RA: 0x40,
  RG: 0x80,
};

export class QmkBridgeError extends Error {}

export function qmkModsToZmkFlags(mods: number): number {
  const right = (mods & MOD_RIGHT) !== 0;
  let flags = 0;
  if (mods & MOD_LCTL) flags |= right ? ZMK_MOD_FLAGS.RC : ZMK_MOD_FLAGS.LC;
  if (mods & MOD_LSFT) flags |= right ? ZMK_MOD_FLAGS.RS : ZMK_MOD_FLAGS.LS;
  if (mods & MOD_LALT) flags |= right ? ZMK_MOD_FLAGS.RA : ZMK_MOD_FLAGS.LA;
  if (mods & MOD_LGUI) flags |= right ? ZMK_MOD_FLAGS.RG : ZMK_MOD_FLAGS.LG;
  return flags;
}

export function zmkFlagsToQmkMods(flags: number): number {
  const left = flags & 0x0f;
  const right = (flags >> 4) & 0x0f;
  if (left && right) {
    throw new QmkBridgeError(
      "QMK cannot mix left and right modifiers on one key",
    );
  }
  return right ? right | MOD_RIGHT : left;
}

/** The modifier keys themselves: KC_LCTL..KC_RGUI are 0xE0..0xE7. */
function modKeyToMask(code: number): number | null {
  if (code < 0xe0 || code > 0xe7) return null;
  const bit = 1 << (code - 0xe0);
  return bit <= 0x08 ? bit : (bit >> 4) | MOD_RIGHT;
}
function maskToModKey(mods: number): number {
  const base = mods & 0x0f;
  const first = base & -base; // lowest set bit
  const index = Math.log2(first);
  return 0xe0 + index + (mods & MOD_RIGHT ? 4 : 0);
}

/** QMK basic keycode -> ZMK usage (keyboard or consumer page), or null. */
function basicToUsage(code: number): number | null {
  if ((code >= 0x04 && code <= 0xa4) || (code >= 0xe0 && code <= 0xe7)) {
    return createHidUsage(HID_USAGE_PAGE_KEYBOARD, code);
  }
  const name = keycodeShortName(code);
  const consumer = name ? CONSUMER_BY_QMK_NAME[name] : undefined;
  return consumer === undefined
    ? null
    : createHidUsage(HID_USAGE_PAGE_CONSUMER, consumer);
}

/** ZMK usage (no flags) -> QMK basic keycode, or null. */
function usageToBasic(usage: number): number | null {
  const bare = dropModifierFlags(usage);
  const page = getHidUsagePage(bare);
  const code = getHidUsageCode(bare);
  if (page === HID_USAGE_PAGE_KEYBOARD || page === 0) {
    return code <= 0xff ? code : null;
  }
  if (page === HID_USAGE_PAGE_CONSUMER) {
    const name = QMK_NAME_BY_CONSUMER.get(code);
    return name ? (keycodeByName(name) ?? null) : null;
  }
  return null;
}

// ---- QMK -> ZMK ---------------------------------------------------------

export function keycodeToBinding(code: number): BehaviorBinding {
  const key = decodeKeycode(code);
  const b = (behaviorId: number, param1 = 0, param2 = 0): BehaviorBinding => ({
    behaviorId,
    param1,
    param2,
  });
  switch (key.kind) {
    case "basic": {
      if (key.code === KC_NO) return b(QMK_BEHAVIOR.none);
      if (key.code === KC_TRANSPARENT) return b(QMK_BEHAVIOR.trans);
      const name = keycodeShortName(key.code);
      if (name && name in MOUSE_BUTTON_BY_QMK_NAME) {
        return b(QMK_BEHAVIOR.mouseButton, MOUSE_BUTTON_BY_QMK_NAME[name]);
      }
      if (name && MOUSE_SPEED_NAMES.includes(name)) {
        return b(QMK_BEHAVIOR.mouseSpeed, MOUSE_SPEED_NAMES.indexOf(name));
      }
      const m = ZMK_POINTING_DEFAULT_MOVE_VAL;
      const s = ZMK_POINTING_DEFAULT_SCRL_VAL;
      switch (name) {
        case "MS_UP":
          return b(QMK_BEHAVIOR.mouseMove, encodeMouseMove(0, -m));
        case "MS_DOWN":
          return b(QMK_BEHAVIOR.mouseMove, encodeMouseMove(0, m));
        case "MS_LEFT":
          return b(QMK_BEHAVIOR.mouseMove, encodeMouseMove(-m, 0));
        case "MS_RGHT":
          return b(QMK_BEHAVIOR.mouseMove, encodeMouseMove(m, 0));
        case "MS_WHLU":
          return b(QMK_BEHAVIOR.mouseScroll, encodeMouseMove(0, s));
        case "MS_WHLD":
          return b(QMK_BEHAVIOR.mouseScroll, encodeMouseMove(0, -s));
        case "MS_WHLL":
          return b(QMK_BEHAVIOR.mouseScroll, encodeMouseMove(-s, 0));
        case "MS_WHLR":
          return b(QMK_BEHAVIOR.mouseScroll, encodeMouseMove(s, 0));
      }
      const usage = basicToUsage(key.code);
      if (usage !== null) return b(QMK_BEHAVIOR.keyPress, usage);
      return b(QMK_BEHAVIOR.qmkKeycode, code);
    }
    case "mods": {
      const usage = basicToUsage(key.code);
      if (usage === null) return b(QMK_BEHAVIOR.qmkKeycode, code);
      return b(
        QMK_BEHAVIOR.keyPress,
        combineWithModifiers(usage, qmkModsToZmkFlags(key.mods)),
      );
    }
    case "modTap": {
      const usage = basicToUsage(key.code);
      if (usage === null || !(key.mods & 0x0f))
        return b(QMK_BEHAVIOR.qmkKeycode, code);
      // ZMK's MT takes a modifier *key*; extra modifiers ride as flags on it.
      const first = maskToModKey(key.mods);
      const rest = key.mods & ~modKeyToMask(first)! & 0x0f;
      const restFlags = qmkModsToZmkFlags(rest | (key.mods & MOD_RIGHT));
      return b(
        QMK_BEHAVIOR.modTap,
        combineWithModifiers(
          createHidUsage(HID_USAGE_PAGE_KEYBOARD, first),
          rest ? restFlags : 0,
        ),
        usage,
      );
    }
    case "layerTap": {
      const usage = basicToUsage(key.code);
      if (usage === null) return b(QMK_BEHAVIOR.qmkKeycode, code);
      return b(QMK_BEHAVIOR.layerTap, key.layer, usage);
    }
    case "layer":
      return b(LAYER_BEHAVIOR_BY_OP[key.op], key.layer);
    case "oneShotMod": {
      if (!(key.mods & 0x0f)) return b(QMK_BEHAVIOR.qmkKeycode, code);
      const first = maskToModKey(key.mods);
      const rest = key.mods & ~modKeyToMask(first)! & 0x0f;
      return b(
        QMK_BEHAVIOR.stickyKey,
        combineWithModifiers(
          createHidUsage(HID_USAGE_PAGE_KEYBOARD, first),
          rest ? qmkModsToZmkFlags(rest | (key.mods & MOD_RIGHT)) : 0,
        ),
      );
    }
    case "tapDance":
      return b(QMK_BEHAVIOR.tapDance, key.index);
    case "macro":
      return b(QMK_BEHAVIOR.macro, key.index);
    case "named":
      if (key.code === keycodeByName("QK_BOOT"))
        return b(QMK_BEHAVIOR.bootloader);
      if (key.code === keycodeByName("QK_RBT")) return b(QMK_BEHAVIOR.sysReset);
      return b(QMK_BEHAVIOR.qmkKeycode, code);
    case "layerMod":
    case "unknown":
      return b(QMK_BEHAVIOR.qmkKeycode, code);
  }
}

// ---- ZMK -> QMK ---------------------------------------------------------

function requireBasic(usage: number, what: string): number {
  const code = usageToBasic(usage);
  if (code === null)
    throw new QmkBridgeError(`${what}: no QMK keycode for that key`);
  return code;
}

/** Throws QmkBridgeError when the binding has no QMK equivalent. */
export function bindingToKeycode(binding: BehaviorBinding): number {
  const { behaviorId, param1, param2 } = binding;
  switch (behaviorId) {
    case QMK_BEHAVIOR.keyPress: {
      const code = requireBasic(param1, "Key Press");
      const mods = zmkFlagsToQmkMods(extractModifierFlags(param1));
      return mods ? encodeKeycode({ kind: "mods", mods, code }) : code;
    }
    case QMK_BEHAVIOR.modTap: {
      const modKey = requireBasic(param1, "Mod-Tap");
      const base = modKeyToMask(modKey);
      if (base === null)
        throw new QmkBridgeError("Mod-Tap: the first key must be a modifier");
      const extra = zmkFlagsToQmkMods(extractModifierFlags(param1));
      if (extra && (extra & MOD_RIGHT) !== (base & MOD_RIGHT)) {
        throw new QmkBridgeError(
          "QMK cannot mix left and right modifiers on one key",
        );
      }
      return encodeKeycode({
        kind: "modTap",
        mods: base | extra,
        code: requireBasic(param2, "Mod-Tap"),
      });
    }
    case QMK_BEHAVIOR.layerTap:
      return encodeKeycode({
        kind: "layerTap",
        layer: param1,
        code: requireBasic(param2, "Layer-Tap"),
      });
    case QMK_BEHAVIOR.stickyKey: {
      const modKey = requireBasic(param1, "Sticky Key");
      const base = modKeyToMask(modKey);
      if (base === null)
        throw new QmkBridgeError("QMK one-shot keys are modifiers only");
      const extra = zmkFlagsToQmkMods(extractModifierFlags(param1));
      return encodeKeycode({ kind: "oneShotMod", mods: base | extra });
    }
    case QMK_BEHAVIOR.trans:
      return KC_TRANSPARENT;
    case QMK_BEHAVIOR.none:
      return KC_NO;
    case QMK_BEHAVIOR.tapDance:
      return encodeKeycode({ kind: "tapDance", index: param1 });
    case QMK_BEHAVIOR.macro:
      return encodeKeycode({ kind: "macro", index: param1 });
    case QMK_BEHAVIOR.bootloader:
      return keycodeByName("QK_BOOT")!;
    case QMK_BEHAVIOR.sysReset:
      return keycodeByName("QK_RBT")!;
    case QMK_BEHAVIOR.mouseButton: {
      const name = QMK_NAME_BY_MOUSE_BUTTON.get(param1);
      if (!name) throw new QmkBridgeError("Mouse button: pick one button");
      return keycodeByName(name)!;
    }
    case QMK_BEHAVIOR.mouseSpeed:
      return keycodeByName(MOUSE_SPEED_NAMES[param1] ?? "MS_ACL0")!;
    case QMK_BEHAVIOR.mouseMove:
    case QMK_BEHAVIOR.mouseScroll: {
      // QMK moves in fixed steps, so only the direction survives.
      const { x, y } = decodeMouseMove(param1);
      const scroll = behaviorId === QMK_BEHAVIOR.mouseScroll;
      if (x === 0 && y === 0)
        throw new QmkBridgeError("Mouse: pick a direction");
      const horizontal = Math.abs(x) >= Math.abs(y);
      const name = scroll
        ? horizontal
          ? x > 0
            ? "MS_WHLR"
            : "MS_WHLL"
          : y > 0
            ? "MS_WHLU"
            : "MS_WHLD"
        : horizontal
          ? x > 0
            ? "MS_RGHT"
            : "MS_LEFT"
          : y > 0
            ? "MS_DOWN"
            : "MS_UP";
      return keycodeByName(name)!;
    }
    case QMK_BEHAVIOR.qmkKeycode:
      return param1 & 0xffff;
    default: {
      const op = OP_BY_LAYER_BEHAVIOR.get(behaviorId);
      if (op) return encodeKeycode({ kind: "layer", op, layer: param1 });
      throw new QmkBridgeError(`Unknown behavior ${behaviorId}`);
    }
  }
}

// ---- The pretend behavior list ------------------------------------------

// Parameter names are what the picker shows ("Select Keycode"), so they use
// the same words ZMK firmware does.
const hid = {
  name: "Keycode",
  hidUsage: { keyboardMax: 0xff, consumerMax: 0x2ff },
};
const modKey = {
  name: "Modifier",
  hidUsage: { keyboardMax: 0xff, consumerMax: 0 },
};
const layer = { name: "Layer", layerId: {} };
const nil = { name: "None", nil: {} };
function def(
  id: number,
  displayName: string,
  param1: object[] = [nil],
  param2: object[] = [nil],
): BehaviorDefinition {
  return {
    id,
    displayName,
    metadata: [
      {
        param1: param1 as BehaviorDefinition["metadata"][number]["param1"],
        param2: param2 as BehaviorDefinition["metadata"][number]["param2"],
      },
    ],
  };
}

export interface QmkBehaviorOptions {
  tapDanceCount: number;
  macroCount: number;
}

export function qmkBehaviors(
  options: QmkBehaviorOptions,
): Map<number, BehaviorDefinition> {
  const list: BehaviorDefinition[] = [
    def(QMK_BEHAVIOR.keyPress, "Key Press", [hid]),
    def(QMK_BEHAVIOR.momentaryLayer, "Momentary Layer", [layer]),
    def(QMK_BEHAVIOR.toLayer, "To Layer", [layer]),
    def(QMK_BEHAVIOR.toggleLayer, "Toggle Layer", [layer]),
    def(QMK_BEHAVIOR.layerTap, "Layer-Tap", [layer], [hid]),
    def(QMK_BEHAVIOR.trans, "Trans"),
    def(QMK_BEHAVIOR.none, "None"),
    def(QMK_BEHAVIOR.modTap, "Mod-Tap", [modKey], [hid]),
    def(QMK_BEHAVIOR.stickyKey, "Sticky Key", [modKey]),
    def(QMK_BEHAVIOR.stickyLayer, "Sticky Layer", [layer]),
    def(QMK_BEHAVIOR.layerTapToggle, "Layer Tap-Toggle", [layer]),
    def(QMK_BEHAVIOR.defaultLayer, "Default Layer", [layer]),
    def(QMK_BEHAVIOR.bootloader, "Bootloader"),
    def(QMK_BEHAVIOR.sysReset, "System Reset"),
    def(QMK_BEHAVIOR.mouseButton, "Mouse Key Press", [
      { name: "Mouse button", range: { min: 1, max: 16 } },
    ]),
    def(QMK_BEHAVIOR.mouseMove, "Mouse Move", [
      { name: "Direction", range: { min: 0, max: 0xffffffff } },
    ]),
    def(QMK_BEHAVIOR.mouseScroll, "Mouse Scroll", [
      { name: "Direction", range: { min: 0, max: 0xffffffff } },
    ]),
    def(
      QMK_BEHAVIOR.mouseSpeed,
      "Mouse Speed",
      MOUSE_SPEED_NAMES.map((name, i) => ({
        constant: i,
        name: name.replace("MS_ACL", "Speed "),
      })),
    ),
    def(QMK_BEHAVIOR.qmkKeycode, "QMK Keycode", [
      { name: "Keycode number", range: { min: 0, max: 0xffff } },
    ]),
  ];
  if (options.tapDanceCount > 0) {
    list.push(
      def(QMK_BEHAVIOR.tapDance, "Tap Dance", [
        {
          name: "Tap dance",
          range: { min: 0, max: options.tapDanceCount - 1 },
        },
      ]),
    );
  }
  if (options.macroCount > 0) {
    list.push(
      def(QMK_BEHAVIOR.macro, "Runtime Macro", [
        { name: "Macro", range: { min: 0, max: options.macroCount - 1 } },
      ]),
    );
  }
  return new Map(list.map((b) => [b.id, b]));
}

/** Names QMK adds beyond ZMK's, so the picker and keycaps know them. */
registerBehaviorMetadata([
  {
    category: "layer",
    displayNameVariants: ["Layer Tap-Toggle", "tt"],
    shortCode: "TT",
    param1Type: "layer",
    getDisplayText: (binding, context) =>
      `TT ${context.shortFormat ? binding.param1 : (context.layers?.[binding.param1]?.name ?? binding.param1)}`,
    description: "Layer while held; tap several times to lock it",
  },
  {
    category: "layer",
    displayNameVariants: ["Default Layer", "df"],
    shortCode: "DF",
    param1Type: "layer",
    getDisplayText: (binding, context) =>
      `DF ${context.shortFormat ? binding.param1 : (context.layers?.[binding.param1]?.name ?? binding.param1)}`,
    description: "Make this layer the default",
  },
  {
    category: "mouse",
    displayNameVariants: ["Mouse Speed"],
    shortCode: "ACL",
    param1Type: "number",
    param1ValueMap: { 0: "Speed 0", 1: "Speed 1", 2: "Speed 2" },
    getDisplayText: (binding) => `ACL ${binding.param1}`,
    description: "Mouse cursor speed while held",
  },
  {
    category: "others",
    displayNameVariants: ["QMK Keycode"],
    shortCode: "QMK",
    param1Type: "number",
    getDisplayText: (binding) => keycodeToText(binding.param1),
    description: "Any QMK keycode, by number",
  },
]);
