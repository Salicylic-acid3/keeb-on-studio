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

/**
 * Vial's own "Tap-Hold" tab (vial-gui qmk_settings.json), in its order.
 * Older Vial firmware keeps four of them as bits of id 8, newer firmware as
 * ids of their own; whichever this firmware lists is shown.
 */
export const TAP_HOLD_SETTINGS: QmkSettingField[] = [
  {
    kind: "number",
    qsid: 7,
    label: "Tapping term",
    hint: "How long a Mod-Tap or Layer-Tap key is held before it counts as a hold (tap dances have their own, in each one)",
    min: 0,
    max: 10000,
    unit: "ms",
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
    qsid: 8,
    bit: 1,
    label: "Ignore Mod Tap Interrupt",
    hint: "Off: pressing another key while a Mod-Tap or Layer-Tap is held makes it a hold at once. On: only the tapping term decides",
  },
  {
    kind: "flag",
    qsid: 8,
    bit: 2,
    label: "Tapping Force Hold",
    hint: "Tapping then holding the same key holds it, rather than repeating the tap",
  },
  {
    kind: "flag",
    qsid: 8,
    bit: 3,
    label: "Retro Tapping",
    hint: "Held past the tapping term with no other key: still sends the tap",
  },
  {
    kind: "flag",
    qsid: 22,
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
    kind: "number",
    qsid: 25,
    label: "Quick tap term",
    hint: "Tap then hold within this time to repeat the tap instead of holding",
    min: 0,
    max: 10000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 18,
    label: "Tap code delay",
    hint: "How long a tapped key stays pressed before it is released",
    min: 0,
    max: 1000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 19,
    label: "Tap hold Caps Lock delay",
    hint: "How long Caps Lock stays pressed when tapped from a tap-hold key (some systems miss shorter ones)",
    min: 0,
    max: 1000,
    unit: "ms",
  },
  {
    kind: "number",
    qsid: 20,
    label: "Tapping toggle",
    hint: "Taps on a TT key that lock its layer",
    min: 0,
    max: 100,
  },
  {
    kind: "flag",
    qsid: 26,
    label: "Chordal Hold",
    hint: "A tap-hold key and a key on the same hand pressed together: counts as a tap",
  },
  {
    kind: "number",
    qsid: 27,
    label: "Flow Tap",
    hint: "While typing fast, a tap-hold key pressed within this time after the previous key is always a tap",
    min: 0,
    max: 10000,
    unit: "ms",
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
  // A setting the firmware has as an id of its own wins over the old bit of
  // id 8 with the same name, wherever it sits in the list.
  const ownId = new Set(
    fields
      .filter(
        (f) => ids.has(f.qsid) && !(f.kind === "flag" && f.bit !== undefined),
      )
      .map((f) => f.label),
  );
  const seen = new Set<string>();
  return fields.filter((f) => {
    if (!ids.has(f.qsid) || seen.has(f.label)) return false;
    if (f.kind === "flag" && f.bit !== undefined && ownId.has(f.label))
      return false;
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

/** True when the firmware has anything this tab would show. */
export function hasQmkSettingsTab(ids: Set<number>): boolean {
  return (
    supportedFields(TAP_HOLD_SETTINGS, ids).length > 0 ||
    supportedFields(MOUSE_KEY_SETTINGS, ids).length > 0
  );
}
