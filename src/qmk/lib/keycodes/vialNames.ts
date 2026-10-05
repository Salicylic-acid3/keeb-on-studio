/**
 * Keycode names the way Vial writes and reads them in .vil files
 * (vial-gui keycodes.py Keycode.serialize / deserialize). Vial still uses
 * the older QMK spellings (KC_CAPSLOCK, KC_BSPACE), so these differ from
 * keycodeToText's.
 */
import {
  VIAL_ALL_NAMES,
  VIAL_GUI_NAMES,
  VIAL_MASKED,
} from "./vialNames.generated";
import { parseKeycode } from "./qmkKeycode";

const GUI_BY_CODE = new Map<number, string>();
for (const [name, code] of VIAL_GUI_NAMES)
  if (!GUI_BY_CODE.has(code)) GUI_BY_CODE.set(code, name);
const ALL_BY_NAME = new Map<string, number>(VIAL_ALL_NAMES);
const ALL_BY_CODE = new Map<number, string>();
for (const [name, code] of VIAL_ALL_NAMES)
  if (!ALL_BY_CODE.has(code)) ALL_BY_CODE.set(code, name);
const MASKED_BY_BASE = new Map<number, string>(
  VIAL_MASKED.map(([n, b]) => [b, n]),
);
const MASKED_BY_NAME = new Map<string, number>(
  VIAL_MASKED.map(([n, b]) => [n.slice(0, -4), b]),
);

/** Keys Vial names by number: MO(1), TD(3), M5, USER00 ... */
const NUMBERED = /^(MO|DF|TG|TT|OSL|TO|PDF|TD)\(\d+\)$|^M\d+$|^USER\d+$/;

export function vialKeycodeName(code: number): string {
  const masked = MASKED_BY_BASE.get(code & 0xff00);
  if (masked !== undefined) {
    const inner = GUI_BY_CODE.get(code & 0xff);
    if (inner) return masked.replace("kc", inner);
  } else {
    const gui = GUI_BY_CODE.get(code);
    if (gui) return gui;
    const numbered = ALL_BY_CODE.get(code);
    if (numbered && NUMBERED.test(numbered)) return numbered;
  }
  return `0x${code.toString(16)}`;
}

export function parseVialKeycode(text: string): number | undefined {
  const t = text.trim();
  const exact = ALL_BY_NAME.get(t);
  if (exact !== undefined) return exact;
  const m = /^(\w+)\((\w+)\)$/.exec(t);
  if (m && MASKED_BY_NAME.has(m[1])) {
    const inner = ALL_BY_NAME.get(m[2]) ?? parseKeycode(m[2]);
    if (inner !== undefined && inner <= 0xff)
      return MASKED_BY_NAME.get(m[1])! | inner;
  }
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16) & 0xffff;
  if (/^\d+$/.test(t)) return Number(t) & 0xffff;
  // Anything else in QMK's own spelling (KC_CAPS_LOCK, LT(1,KC_A), MT(...)).
  return parseKeycode(t);
}
