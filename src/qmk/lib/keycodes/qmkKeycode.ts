/**
 * QMK keycode codec (Vial protocol 6 numbering).
 *
 * A QMK keymap position is one 16-bit number. The high bits say what kind of
 * key it is (plain, modifier combination, mod-tap, layer-tap, layer switch,
 * tap dance, macro, ...) and the low bits carry the parameters. This module
 * turns that number into a structured value and back, and into the textual
 * form QMK users already know (`LT(1,KC_SPC)`, `LCTL(KC_C)`, `MO(3)`).
 *
 * Shared files and the gallery store the textual form, never the number: a
 * future QMK renumbering must not silently change what a saved keymap means.
 */
import { QMK_KEYCODES, QMK_KEYCODE_ALIASES } from "./qmkKeycodesV6.generated";

export const KC_NO = 0x0000;
export const KC_TRANSPARENT = 0x0001;

// Range starts from `enum qk_keycode_ranges`.
const QK_BASIC_MAX = 0x00ff;
const QK_MODS = 0x0100;
const QK_MODS_MAX = 0x1fff;
const QK_MOD_TAP = 0x2000;
const QK_MOD_TAP_MAX = 0x3fff;
const QK_LAYER_TAP = 0x4000;
const QK_LAYER_TAP_MAX = 0x4fff;
const QK_LAYER_MOD = 0x5000;
const QK_LAYER_MOD_MAX = 0x51ff;
const QK_TO = 0x5200;
const QK_MOMENTARY = 0x5220;
const QK_DEF_LAYER = 0x5240;
const QK_TOGGLE_LAYER = 0x5260;
const QK_ONE_SHOT_LAYER = 0x5280;
const QK_ONE_SHOT_MOD = 0x52a0;
const QK_LAYER_TAP_TOGGLE = 0x52c0;
const QK_TAP_DANCE = 0x5700;
const QK_TAP_DANCE_MAX = 0x57ff;
const QK_MACRO = 0x7700;
const QK_MACRO_MAX = 0x777f;

/** 5-bit modifier mask as used by MT(), OSM(), LM(): bit 4 = right-hand. */
export const MOD_LCTL = 0x01;
export const MOD_LSFT = 0x02;
export const MOD_LALT = 0x04;
export const MOD_LGUI = 0x08;
export const MOD_RIGHT = 0x10;

export type LayerOp = "MO" | "TO" | "DF" | "TG" | "OSL" | "TT";

export type QmkKey =
  | { kind: "basic"; code: number }
  | { kind: "mods"; mods: number; code: number }
  | { kind: "modTap"; mods: number; code: number }
  | { kind: "layerTap"; layer: number; code: number }
  | { kind: "layer"; op: LayerOp; layer: number }
  | { kind: "layerMod"; layer: number; mods: number }
  | { kind: "oneShotMod"; mods: number }
  | { kind: "tapDance"; index: number }
  | { kind: "macro"; index: number }
  | { kind: "named"; name: string; code: number }
  | { kind: "unknown"; code: number };

const NAME_BY_CODE = new Map<number, string>();
const CODE_BY_NAME = new Map<string, number>();
for (const [name, code] of QMK_KEYCODES) {
  if (!NAME_BY_CODE.has(code)) NAME_BY_CODE.set(code, name);
  CODE_BY_NAME.set(name, code);
}
for (const [alias, name] of QMK_KEYCODE_ALIASES) {
  const code = CODE_BY_NAME.get(name);
  if (code !== undefined) CODE_BY_NAME.set(alias, code);
}

/** The short alias QMK users write (KC_SPC rather than KC_SPACE). */
const SHORT_NAME_BY_CODE = new Map<number, string>();
for (const [alias, name] of QMK_KEYCODE_ALIASES) {
  const code = CODE_BY_NAME.get(name);
  if (code === undefined) continue;
  // Skip the keymap.c fillers (_______ / XXXXXXX) and take the shortest
  // letter-led alias, which is the conventional short form (KC_ENT, KC_LCTL,
  // MS_UP). The first alias wins a tie, matching the header's order.
  if (!/^[A-Z]/.test(alias) || alias === "XXXXXXX") continue;
  const current = SHORT_NAME_BY_CODE.get(code);
  if (current === undefined || alias.length < current.length) {
    SHORT_NAME_BY_CODE.set(code, alias);
  }
}

/** Canonical (long) name of a plain keycode, or undefined. */
export function keycodeName(code: number): string | undefined {
  return NAME_BY_CODE.get(code);
}

