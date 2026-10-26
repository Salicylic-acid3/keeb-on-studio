/**
 * What a physical key is called on a keycap, by the code the browser
 * reports for it, so pressing a key can fill in its own legend. `sub` is
 * the shifted legend printed above the main one.
 */
export type LabelLayout = "us" | "jis";

export interface KeyLabel {
  main: string;
  sub?: string;
}

const NAMED: Record<string, string> = {
  Escape: "Esc",
  Tab: "Tab",
  CapsLock: "Caps",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: "Win",
  MetaRight: "Win",
  ContextMenu: "Menu",
  Space: "Space",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Backspace: "BS",
  Delete: "Del",
  Insert: "Ins",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  PrintScreen: "PrtSc",
  AudioVolumeUp: "Vol+",
  AudioVolumeDown: "Vol-",
  AudioVolumeMute: "Mute",
  ScrollLock: "ScrLk",
  Pause: "Pause",
  NumLock: "Num",
  NumpadAdd: "+",
  NumpadSubtract: "-",
  NumpadMultiply: "*",
  NumpadDivide: "/",
  NumpadDecimal: ".",
  Convert: "変換",
  NonConvert: "無変換",
  KanaMode: "かな",
  Lang1: "かな",
  Lang2: "英数",
};

const US: Record<string, [string, string]> = {
  Digit1: ["1", "!"],
  Digit2: ["2", "@"],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "^"],
  Digit7: ["7", "&"],
  Digit8: ["8", "*"],
  Digit9: ["9", "("],
  Digit0: ["0", ")"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Backquote: ["`", "~"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
};

const JIS: Record<string, [string, string]> = {
  Digit1: ["1", "!"],
  Digit2: ["2", '"'],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "&"],
  Digit7: ["7", "'"],
  Digit8: ["8", "("],
  Digit9: ["9", ")"],
  Digit0: ["0", ""],
  Minus: ["-", "="],
  Equal: ["^", "~"],
  IntlYen: ["¥", "|"],
  BracketLeft: ["@", "`"],
  BracketRight: ["[", "{"],
  Semicolon: [";", "+"],
  Quote: [":", "*"],
  Backslash: ["]", "}"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  IntlRo: ["\\", "_"],
  Backquote: ["半/全", ""],
};

/** The legend for a `KeyboardEvent.code`, or null for a key with no name here. */
export function labelForCode(
  code: string,
  layout: LabelLayout,
): KeyLabel | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return { main: letter[1] };
  const fn = /^F(\d{1,2})$/.exec(code);
  if (fn) return { main: code };
  const pad = /^Numpad(\d)$/.exec(code);
  if (pad) return { main: pad[1] };
  const pair = (layout === "jis" ? JIS : US)[code];
  if (pair)
    return pair[1] ? { main: pair[0], sub: pair[1] } : { main: pair[0] };
  const named = NAMED[code];
  return named ? { main: named } : null;
}

const letters = (s: string) => s.split("").map((c) => `Key${c}`);

/** Rows of a keyboard as codes, to pour into selected keys in one go. */
export function rowPreset(
  row: "number" | "top" | "home" | "bottom" | "function",
  layout: LabelLayout,
): KeyLabel[] {
  const jis = layout === "jis";
  const codes = {
    number: [
      ..."1234567890".split("").map((d) => `Digit${d}`),
      "Minus",
      "Equal",
      ...(jis ? ["IntlYen"] : []),
    ],
    top: [...letters("QWERTYUIOP"), "BracketLeft", "BracketRight"],
    home: [
      ...letters("ASDFGHJKL"),
      "Semicolon",
      "Quote",
      ...(jis ? ["Backslash"] : []),
    ],
    bottom: [
      ...letters("ZXCVBNM"),
      "Comma",
      "Period",
      "Slash",
      ...(jis ? ["IntlRo"] : []),
    ],
    function: Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  }[row];
  return codes.map((c) => labelForCode(c, layout) ?? { main: "" });
}

/** Names offered as one-tap choices where typing is slow (a phone). */
export const QUICK_LABELS = [
  "Esc",
  "Tab",
  "Shift",
  "Ctrl",
  "Alt",
  "Win",
  "Fn",
  "Space",
  "Enter",
  "BS",
  "Del",
  "←",
  "↓",
  "↑",
  "→",
];
