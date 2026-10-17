/**
 * What a key of a default keymap sends, in terms a web page can see.
 *
 * A browser only learns about a key through `KeyboardEvent.code` (and the
 * modifiers held with it) or, for a mouse button, `MouseEvent.button`. So
 * each binding is reduced to that: the code its tap sends, the modifiers
 * that come with it, and -- for a mod-tap -- the modifier its hold sends.
 * Everything else (layer keys, Bluetooth, lighting, unassigned) sends
 * nothing a page can see and is drawn as not testable.
 */
import { codeForKeyName } from "../../layoutEditor/lib/firmwareLabels";

export type Mod = "shift" | "ctrl" | "alt" | "meta";

export type Trigger =
  | {
      kind: "key";
      /** The code the key's tap (or plain press) sends. */
      code: string;
      /** Modifiers sent together with it (LSFT(KC_1), LG(LBKT)). */
      mods: Mod[];
      /** Code its hold sends, for a mod-tap (MT, SFT_T, &mt). */
      hold?: string;
    }
  | { kind: "mouse"; button: number }
  /** A layer key: shows nothing by itself, only through the keys it shifts. */
  | { kind: "layer" }
  /** Sends something a page cannot see (Bluetooth, lighting, a reset...). */
  | { kind: "other"; label: string }
  /** Unassigned or transparent. */
  | { kind: "none" };

const MOD_CODE: Record<Mod, string> = {
  shift: "ShiftLeft",
  ctrl: "ControlLeft",
  alt: "AltLeft",
  meta: "MetaLeft",
};

/** The modifier a modifier key's code is. */
export function modOfCode(code: string): Mod | null {
  if (code.startsWith("Shift")) return "shift";
  if (code.startsWith("Control")) return "ctrl";
  if (code.startsWith("Alt")) return "alt";
  if (code.startsWith("Meta")) return "meta";
  return null;
}

/** QMK's modifier wrappers (LSFT(kc), S(kc)) and ZMK's (LS(kc)). */
const WRAPPER_MODS: Record<string, Mod> = {
  LSFT: "shift",
  RSFT: "shift",
  S: "shift",
  LS: "shift",
  RS: "shift",
  LCTL: "ctrl",
  RCTL: "ctrl",
  C: "ctrl",
  LC: "ctrl",
  RC: "ctrl",
  LALT: "alt",
  RALT: "alt",
  LOPT: "alt",
  A: "alt",
  LA: "alt",
  RA: "alt",
  LGUI: "meta",
  RGUI: "meta",
  LCMD: "meta",
  LWIN: "meta",
  G: "meta",
  LG: "meta",
  RG: "meta",
};

/** QMK's MOD_* names in MT(MOD_LSFT, kc). */
function modFromQmkModName(name: string): Mod | null {
  const m = /^MOD_(L|R)?(SFT|CTL|ALT|GUI)$/.exec(name);
  if (!m) return null;
  return ({ SFT: "shift", CTL: "ctrl", ALT: "alt", GUI: "meta" } as const)[
    m[2] as "SFT" | "CTL" | "ALT" | "GUI"
  ];
}

/** QMK's one-modifier tap-hold shorthands (SFT_T, LCTL_T, GUI_T...). */
function modFromQmkTapHold(name: string): Mod | null {
  const m = /^[LR]?(SFT|SHIFT|CTL|CTRL|ALT|OPT|GUI|CMD|WIN)_T$/.exec(name);
  if (!m) return null;
  if (/SFT|SHIFT/.test(m[1])) return "shift";
  if (/CTL|CTRL/.test(m[1])) return "ctrl";
  if (/ALT|OPT/.test(m[1])) return "alt";
  return "meta";
}

function holdCodeOf(mod: Mod, right: boolean): string {
  return right ? MOD_CODE[mod].replace("Left", "Right") : MOD_CODE[mod];
}

/** A key name with any modifier wrappers around it: LSFT(KC_1), LG(LBKT). */
function keyWithMods(text: string): { code: string; mods: Mod[] } | null {
  const mods: Mod[] = [];
  let inner = text;
  for (;;) {
    const m = /^([A-Z]+)\((.*)\)$/.exec(inner);
    if (!m) break;
    const mod = WRAPPER_MODS[m[1]];
    if (!mod) return null;
    if (!mods.includes(mod)) mods.push(mod);
    inner = m[2];
  }
  const code = codeForKeyName(inner);
  if (!code) return null;
  // A shifted bracket of its own ("{") is the bracket key with Shift.
  if (/^(KC_)?[LR]CBR$/.test(inner) && !mods.includes("shift"))
    mods.push("shift");
  return { code, mods };
}