/** Preferred short name of a plain keycode: KC_SPC, KC_ENT, QK_BOOT. */
export function keycodeShortName(code: number): string | undefined {
  return SHORT_NAME_BY_CODE.get(code) ?? NAME_BY_CODE.get(code);
}

/** Look up a plain keycode by canonical name or alias. */
export function keycodeByName(name: string): number | undefined {
  return CODE_BY_NAME.get(name);
}

const LAYER_OPS: Array<[LayerOp, number]> = [
  ["TO", QK_TO],
  ["MO", QK_MOMENTARY],
  ["DF", QK_DEF_LAYER],
  ["TG", QK_TOGGLE_LAYER],
  ["OSL", QK_ONE_SHOT_LAYER],
  ["TT", QK_LAYER_TAP_TOGGLE],
];

export function decodeKeycode(code: number): QmkKey {
  code &= 0xffff;
  if (code <= QK_BASIC_MAX) return { kind: "basic", code };
  if (code >= QK_MODS && code <= QK_MODS_MAX) {
    return { kind: "mods", mods: (code >> 8) & 0x1f, code: code & 0xff };
  }
  if (code >= QK_MOD_TAP && code <= QK_MOD_TAP_MAX) {
    return { kind: "modTap", mods: (code >> 8) & 0x1f, code: code & 0xff };
  }
  if (code >= QK_LAYER_TAP && code <= QK_LAYER_TAP_MAX) {
    return { kind: "layerTap", layer: (code >> 8) & 0x0f, code: code & 0xff };
  }
  if (code >= QK_LAYER_MOD && code <= QK_LAYER_MOD_MAX) {
    return { kind: "layerMod", layer: (code >> 5) & 0x0f, mods: code & 0x1f };
  }
  for (const [op, base] of LAYER_OPS) {
    if (code >= base && code <= base + 0x1f) {
      return { kind: "layer", op, layer: code - base };
    }
  }
  if (code >= QK_ONE_SHOT_MOD && code <= QK_ONE_SHOT_MOD + 0x1f) {
    return { kind: "oneShotMod", mods: code - QK_ONE_SHOT_MOD };
  }
  if (code >= QK_TAP_DANCE && code <= QK_TAP_DANCE_MAX) {
    return { kind: "tapDance", index: code - QK_TAP_DANCE };
  }
  if (code >= QK_MACRO && code <= QK_MACRO_MAX) {
    return { kind: "macro", index: code - QK_MACRO };
  }
  const name = NAME_BY_CODE.get(code);
  if (name) return { kind: "named", name, code };
  return { kind: "unknown", code };
}

export function encodeKeycode(key: QmkKey): number {
  switch (key.kind) {
    case "basic":
      return key.code & 0xff;
    case "mods":
      // The QK_MODS range starts at 0x0100 only because 0x0100 is the LCTL
      // bit: the five modifier bits *are* the range. No base is OR-ed in.
      return ((key.mods & 0x1f) << 8) | (key.code & 0xff);
    case "modTap":
      return QK_MOD_TAP | ((key.mods & 0x1f) << 8) | (key.code & 0xff);
    case "layerTap":
      return QK_LAYER_TAP | ((key.layer & 0x0f) << 8) | (key.code & 0xff);
    case "layerMod":
      return QK_LAYER_MOD | ((key.layer & 0x0f) << 5) | (key.mods & 0x1f);
    case "layer": {
      const base = LAYER_OPS.find(([op]) => op === key.op)![1];
      return base | (key.layer & 0x1f);
    }
    case "oneShotMod":
      return QK_ONE_SHOT_MOD | (key.mods & 0x1f);
    case "tapDance":
      return QK_TAP_DANCE | (key.index & 0xff);
    case "macro":
      return QK_MACRO | (key.index & 0x7f);
    case "named":
    case "unknown":
      return key.code & 0xffff;
  }
}

// ---- textual form -------------------------------------------------------

const MOD_BIT_NAMES: Array<[number, string, string]> = [
  [MOD_LCTL, "LCTL", "RCTL"],
  [MOD_LSFT, "LSFT", "RSFT"],
  [MOD_LALT, "LALT", "RALT"],
  [MOD_LGUI, "LGUI", "RGUI"],
];

/** `MOD_LCTL|MOD_LSFT` for a 5-bit mask. */
export function formatModMask(mods: number): string {
  const right = (mods & MOD_RIGHT) !== 0;
  const parts = MOD_BIT_NAMES.filter(([bit]) => mods & bit).map(
    ([, left, rightName]) => `MOD_${right ? rightName : left}`,
  );
  return parts.length ? parts.join("|") : "0";
}

