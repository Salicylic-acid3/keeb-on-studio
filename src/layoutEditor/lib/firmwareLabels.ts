/**
 * The legend a keycap would carry for a key of a firmware keymap: a QMK
 * keycode name ("KC_Q", "LT(1, KC_SPC)") or a ZMK binding ("kp Q",
 * "lt 2 SPACE"). A key that sends a plain key gets that key's legend, a
 * hold-tap its tap key, a layer key "Fn"; anything else (transparent,
 * Bluetooth, pointer and other behaviours) gets none.
 */
import { labelForCode, type KeyLabel, type LabelLayout } from "./keyLabels";

/** Firmware key names (QMK without "KC_", and ZMK) to `KeyboardEvent.code`. */
const CODES: Record<string, string> = {
  ENT: "Enter",
  ENTER: "Enter",
  RET: "Enter",
  ESC: "Escape",
  ESCAPE: "Escape",
  BSPC: "Backspace",
  BACKSPACE: "Backspace",
  TAB: "Tab",
  SPC: "Space",
  SPACE: "Space",
  MINS: "Minus",
  MINUS: "Minus",
  EQL: "Equal",
  EQUAL: "Equal",
  LBRC: "BracketLeft",
  LBKT: "BracketLeft",
  RBRC: "BracketRight",
  RBKT: "BracketRight",
  BSLS: "Backslash",
  BSLH: "Backslash",
  NUHS: "Backslash",
  NON_US_HASH: "Backslash",
  SCLN: "Semicolon",
  SEMI: "Semicolon",
  QUOT: "Quote",
  SQT: "Quote",
  GRV: "Backquote",
  GRAVE: "Backquote",
  COMM: "Comma",
  COMMA: "Comma",
  DOT: "Period",
  SLSH: "Slash",
  FSLH: "Slash",
  CAPS: "CapsLock",
  PSCR: "PrintScreen",
  PSCRN: "PrintScreen",
  SCRL: "ScrollLock",
  PAUS: "Pause",
  INS: "Insert",
  HOME: "Home",
  PGUP: "PageUp",
  PG_UP: "PageUp",
  DEL: "Delete",
  DELETE: "Delete",
  END: "End",
  PGDN: "PageDown",
  PG_DN: "PageDown",
  RGHT: "ArrowRight",
  RIGHT: "ArrowRight",
  LEFT: "ArrowLeft",
  DOWN: "ArrowDown",
  UP: "ArrowUp",
  NUM: "NumLock",
  PSLS: "NumpadDivide",
  PAST: "NumpadMultiply",
  PMNS: "NumpadSubtract",
  PPLS: "NumpadAdd",
  PENT: "NumpadEnter",
  PDOT: "NumpadDecimal",
  APP: "ContextMenu",
  K_APP: "ContextMenu",
  INT1: "IntlRo",
  INT_RO: "IntlRo",
  INT2: "KanaMode",
  INT_KANA: "KanaMode",
  INT3: "IntlYen",
  INT_YEN: "IntlYen",
  INT4: "Convert",
  INT_HENKAN: "Convert",
  INT5: "NonConvert",
  INT_MUHENKAN: "NonConvert",
  LNG1: "Lang1",
  LANG1: "Lang1",
  LNG2: "Lang2",
  LANG2: "Lang2",
  LCTL: "ControlLeft",
  LCTRL: "ControlLeft",
  RCTL: "ControlRight",
  RCTRL: "ControlRight",
  LSFT: "ShiftLeft",
  LSHFT: "ShiftLeft",
  LSHIFT: "ShiftLeft",
  RSFT: "ShiftRight",
  RSHFT: "ShiftRight",
  RSHIFT: "ShiftRight",
  LALT: "AltLeft",
  RALT: "AltRight",
  LGUI: "MetaLeft",
  LWIN: "MetaLeft",
  LEFT_WIN: "MetaLeft",
  RGUI: "MetaRight",
  RWIN: "MetaRight",
};

const NONE: KeyLabel = { main: "" };

/** The legend of one plain key name. */
function keyLegend(name: string, layout: LabelLayout): KeyLabel {
  const key = name.replace(/^KC_/, "");
  if (/^[A-Z]$/.test(key)) return { main: key };
  const digit = /^N?(\d)$/.exec(key);
  if (digit) return labelForCode(`Digit${digit[1]}`, layout) ?? NONE;
  if (/^F\d{1,2}$/.test(key)) return { main: key };
  const pad = /^P(\d)$/.exec(key);
  if (pad) return { main: pad[1] };
  // A shifted bracket key of its own ("{").
  if (key === "LCBR") return { main: "{" };
  if (key === "RCBR") return { main: "}" };
  const code = CODES[key];
  return (code && labelForCode(code, layout)) || NONE;
}

/** The legend for a QMK keycode as a keymap.c writes it. */
export function qmkLegend(keycode: string, layout: LabelLayout): KeyLabel {
  const text = keycode.replace(/\s+/g, "");
  if (/^(MO|TG|TO|TT|OSL|DF)\(/.test(text)) return { main: "Fn" };
  // Hold-taps: the tap key is the last argument.
  const wrapped = /^(?:LT|MT|[A-Z]+_T)\((?:.*,)?(KC_\w+)\)$/.exec(text);
  if (wrapped) return keyLegend(wrapped[1], layout);
  if (!/^KC_\w+$/.test(text)) return NONE;
  return keyLegend(text, layout);
}

/** The legend for a ZMK binding without its "&" ("kp Q", "lt 2 SPACE"). */
export function zmkLegend(binding: string, layout: LabelLayout): KeyLabel {
  const [behavior, ...params] = binding.trim().split(/\s+/);
  if (behavior === "kp" && /^\w+$/.test(params[0] ?? ""))
    return keyLegend(params[0], layout);
  if (/^(mt|lt)(_\w+)?$/.test(behavior) && /^\w+$/.test(params[1] ?? ""))
    return keyLegend(params[1], layout);
  if (/^(mo|tog|to|sl)$/.test(behavior)) return { main: "Fn" };
  return NONE;
}
