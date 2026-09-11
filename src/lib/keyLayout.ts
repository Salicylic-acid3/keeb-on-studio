/**
 * Key Layout Definition
 *
 * The static ~70% keyboard drawn by the "key layout" mode of the keycode
 * selector, and by the continuous-entry bar under the keymap board. Each key
 * references an HID keyboard usage code (page 0x07) from keycodes.ts, so
 * clicking a keyswitch selects the matching keycode.
 *
 * Rows are laid out left-aligned and every row sums to ROW_UNITS (16u) so that
 * columns line up like a physical keyboard. Spacers fill the gaps (e.g. the
 * inverted-T arrow cluster).
 *
 * There are two of them, because the OS Layout setting is about a physical
 * keyboard and not only about what is printed on it. On JIS the keys are in
 * different places *and* there are more of them -- ￥ and ろ have no ANSI
 * equivalent at all, and picking them from a US picture is impossible rather
 * than merely confusing. {@link getKeyLayout} chooses; the labels on top
 * continue to come from keyboardLayouts.ts either way.
 */
import type { KeyboardLayoutType } from "./keyboardLayouts";

/** Total width of every row in key units. Keys align to this grid. */
export const ROW_UNITS = 16;

export interface KeyLayoutKey {
  /** HID usage code on the keyboard page (0x07) */
  code: number;
  /** Width in key units (1u = a standard key). Defaults to 1. */
  w?: number;
}

export interface KeyLayoutSpacer {
  spacer: true;
  /** Width in key units */
  w: number;
}

export type KeyLayoutItem = KeyLayoutKey | KeyLayoutSpacer;

export function isSpacer(item: KeyLayoutItem): item is KeyLayoutSpacer {
  return "spacer" in item;
}

// HID keyboard usage codes (page 0x07), mirroring KEYBOARD_KEYCODES in keycodes.ts
const ESC = 0x29;
const F1 = 0x3a; // F1..F12 are contiguous 0x3a..0x45
const GRAVE = 0x35;
const N1 = 0x1e; // 1..9 contiguous 0x1e..0x26
const N0 = 0x27;
const MINUS = 0x2d;
const EQUAL = 0x2e;
const BSPC = 0x2a;
const TAB = 0x2b;
const LBKT = 0x2f;
const RBKT = 0x30;
const BSLH = 0x31;
const CAPS = 0x39;
const SEMI = 0x33;
const SQT = 0x34;
const ENTER = 0x28;
const LSHIFT = 0xe1;
const COMMA = 0x36;
const DOT = 0x37;
const FSLH = 0x38;
const RSHIFT = 0xe5;
const LCTRL = 0xe0;
const LGUI = 0xe3;
const LALT = 0xe2;
const SPACE = 0x2c;
const RALT = 0xe6;
const RGUI = 0xe7;
const DEL = 0x4c;
const HOME = 0x4a;
const PGUP = 0x4b;
const PGDN = 0x4e;
const END = 0x4d;
const UP = 0x52;
const LEFT = 0x50;
const DOWN = 0x51;
const RIGHT = 0x4f;

// JIS-only keys. The first five are the USB HID "International" usages, whose
// numbering is the spec's and not guessable from the legend: International1 is
// ろ, 3 is ￥, 4 is 変換 and 5 is 無変換 -- 4 and 5 are the pair most often
// written down the wrong way round. LANG1/LANG2 are what an Apple JIS keyboard
// sends from the two keys beside the space bar, where a PC JIS keyboard sends
// 無変換 and 変換 instead; both pairs are drawn, because a keyboard configured
// here may well be used on both.
const INT_RO = 0x87; // ろ  \_
const INT_KANA = 0x88; // カタカナ/ひらがな
const INT_YEN = 0x89; // ￥
const INT_HENKAN = 0x8a; // 変換
const INT_MUHENKAN = 0x8b; // 無変換
const LANG1 = 0x90; // かな   (Apple)
const LANG2 = 0x91; // 英数   (Apple)
/** Non-US Hash. On JIS this is the ] key, not a hash at all. */
const NON_US_HASH = 0x32;

/** Letters A..Z are contiguous starting at 0x04 */
function letter(ch: string): number {
  return 0x04 + (ch.charCodeAt(0) - "A".charCodeAt(0));
}

/** Numbers 1..0 across the number row */
function num(n: number): number {
  return n === 0 ? N0 : N1 + (n - 1);
}

/** Function keys F1..F12 */
function fn(n: number): number {
  return F1 + (n - 1);
}

/** The function row is the same on both layouts. */
const FUNCTION_ROW: KeyLayoutItem[] = [
  { code: ESC },
  { spacer: true, w: 0.5 },
  ...[1, 2, 3, 4].map((n) => ({ code: fn(n) })),
  { spacer: true, w: 0.5 },
  ...[5, 6, 7, 8].map((n) => ({ code: fn(n) })),
  { spacer: true, w: 0.5 },
  ...[9, 10, 11, 12].map((n) => ({ code: fn(n) })),
  { spacer: true, w: 0.5 },
  { code: DEL },
];

/**
 * ~70% ANSI layout (function row + 65% main block with nav cluster and arrows).
 */