/** `LCTL(LSFT(x))` wrapping for a 5-bit mask applied to a plain keycode. */
function wrapMods(mods: number, inner: string): string {
  const right = (mods & MOD_RIGHT) !== 0;
  let out = inner;
  for (const [bit, left, rightName] of [...MOD_BIT_NAMES].reverse()) {
    if (mods & bit) out = `${right ? rightName : left}(${out})`;
  }
  return out;
}

function plainName(code: number): string {
  return (
    keycodeShortName(code) ??
    `0x${code.toString(16).toUpperCase().padStart(4, "0")}`
  );
}

/** QMK-style text for a key, as a user would write it in keymap.c. */
export function formatKeycode(key: QmkKey): string {
  switch (key.kind) {
    case "basic":
      return plainName(key.code);
    case "mods":
      return wrapMods(key.mods, plainName(key.code));
    case "modTap":
      return `MT(${formatModMask(key.mods)},${plainName(key.code)})`;
    case "layerTap":
      return `LT(${key.layer},${plainName(key.code)})`;
    case "layer":
      return `${key.op}(${key.layer})`;
    case "layerMod":
      return `LM(${key.layer},${formatModMask(key.mods)})`;
    case "oneShotMod":
      return `OSM(${formatModMask(key.mods)})`;
    case "tapDance":
      return `TD(${key.index})`;
    case "macro":
      return `QK_MACRO_${key.index}`;
    case "named":
      return keycodeShortName(key.code) ?? key.name;
    case "unknown":
      return plainName(key.code);
  }
}

/** Shorthand for the common case: number -> text. */
export function keycodeToText(code: number): string {
  return formatKeycode(decodeKeycode(code));
}

const MOD_NAME_BITS: Record<string, number> = {
  MOD_LCTL: MOD_LCTL,
  MOD_LSFT: MOD_LSFT,
  MOD_LALT: MOD_LALT,
  MOD_LGUI: MOD_LGUI,
  MOD_RCTL: MOD_LCTL | MOD_RIGHT,
  MOD_RSFT: MOD_LSFT | MOD_RIGHT,
  MOD_RALT: MOD_LALT | MOD_RIGHT,
  MOD_RGUI: MOD_LGUI | MOD_RIGHT,
  MOD_HYPR: MOD_LCTL | MOD_LSFT | MOD_LALT | MOD_LGUI,
  MOD_MEH: MOD_LCTL | MOD_LSFT | MOD_LALT,
};

/** Parse `MOD_LCTL|MOD_LSFT` (or a number) into a 5-bit mask. */
export function parseModMask(text: string): number | undefined {
  const trimmed = text.trim();
  if (/^(0x[0-9a-f]+|\d+)$/i.test(trimmed)) return Number(trimmed) & 0x1f;
  let mask = 0;
  for (const part of trimmed.split("|")) {
    const bits = MOD_NAME_BITS[part.trim()];
    if (bits === undefined) return undefined;
    mask |= bits;
  }
  return mask;
}

/** `LCTL(x)` style single-modifier wrappers, and their `_T` mod-tap forms. */
const WRAPPER_MODS: Record<string, number> = {
  LCTL: MOD_LCTL,
  C: MOD_LCTL,
  LSFT: MOD_LSFT,
  S: MOD_LSFT,
  LALT: MOD_LALT,
  A: MOD_LALT,
  LOPT: MOD_LALT,
  LGUI: MOD_LGUI,
  G: MOD_LGUI,
  LCMD: MOD_LGUI,
  LWIN: MOD_LGUI,
  RCTL: MOD_LCTL | MOD_RIGHT,
  RSFT: MOD_LSFT | MOD_RIGHT,
  RALT: MOD_LALT | MOD_RIGHT,
  ROPT: MOD_LALT | MOD_RIGHT,
  ALGR: MOD_LALT | MOD_RIGHT,
  RGUI: MOD_LGUI | MOD_RIGHT,
  RCMD: MOD_LGUI | MOD_RIGHT,
  RWIN: MOD_LGUI | MOD_RIGHT,
  LCA: MOD_LCTL | MOD_LALT,
  LSA: MOD_LSFT | MOD_LALT,
  LCS: MOD_LCTL | MOD_LSFT,
  LCG: MOD_LCTL | MOD_LGUI,
  LAG: MOD_LALT | MOD_LGUI,
  LSG: MOD_LSFT | MOD_LGUI,
  SGUI: MOD_LSFT | MOD_LGUI,
  SCMD: MOD_LSFT | MOD_LGUI,
  SWIN: MOD_LSFT | MOD_LGUI,
  LCAG: MOD_LCTL | MOD_LALT | MOD_LGUI,
  MEH: MOD_LCTL | MOD_LSFT | MOD_LALT,
  HYPR: MOD_LCTL | MOD_LSFT | MOD_LALT | MOD_LGUI,
  RCS: MOD_LCTL | MOD_LSFT | MOD_RIGHT,
  RCAG: MOD_LCTL | MOD_LALT | MOD_LGUI | MOD_RIGHT,
};