const QMK_MOUSE: Record<string, number> = {
  BTN1: 0,
  BTN2: 2,
  BTN3: 1,
  BTN4: 3,
  BTN5: 4,
};

/** A QMK keycode as keymap.c writes it. */
export function qmkTrigger(keycode: string | undefined): Trigger {
  if (!keycode) return { kind: "none" };
  const text = keycode.replace(/\s+/g, "");
  if (/^(KC_NO|XXXXXXX|KC_TRNS|KC_TRANSPARENT|_______)$/.test(text))
    return { kind: "none" };
  if (/^(MO|TG|TO|TT|OSL|DF|PDF)\(/.test(text)) return { kind: "layer" };
  const mouse = /^(?:KC_|MS_)(?:MS_)?(BTN\d)$/.exec(text);
  if (mouse && mouse[1] in QMK_MOUSE)
    return { kind: "mouse", button: QMK_MOUSE[mouse[1]] };
  const lt = /^LT\(\d+,(.+)\)$/.exec(text);
  if (lt) {
    const tap = keyWithMods(lt[1]);
    return tap ? { kind: "key", ...tap } : { kind: "layer" };
  }
  const mt = /^MT\(([^,]+),(.+)\)$/.exec(text);
  if (mt) {
    const tap = keyWithMods(mt[2]);
    const first = mt[1].split("|")[0];
    const mod = modFromQmkModName(first);
    if (!tap) return { kind: "other", label: text };
    return {
      kind: "key",
      ...tap,
      ...(mod ? { hold: holdCodeOf(mod, first.startsWith("MOD_R")) } : {}),
    };
  }
  const short = /^([A-Z_]+_T)\((.+)\)$/.exec(text);
  if (short) {
    const tap = keyWithMods(short[2]);
    const mod = modFromQmkTapHold(short[1]);
    if (!tap) return { kind: "other", label: text };
    return {
      kind: "key",
      ...tap,
      ...(mod ? { hold: holdCodeOf(mod, short[1].startsWith("R")) } : {}),
    };
  }
  const plain = keyWithMods(text);
  if (plain) return { kind: "key", ...plain };
  return { kind: "other", label: text.replace(/^KC_/, "") };
}

const ZMK_MOUSE: Record<string, number> = {
  LCLK: 0,
  MB1: 0,
  RCLK: 2,
  MB2: 2,
  MCLK: 1,
  MB3: 1,
  MB4: 3,
  MB5: 4,
};

/** A ZMK binding without its "&" ("kp A", "lt 2 SPACE", "mt LSHIFT A"). */
export function zmkTrigger(binding: string | undefined): Trigger {
  if (!binding) return { kind: "none" };
  const [behavior, ...params] = binding.trim().split(/\s+/);
  if (behavior === "none" || behavior === "trans") return { kind: "none" };
  if (behavior === "kp" && params[0]) {
    const key = keyWithMods(params[0]);
    return key ? { kind: "key", ...key } : { kind: "other", label: params[0] };
  }
  // Hold-taps, including this workshop's timing presets (lt_mid, mt_fast).
  if (/^(mt|lt)(_\w+)?$/.test(behavior) && params[1]) {
    const tap = keyWithMods(params[1]);
    if (!tap)
      return behavior.startsWith("lt") ? { kind: "layer" } : { kind: "none" };
    if (behavior.startsWith("lt")) return { kind: "key", ...tap };
    const hold = codeForKeyName(params[0]);
    return { kind: "key", ...tap, ...(hold ? { hold } : {}) };
  }
  if (/^(mo|tog|to|sl)$/.test(behavior)) return { kind: "layer" };
  if (behavior === "mkp" && params[0] && params[0] in ZMK_MOUSE)
    return { kind: "mouse", button: ZMK_MOUSE[params[0]] };
  // Custom mouse behaviours of these keyboards (drag_lclk...).
  const click = /(l|r|m)clk$/i.exec(behavior);
  if (click)
    return {
      kind: "mouse",
      button: { l: 0, r: 2, m: 1 }[click[1].toLowerCase() as "l" | "r" | "m"],
    };
  if (behavior === "bt") return { kind: "other", label: "BT" };
  return { kind: "other", label: behavior };
}
