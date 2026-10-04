/**
 * The QMK Settings Keeb-On! Studio shows, and how each is stored.
 *
 * Vial's own list (vial-gui qmk_settings.json) has a dozen groups; only the
 * ones that belong next to something on this page are here, in line with
 * keeping the app to what these keyboards are used for: the combo timeout
 * beside the combos, and the tap-hold timing beside the tap dances. A field
 * appears only when the firmware lists its id, since older and newer Vial
 * firmware have different sets (e.g. Permissive Hold as a bit of id 8, or
 * as id 22).
 */

/** Bytes each id is stored in (quantum/qmk_settings.h qmk_settings_t). */
export const QMK_SETTING_WIDTH: Record<number, number> = {
  1: 1,
  2: 2,
  3: 1,
  4: 2,
  5: 1,
  6: 2,
  7: 2,
  8: 1,
  9: 2,
  10: 2,
  11: 2,
  12: 2,
  13: 2,
  14: 2,
  15: 2,
  16: 2,
  17: 2,
  18: 2,
  19: 2,
  20: 1,
  21: 4,
  22: 1,
  23: 1,
  24: 1,
  25: 2,
  26: 1,
  27: 2,
};

export type QmkSettingField =
  | {
      kind: "number";
      qsid: number;
      label: string;
      hint?: string;
      min: number;
      max: number;
      unit?: string;
    }
  | { kind: "flag"; qsid: number; bit?: number; label: string; hint?: string };

export const COMBO_SETTINGS: QmkSettingField[] = [
  {
    kind: "number",
    qsid: 2,
    label: "Combo timeout",
    hint: "How close together the keys of a combo must be pressed",
    min: 0,
    max: 10000,
    unit: "ms",
  },
];

export const TAP_HOLD_SETTINGS: QmkSettingField[] = [
  {
    kind: "number",
    qsid: 7,
    label: "Tapping term",
    hint: "How long a key is held before it counts as a hold (tap dance, Mod-Tap, Layer-Tap)",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 25,
    label: "Quick tap term",
    hint: "Tap then hold within this time to repeat the tap instead of holding",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "flag",
    qsid: 22,
    label: "Permissive Hold",
    hint: "Another key tapped while held makes it a hold",
  },
  {
    kind: "flag",
    qsid: 8,
    bit: 0,
    label: "Permissive Hold",
    hint: "Another key tapped while held makes it a hold",
  },
  {
    kind: "flag",
    qsid: 23,
    label: "Hold On Other Key Press",
    hint: "Another key pressed while held makes it a hold at once",
  },
  {
    kind: "flag",
    qsid: 24,
    label: "Retro Tapping",
    hint: "Held past the tapping term with no other key: still sends the tap",
  },
  {
    kind: "flag",
    qsid: 8,
    bit: 3,
    label: "Retro Tapping",
    hint: "Held past the tapping term with no other key: still sends the tap",
  },
  {
    kind: "number",
    qsid: 20,
    label: "Tapping toggle",
    hint: "Taps on a TT key that lock its layer",
    min: 0,
    max: 100,
  },
];

/**
 * Mouse keys (MS_UP, MS_BTN1, MS_WHLU ...): how fast the cursor and the
 * wheel move. Only on firmware built with mouse keys and without the
 * three-speed mode (quantum/qmk_settings.c).
 */
export const MOUSE_KEY_SETTINGS: QmkSettingField[] = [
  {
    kind: "number",
    qsid: 9,
    label: "Cursor: delay before moving",
    hint: "From pressing a cursor key to the first movement",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 10,
    label: "Cursor: time between movements",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 11,
    label: "Cursor: step size",
    hint: "How far the cursor moves each time",
    min: 0,
    max: 1000,
  },
  {
    kind: "number",
    qsid: 12,
    label: "Cursor: maximum speed",
    min: 0,
    max: 1000,
  },
  {
    kind: "number",
    qsid: 13,
    label: "Cursor: time to reach maximum speed",
    hint: "In movements, not milliseconds",
    min: 0,
    max: 1000,
  },
  {
    kind: "number",
    qsid: 14,
    label: "Wheel: delay before scrolling",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 15,
    label: "Wheel: time between scrolls",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 16,
    label: "Wheel: maximum speed",
    hint: "Scroll steps per movement at full speed",
    min: 0,
    max: 1000,
  },
  {
    kind: "number",
    qsid: 17,
    label: "Wheel: time to reach maximum speed",
    hint: "In movements, not milliseconds",
    min: 0,
    max: 1000,
  },
];

/**
 * The fields this firmware has. Where an id-per-setting and a bit-of-id-8
 * version both exist, the newer id wins so a setting never shows twice.
 */
export function supportedFields(
  fields: QmkSettingField[],
  ids: Set<number>,
): QmkSettingField[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    if (!ids.has(f.qsid) || seen.has(f.label)) return false;
    seen.add(f.label);
    return true;
  });
}

export function readField(
  f: QmkSettingField,
  values: Record<number, number>,
): number | boolean {
  const v = values[f.qsid] ?? 0;
  if (f.kind === "number") return v;
  return f.bit === undefined ? v !== 0 : ((v >> f.bit) & 1) === 1;
}

export function writeField(
  f: QmkSettingField,
  values: Record<number, number>,
  next: number | boolean,
): number {
  if (f.kind === "number")
    return Math.max(f.min, Math.min(f.max, Math.round(Number(next) || 0)));
  if (f.bit === undefined) return next ? 1 : 0;
  const v = values[f.qsid] ?? 0;
  return next ? v | (1 << f.bit) : v & ~(1 << f.bit);
}