function splitArgs(inner: string): string[] {
  // Split on top-level commas only, so LT(1,LCTL(KC_A)) keeps its nesting.
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim());
}

/**
 * Parse QMK keycode text into a 16-bit code. Accepts canonical names,
 * aliases, the function forms above, `QK_MACRO_n` / `M(n)` and hex numbers.
 * Returns undefined for anything it cannot read, never a guess.
 */
export function parseKeycode(text: string): number | undefined {
  const s = text.trim();
  if (!s) return undefined;
  if (/^0x[0-9a-f]{1,4}$/i.test(s)) return parseInt(s, 16);
  const direct = CODE_BY_NAME.get(s);
  if (direct !== undefined) return direct;
  if (s === "_______") return KC_TRANSPARENT;
  if (s === "XXXXXXX") return KC_NO;

  const call = /^([A-Z0-9_]+)\((.*)\)$/s.exec(s);
  if (!call) return undefined;
  const fn = call[1];
  const args = splitArgs(call[2]);
  const layerArg = () => {
    const n = Number(args[0]);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  };
  const basicArg = (i: number) => {
    const code = parseKeycode(args[i] ?? "");
    return code !== undefined && code <= QK_BASIC_MAX ? code : undefined;
  };

  const layerOp = LAYER_OPS.find(([op]) => op === fn);
  if (layerOp && args.length === 1) {
    const layer = layerArg();
    return layer === undefined || layer > 0x1f ? undefined : layerOp[1] | layer;
  }
  if (fn === "LT" && args.length === 2) {
    const layer = layerArg();
    const code = basicArg(1);
    if (layer === undefined || layer > 0x0f || code === undefined)
      return undefined;
    return encodeKeycode({ kind: "layerTap", layer, code });
  }
  if (fn === "MT" && args.length === 2) {
    const mods = parseModMask(args[0]);
    const code = basicArg(1);
    if (mods === undefined || code === undefined) return undefined;
    return encodeKeycode({ kind: "modTap", mods, code });
  }
  if (fn === "LM" && args.length === 2) {
    const layer = layerArg();
    const mods = parseModMask(args[1]);
    if (layer === undefined || layer > 0x0f || mods === undefined)
      return undefined;
    return encodeKeycode({ kind: "layerMod", layer, mods });
  }
  if (fn === "OSM" && args.length === 1) {
    const mods = parseModMask(args[0]);
    return mods === undefined
      ? undefined
      : encodeKeycode({ kind: "oneShotMod", mods });
  }
  if (fn === "TD" && args.length === 1) {
    const index = layerArg();
    return index === undefined || index > 0xff
      ? undefined
      : encodeKeycode({ kind: "tapDance", index });
  }
  if (fn === "M" && args.length === 1) {
    const index = layerArg();
    return index === undefined || index > 0x7f
      ? undefined
      : encodeKeycode({ kind: "macro", index });
  }
  if (fn.endsWith("_T") && args.length === 1) {
    const mods = WRAPPER_MODS[fn.slice(0, -2)];
    const code = basicArg(0);
    if (mods === undefined || code === undefined) return undefined;
    return encodeKeycode({ kind: "modTap", mods, code });
  }
  const wrapper = WRAPPER_MODS[fn];
  if (wrapper !== undefined && args.length === 1) {
    const inner = parseKeycode(args[0]);
    if (inner === undefined) return undefined;
    const innerKey = decodeKeycode(inner);
    if (innerKey.kind === "basic") {
      return encodeKeycode({
        kind: "mods",
        mods: wrapper,
        code: innerKey.code,
      });
    }
    if (innerKey.kind === "mods") {
      // LCTL(LSFT(KC_A)): both halves must agree on left/right.
      if ((innerKey.mods & MOD_RIGHT) !== (wrapper & MOD_RIGHT))
        return undefined;
      return encodeKeycode({
        kind: "mods",
        mods: innerKey.mods | wrapper,
        code: innerKey.code,
      });
    }
    return undefined;
  }
  return undefined;
}
