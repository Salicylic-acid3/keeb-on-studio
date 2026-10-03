/**
 * Vial's physical layout: keyboard-layout-editor rows, where each key's
 * legend carries `row,col` of the matrix and, optionally, `option,choice`
 * for layout options. Converted here into the geometry the keymap board
 * draws (1u = 100, rotation in centidegrees, around rx/ry), so the ZMK
 * side's PhysicalKey can draw QMK keys unchanged.
 */
import { Serial } from "@ijprest/kle-serial";
import type { KleRow } from "./definition";

export interface VialKey {
  row: number;
  col: number;
  /** 1u = 100 */
  x: number;
  y: number;
  width: number;
  height: number;
  /** centidegrees */
  r: number;
  rx: number;
  ry: number;
  /** Present when this key only exists for one layout-option choice. */
  option?: { index: number; choice: number };
}

export class KleParseError extends Error {}

/** Raw legend strings in the order kle-serial emits keys. */
function rawLegends(rows: KleRow[]): Array<{ text: string; decal: boolean }> {
  const out: Array<{ text: string; decal: boolean }> = [];
  let decal = false;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const item of row) {
      if (typeof item === "string") {
        out.push({ text: item, decal });
        decal = false; // KLE resets per-key properties after each key
      } else if (item && typeof item === "object" && "d" in item) {
        decal = Boolean(item.d);
      }
    }
  }
  return out;
}

export function parseKleLayout(rows: KleRow[]): VialKey[] {
  const legends = rawLegends(rows);
  const parsed = Serial.deserialize(rows as unknown[]);
  if (parsed.keys.length !== legends.length) {
    throw new KleParseError("Layout rows and key legends do not line up");
  }
  const keys: VialKey[] = [];
  parsed.keys.forEach((key, i) => {
    const legend = legends[i];
    if (legend.decal) return;
    const parts = legend.text.split("\n");
    const pos = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(parts[0] ?? "");
    if (!pos) return; // Not a matrix key (e.g. an encoder or a label).
    const opt = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(parts[3] ?? "");
    keys.push({
      row: Number(pos[1]),
      col: Number(pos[2]),
      x: Math.round(key.x * 100),
      y: Math.round(key.y * 100),
      width: Math.round(key.width * 100),
      height: Math.round(key.height * 100),
      r: Math.round(key.rotation_angle * 100),
      rx: Math.round(key.rotation_x * 100),
      ry: Math.round(key.rotation_y * 100),
      ...(opt
        ? { option: { index: Number(opt[1]), choice: Number(opt[2]) } }
        : {}),
    });
  });
  return keys;
}

/**
 * Keys visible for the given layout option values (VIA packs them into one
 * 32-bit number: option 0 in the lowest bits). Choice 0 of an option is the
 * default and its keys are visible when the option is unset.
 */
export function visibleKeys(
  keys: VialKey[],
  labels: Array<{ choices: string[] }>,
  options: number,
): VialKey[] {
  // Vial (layout_editor.py) concatenates one bit string per option, option 0
  // first, so option 0 lands in the highest bits and the last option in the
  // lowest. A checkbox option is one bit; a select takes bit_length(n - 1)
  // bits for n choices.
  const widths = labels.map((l) =>
    l.choices.length === 0
      ? 1
      : l.choices.length === 1
        ? 0
        : (l.choices.length - 1).toString(2).length,
  );
  const offsets: number[] = [];
  let shift = 0;
  for (let i = labels.length - 1; i >= 0; i--) {
    offsets[i] = shift;
    shift += widths[i];
  }
  return keys.filter((k) => {
    if (!k.option) return true;
    const w = widths[k.option.index] ?? 1;
    const off = offsets[k.option.index] ?? 0;
    const value = (options >>> off) & ((1 << w) - 1);
    return value === k.option.choice;
  });
}
