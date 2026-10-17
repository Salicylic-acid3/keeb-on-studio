/**
 * The sentences the practice offers.
 *
 * texts.ja.json holds sentences extracted from the blog by
 * scripts/practice_texts.py (SPEC §6.4), each with its reading in kana,
 * which is what the romaji is made from, and tags saying which keys it
 * needs, so a guide step can pick sentences typed on the keys decided so
 * far. "reviewed" is set by hand once a reading has been checked. A few
 * English lines are added here for the symbol keys.
 */
import extracted from "./texts.ja.json";

export type TextTag = "base" | "symbols" | "digits" | "en";

export interface PracticeText {
  id: string;
  display: string;
  kana: string;
  tags: TextTag[];
  source?: string;
  reviewed?: boolean;
}

const EN: PracticeText[] = [
  {
    id: "en-1",
    display: "keeb-on.studio/practice",
    kana: "keeb-on.studio/practice",
    tags: ["en", "symbols"],
  },
  {
    id: "en-2",
    display: "Hold the layer key, then press the arrow keys.",
    kana: "Hold the layer key, then press the arrow keys.",
    tags: ["en", "symbols"],
  },
  {
    id: "en-3",
    display: "A 40% keyboard puts the symbols you use most on the base layer.",
    kana: "A 40% keyboard puts the symbols you use most on the base layer.",
    tags: ["en", "symbols", "digits"],
  },
];

export const TEXTS_JA: PracticeText[] = [
  ...(extracted as PracticeText[]),
  ...EN,
];

/** Texts carrying only the given tags (every tag of the text must be allowed). */
export function textsWithin(
  texts: PracticeText[],
  allowed: Set<TextTag>,
): PracticeText[] {
  return texts.filter((t) => t.tags.every((tag) => allowed.has(tag)));
}

/** A text other than `not`, at random; `not` itself when it is the only one. */
export function pickText(
  texts: PracticeText[],
  not?: PracticeText,
): PracticeText | undefined {
  const pool = texts.filter((t) => t.id !== not?.id);
  if (pool.length === 0) return not ?? texts[0];
  return pool[Math.floor(Math.random() * pool.length)];
}
