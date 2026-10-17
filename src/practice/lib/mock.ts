/**
 * Phase 0 of the typing practice: the data the screen mock runs on.
 *
 * Nothing here is final. The guide steps are the 40%-and-under guide from
 * docs/practice/SPEC.md §5.2, the sentences are placeholders until the
 * texts are extracted (§6.4), and the symbol slots are guessed from the
 * default keymap the way §5.5 says to fall back when a keyboard has no
 * metadata yet. What is real is the key lookup: given a character, which
 * key of the current keymap types it, on which layer, with Shift or not.
 */
import type { TestBoard, TestKey } from "../../keyTest/lib/boards";

export type PracticeMode = "pick" | "guide" | "free" | "meta";
export type StopMode = "stop" | "advance";

export interface GuideStep {
  id: string;
  title: string;
  /** A practice step, not a question. */
  practice?: boolean;
}

/** The 40%-and-under guide, one entry per step of SPEC §5.2. */
export const GUIDE_40: GuideStep[] = [
  { id: "intro", title: "Introduction" },
  { id: "symbols", title: "Symbol priority" },
  { id: "duplicates", title: "Rarely used keys" },
  { id: "thumbs", title: "Thumb keys" },
  { id: "layer-keys", title: "Layer keys" },
  { id: "practice-base", title: "Practice: base layer", practice: true },
  { id: "layer-one-hand", title: "Layer contents: one hand" },
  { id: "layer-other", title: "Layer contents: other side" },
  { id: "practice-layers", title: "Practice: layer tasks", practice: true },
  { id: "rare", title: "Occasional keys" },
  { id: "practice-all", title: "Practice: everything", practice: true },
];

export interface SymbolChoice {
  ch: string;
  name: string;
}

/** The symbols the priority question asks about, in a neutral order. */
export const SYMBOLS: SymbolChoice[] = [
  { ch: "-", name: "Hyphen" },
  { ch: ":", name: "Colon" },
  { ch: ";", name: "Semicolon" },
  { ch: "'", name: "Quote" },
  { ch: "/", name: "Slash" },
  { ch: "\\", name: "Backslash" },
  { ch: "[", name: "Left bracket" },
  { ch: "]", name: "Right bracket" },
  { ch: "=", name: "Equals" },
  { ch: "`", name: "Backquote" },
];

export interface Sentence {
  /** What the person reads. */
  display: string;
  /** What they type, one accepted spelling; the full set comes in phase 1. */
  typed: string;
  tags: Array<"base" | "symbols" | "digits">;
}

/** Placeholder sentences: short, and ours. */
export const SENTENCES: Sentence[] = [
  {
    display: "よく使うキーから順に置いていく",
    typed: "yokutsukauki-karajunnnioiteiku",
    tags: ["base"],
  },
  {
    display: "親指でスペースを押す場所を決める",
    typed: "oyayubidesupe-suwoosubasyowokimeru",
    tags: ["base"],
  },
  {
    display: "keeb-on.studio/practice",
    typed: "keeb-on.studio/practice",
    tags: ["symbols"],
  },
  {
    display: "記号はハイフンとコロンを入れ替えた",
    typed: "kigouhahaihunntokoronnwoirekaeta",
    tags: ["base"],
  },
];

/** The codes of the symbol keys a proposal may reassign; comma and period stay. */
const SYMBOL_CODES = new Set([
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Backquote",
  "Slash",
  "IntlBackslash",
  "IntlRo",
  "IntlYen",
]);

function isSymbolKey(k: TestKey): boolean {
  return (
    k.trigger.kind === "key" &&
    k.trigger.mods.length === 0 &&
    SYMBOL_CODES.has(k.trigger.code)
  );
}

/**
 * Where symbols sit on the base layer of the default keymap, top row first
 * and left to right: the slots the symbol proposal fills (SPEC §5.5).
 */
export function symbolSlots(board: TestBoard): TestKey[] {
  return board.keys
    .filter(isSymbolKey)
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

/** Thumb keys: the lowest row, 1.25u wide or wider, or Space. */
export function thumbKeys(board: TestBoard): TestKey[] {
  const maxY = Math.max(...board.keys.map((k) => k.cy));
  return board.keys.filter(
    (k) =>
      Math.abs(k.cy - maxY) < 0.3 && (k.w >= 1.25 || k.label.main === "Space"),
  );
}