export const KEY_LAYOUT_70: KeyLayoutItem[][] = [
  FUNCTION_ROW,
  // Number row
  [
    { code: GRAVE },
    ...Array.from({ length: 10 }, (_, i) => ({ code: num(i + 1) })),
    { code: MINUS },
    { code: EQUAL },
    { code: BSPC, w: 2 },
    { code: HOME },
  ],
  // Top alpha row
  [
    { code: TAB, w: 1.5 },
    ...["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((c) => ({
      code: letter(c),
    })),
    { code: LBKT },
    { code: RBKT },
    { code: BSLH, w: 1.5 },
    { code: PGUP },
  ],
  // Home row
  [
    { code: CAPS, w: 1.75 },
    ...["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((c) => ({
      code: letter(c),
    })),
    { code: SEMI },
    { code: SQT },
    { code: ENTER, w: 2.25 },
    { code: PGDN },
  ],
  // Bottom alpha row
  [
    { code: LSHIFT, w: 2.25 },
    ...["Z", "X", "C", "V", "B", "N", "M"].map((c) => ({ code: letter(c) })),
    { code: COMMA },
    { code: DOT },
    { code: FSLH },
    { code: RSHIFT, w: 1.75 },
    { code: UP },
    { code: END },
  ],
  // Modifier row
  [
    { code: LCTRL, w: 1.25 },
    { code: LGUI, w: 1.25 },
    { code: LALT, w: 1.25 },
    { code: SPACE, w: 6.25 },
    { code: RALT, w: 1.25 },
    { code: RGUI, w: 1.25 },
    { spacer: true, w: 0.5 },
    { code: LEFT },
    { code: DOWN },
    { code: RIGHT },
  ],
];

/**
 * ~70% JIS layout.
 *
 * Not a relabelled ANSI board. Three keys exist here that have no ANSI
 * counterpart -- ￥ on the number row, ろ on the bottom row, and the pair
 * beside the space bar -- and a picker drawn from the ANSI table simply cannot
 * reach them, which is the whole reason this table exists.
 *
 * The Enter key appears twice, on the number-alpha row and the home row. A real
 * JIS Enter is one L-shaped key across both; this grid draws rectangles, and
 * two rectangles that select the same keycode is a truer picture than a hole
 * where the upper arm should be.
 *
 * Beside the space bar, both conventions are drawn: 無変換/変換 on the outside,
 * which is what a PC JIS keyboard sends, and 英数/かな on the inside, which is
 * what an Apple JIS keyboard sends from the same two positions. A keyboard
 * configured in this app may be used on either, so refusing to guess and
 * showing all four is the honest layout.
 */
export const KEY_LAYOUT_JIS: KeyLayoutItem[][] = [
  FUNCTION_ROW,
  // Number row — one key longer than ANSI: ￥ sits before Backspace, which is
  // 1u here rather than 2u to pay for it.
  [
    { code: GRAVE }, // 半/全
    ...Array.from({ length: 10 }, (_, i) => ({ code: num(i + 1) })),
    { code: MINUS },
    { code: EQUAL }, // ^~ on JIS
    { code: INT_YEN },
    { code: BSPC },
    { code: HOME },
  ],
  // Top alpha row. @ and [ take the ANSI bracket usages; the 1.5u on the right
  // is the top arm of the L-shaped Enter.
  [
    { code: TAB, w: 1.5 },
    ...["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((c) => ({
      code: letter(c),
    })),
    { code: LBKT }, // @`
    { code: RBKT }, // [{
    { code: ENTER, w: 1.5 },
    { code: PGUP },
  ],
  // Home row. ] is Non-US Hash here, which is the one JIS key most likely to be
  // mistaken for something else.
  [
    { code: CAPS, w: 1.75 },
    ...["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((c) => ({
      code: letter(c),
    })),
    { code: SEMI }, // ;+
    { code: SQT }, // :*
    { code: NON_US_HASH }, // ]}
    { code: ENTER, w: 1.25 },
    { code: PGDN },
  ],
  // Bottom alpha row — ろ before a right Shift that is narrower than ANSI's.
  [
    { code: LSHIFT, w: 2 },
    ...["Z", "X", "C", "V", "B", "N", "M"].map((c) => ({ code: letter(c) })),
    { code: COMMA },
    { code: DOT },
    { code: FSLH },
    { code: INT_RO },
    { code: RSHIFT },
    { code: UP },
    { code: END },
  ],
  // Modifier row — both the PC and the Apple pair, outermost first.
  [
    { code: LCTRL, w: 1.25 },
    { code: LGUI, w: 1.25 },
    { code: LALT, w: 1.25 },
    { code: INT_MUHENKAN }, // 無変換
    { code: LANG2 }, // 英数
    { code: SPACE, w: 3.25 },
    { code: LANG1 }, // かな
    { code: INT_HENKAN }, // 変換
    { code: INT_KANA }, // カタカナ/ひらがな
    { code: RALT },
    { code: LEFT },
    { code: DOWN },
    { code: RIGHT },
  ],
];

/**
 * The on-screen keyboard to draw for a chosen OS layout.
 *
 * "US (ANSI) for JP" keeps the ANSI picture on purpose: it describes a US
 * keyboard being used to type Japanese, so the keys really are where ANSI puts
 * them and only the Japanese input keys are added to what is available. Those
 * are reachable from the category grid, which is where they were before.
 */
export function getKeyLayout(
  layout: KeyboardLayoutType | undefined,
): KeyLayoutItem[][] {
  return layout === "JIS" ? KEY_LAYOUT_JIS : KEY_LAYOUT_70;
}

/**
 * Every row of every layout has to add up, or the columns stop lining up and
 * the last key of a long row is pushed off the edge. Checked in the tests
 * rather than here so a bad edit fails loudly at build time, not silently in
 * someone's picker.
 */
export function rowWidth(row: KeyLayoutItem[]): number {
  return row.reduce(
    (sum, item) => sum + (isSpacer(item) ? item.w : (item.w ?? 1)),
    0,
  );
}
