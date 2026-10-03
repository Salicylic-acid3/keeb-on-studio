/**
 * What to print on a key for a QMK keycode. Plain keys reuse the HID usage
 * labels (and the JIS/US mapping) of the ZMK side; QMK's own forms get the
 * short notation people know from Vial and keymap.c.
 */
import { getKeycodeByCode } from "../../../lib/keycodes";
import {
  mapToLayout,
  type KeyboardLayoutType,
} from "../../../lib/keyboardLayouts";
import {
  decodeKeycode,
  formatKeycode,
  keycodeShortName,
  MOD_LALT,
  MOD_LCTL,
  MOD_LGUI,
  MOD_LSFT,
  MOD_RIGHT,
  type QmkKey,
} from "./qmkKeycode";

export interface QmkKeyLabel {
  /** Short text for the keycap. */
  short: string;
  /** Longer text for tooltips. */
  long: string;
}

/**
 * QMK puts media, mouse and system keys at 0xA5-0xDF, where the HID keyboard
 * page has nothing useful; those get their own captions.
 */
const QMK_BASIC_CAPTIONS: Record<string, string> = {
  KC_MUTE: "Mute",
  KC_VOLU: "Vol+",
  KC_VOLD: "Vol-",
  KC_MNXT: "Next",
  KC_MPRV: "Prev",
  KC_MSTP: "Stop",
  KC_MPLY: "Play",
  KC_MSEL: "Media",
  KC_EJCT: "Eject",
  KC_MFFD: "Fwd",
  KC_MRWD: "Rew",
  KC_BRIU: "Bri+",
  KC_BRID: "Bri-",
  KC_PWR: "Power",
  KC_SLEP: "Sleep",
  KC_WAKE: "Wake",
  KC_MAIL: "Mail",
  KC_CALC: "Calc",
  KC_MYCM: "My PC",
  KC_WSCH: "Search",
  KC_WHOM: "Home",
  KC_WBAK: "Back",
  KC_WFWD: "Fwd",
  KC_WSTP: "Stop",
  KC_WREF: "Reload",
  KC_WFAV: "Fav",
  MS_UP: "Ms ↑",
  MS_DOWN: "Ms ↓",
  MS_LEFT: "Ms ←",
  MS_RGHT: "Ms →",
  MS_BTN1: "Ms 1",
  MS_BTN2: "Ms 2",
  MS_BTN3: "Ms 3",
  MS_BTN4: "Ms 4",
  MS_BTN5: "Ms 5",
  MS_WHLU: "Whl ↑",
  MS_WHLD: "Whl ↓",
  MS_WHLL: "Whl ←",
  MS_WHLR: "Whl →",
  MS_ACL0: "Acl 0",
  MS_ACL1: "Acl 1",
  MS_ACL2: "Acl 2",
};

const QMK_ONLY_BASIC_MIN = 0xa5;
const QMK_ONLY_BASIC_MAX = 0xdf;

function basicLabel(code: number, layout?: KeyboardLayoutType): QmkKeyLabel {
  if (code === 0x0000) return { short: "", long: "KC_NO" };
  if (code === 0x0001) return { short: "▽", long: "KC_TRNS (transparent)" };
  if (code >= QMK_ONLY_BASIC_MIN && code <= QMK_ONLY_BASIC_MAX) {
    const name = keycodeShortName(code) ?? `0x${code.toString(16)}`;
    return { short: QMK_BASIC_CAPTIONS[name] ?? namedShort(name), long: name };
  }
  const def = getKeycodeByCode(code);
  if (def) {
    const mapped = mapToLayout(def, layout);
    return { short: mapped.displayName, long: mapped.name };
  }
  return {
    short: keycodeShortName(code) ?? `0x${code.toString(16)}`,
    long: keycodeShortName(code) ?? "",
  };
}

function modsLabel(mods: number, separator = "+"): string {
  const right = (mods & MOD_RIGHT) !== 0;
  const parts: string[] = [];
  if (mods & MOD_LCTL) parts.push(right ? "RCtl" : "Ctl");
  if (mods & MOD_LSFT) parts.push(right ? "RSft" : "Sft");
  if (mods & MOD_LALT) parts.push(right ? "RAlt" : "Alt");
  if (mods & MOD_LGUI) parts.push(right ? "RGui" : "Gui");
  return parts.join(separator);
}

/** Strip the QK_/KC_ prefix of a named keycode for the keycap. */
function namedShort(name: string): string {
  return name.replace(/^(QK|KC)_/, "").replace(/_/g, " ");
}

export function qmkKeyLabel(
  key: QmkKey,
  layout?: KeyboardLayoutType,
): QmkKeyLabel {
  const text = formatKeycode(key);
  switch (key.kind) {
    case "basic":
      return basicLabel(key.code, layout);
    case "mods":
      return {
        short: `${modsLabel(key.mods)}+${basicLabel(key.code, layout).short}`,
        long: text,
      };
    case "modTap":
      return {
        short: `${basicLabel(key.code, layout).short} / ${modsLabel(key.mods)}`,
        long: text,
      };
    case "layerTap":
      return {
        short: `${basicLabel(key.code, layout).short} / L${key.layer}`,
        long: text,
      };
    case "layer":
      return { short: `${key.op} ${key.layer}`, long: text };
    case "layerMod":
      return { short: `L${key.layer}+${modsLabel(key.mods)}`, long: text };
    case "oneShotMod":
      return { short: `OS ${modsLabel(key.mods)}`, long: text };
    case "tapDance":
      return { short: `TD ${key.index}`, long: text };
    case "macro":
      return { short: `M${key.index}`, long: text };
    case "named":
      return {
        short: namedShort(keycodeShortName(key.code) ?? key.name),
        long: text,
      };
    case "unknown":
      return { short: text, long: text };
  }
}

export function qmkKeycodeLabel(
  code: number,
  layout?: KeyboardLayoutType,
): QmkKeyLabel {
  return qmkKeyLabel(decodeKeycode(code), layout);
}
