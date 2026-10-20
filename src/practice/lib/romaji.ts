/**
 * Japanese practice text as the romaji a person may type for it.
 *
 * A sentence in kana is cut into units (one kana, a kana with its small
 * ゃゅょ, a っ with the kana after it), and each unit lists every spelling
 * an IME accepts for it: し is si, shi or ci; ちゃ is tya, cha or cya, and
 * also ti + xya. The practice accepts any of them (SPEC §6.1), so a person
 * types the way they always do and is never told their spelling is wrong.
 *
 * Only kana are expanded. Anything else -- ASCII, digits, punctuation --
 * is one unit that is typed as itself; a full-width character is folded
 * to its ASCII form first (、 is a comma, ０ a zero).
 */

export interface RomajiUnit {
  /** The text this unit stands for, as shown to the person. */
  text: string;
  /** Every accepted spelling, preferred one first. */
  alts: string[];
}

const VOWELS = "aiueo";

// Single kana. The first spelling is the one shown before anything is typed.
const KANA: Record<string, string[]> = {
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu", "whu"],
  え: ["e"],
  お: ["o"],
  か: ["ka", "ca"],
  き: ["ki"],
  く: ["ku", "cu", "qu"],
  け: ["ke"],
  こ: ["ko", "co"],
  さ: ["sa"],
  し: ["si", "shi", "ci"],
  す: ["su"],
  せ: ["se", "ce"],
  そ: ["so"],
  た: ["ta"],
  ち: ["ti", "chi"],
  つ: ["tu", "tsu"],
  て: ["te"],
  と: ["to"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  ゐ: ["wi"],
  ゑ: ["we"],
  を: ["wo"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["zi", "ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  ゔ: ["vu"],
  ぁ: ["xa", "la"],
  ぃ: ["xi", "li", "xyi", "lyi"],
  ぅ: ["xu", "lu"],
  ぇ: ["xe", "le", "xye", "lye"],
  ぉ: ["xo", "lo"],
  ゃ: ["xya", "lya"],
  ゅ: ["xyu", "lyu"],
  ょ: ["xyo", "lyo"],
  ゎ: ["xwa", "lwa"],
  ゕ: ["xka", "lka"],
  ゖ: ["xke", "lke"],
  ー: ["-"],
};

// Two kana typed as one syllable. Besides these, every pair of a kana and
// a small kana may be typed as the two separately (ki + xya), added below.
const PAIRS: Record<string, string[]> = {
  きゃ: ["kya"],
  きゅ: ["kyu"],
  きょ: ["kyo"],
  しゃ: ["sya", "sha"],
  しゅ: ["syu", "shu"],
  しょ: ["syo", "sho"],
  しぇ: ["sye", "she"],
  ちゃ: ["tya", "cha", "cya"],
  ちゅ: ["tyu", "chu", "cyu"],
  ちょ: ["tyo", "cho", "cyo"],
  ちぇ: ["tye", "che", "cye"],
  にゃ: ["nya"],
  にゅ: ["nyu"],
  にょ: ["nyo"],
  ひゃ: ["hya"],
  ひゅ: ["hyu"],
  ひょ: ["hyo"],
  みゃ: ["mya"],
  みゅ: ["myu"],
  みょ: ["myo"],
  りゃ: ["rya"],
  りゅ: ["ryu"],
  りょ: ["ryo"],
  ぎゃ: ["gya"],
  ぎゅ: ["gyu"],
  ぎょ: ["gyo"],
  じゃ: ["zya", "ja", "jya"],
  じゅ: ["zyu", "ju", "jyu"],
  じょ: ["zyo", "jo", "jyo"],
  じぇ: ["zye", "je", "jye"],
  ぢゃ: ["dya"],
  ぢゅ: ["dyu"],
  ぢょ: ["dyo"],
  びゃ: ["bya"],
  びゅ: ["byu"],
  びょ: ["byo"],
  ぴゃ: ["pya"],
  ぴゅ: ["pyu"],
  ぴょ: ["pyo"],
  ふぁ: ["fa"],
  ふぃ: ["fi", "fyi"],
  ふぇ: ["fe", "fye"],
  ふぉ: ["fo"],
  ふゅ: ["fyu"],
  うぃ: ["wi", "whi"],
  うぇ: ["we", "whe"],
  うぉ: ["who"],
  ゔぁ: ["va"],
  ゔぃ: ["vi"],
  ゔぇ: ["ve"],
  ゔぉ: ["vo"],
  てぃ: ["thi", "t'i"],
  てゅ: ["thu"],
  でぃ: ["dhi", "d'i"],
  でゅ: ["dhu"],
  とぅ: ["twu", "t'u"],
  どぅ: ["dwu", "d'u"],
  いぇ: ["ye"],
  くぁ: ["qa", "kwa"],
  くぃ: ["qi"],
  くぇ: ["qe"],
  くぉ: ["qo"],
  ぐぁ: ["gwa"],
  つぁ: ["tsa"],
  つぃ: ["tsi"],
  つぇ: ["tse"],
  つぉ: ["tso"],
};

const SMALL_TSU = ["xtu", "ltu", "xtsu", "ltsu"];
const N_ALWAYS = ["nn", "xn", "n'"];

/** Full-width forms folded to what is typed for them. */
const FOLD: Record<string, string> = {
  "、": ",",
  "。": ".",
  "，": ",",
  "．": ".",
  "！": "!",
  "？": "?",
  "「": "[",
  "」": "]",
  "『": "[",
  "』": "]",
  "（": "(",
  "）": ")",
  "・": "/",
  "／": "/",
  "：": ":",
  "；": ";",
  "～": "~",
  "〜": "~",
  "＠": "@",
  "＃": "#",
  "＆": "&",
  "＊": "*",
  "＋": "+",
  "－": "-",
  "＝": "=",
  "％": "%",
  "　": " ",
  〇: "0",
};

/** Katakana to hiragana (ー and small kana included), other text as is. */
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

function foldChar(c: string): string {
  if (FOLD[c]) return FOLD[c];
  const code = c.charCodeAt(0);
  // Full-width ASCII (！ to ～).
  if (code >= 0xff01 && code <= 0xff5e)
    return String.fromCharCode(code - 0xfee0);
  return c;
}

function isKana(c: string): boolean {
  return c in KANA || c === "ん" || c === "っ";
}

function uniq(alts: string[]): string[] {
  return [...new Set(alts)];
}

/** The spellings of a kana unit, ignoring っ and ん before it. */
function plainAlts(text: string): string[] {
  if (text.length === 2) {
    const [a, b] = text;
    const pair = PAIRS[text] ?? [];
    const apart = (KANA[a] ?? []).flatMap((x) =>
      (KANA[b] ?? []).map((y) => x + y),
    );
    return uniq([...pair, ...apart]);
  }
  return KANA[text] ?? [text];
}

/**
 * Cut a text into the units a person types, each with its spellings.
 *
 * ん may be typed as a single n when the kana after it does not start with
 * a vowel, n or y (so "kanji" works, while "kinen" needs "kinnen"); っ is
 * typed by doubling the next consonant or as xtu, and is one unit with the
 * kana it doubles.
 */
export function tokenize(text: string): RomajiUnit[] {
  const kana = toHiragana(text);
  // First pass: raw units (kana syllables, with pairs joined), っ and ん
  // left as their own units for the second pass.
  const raw: Array<{ text: string; alts: string[] | null }> = [];
  for (let i = 0; i < kana.length; i++) {
    const c = kana[i];
    if (c === "っ" || c === "ん") {
      raw.push({ text: c, alts: null });
      continue;
    }
    if (!isKana(c)) {
      raw.push({ text: c, alts: [foldChar(c)] });
      continue;
    }
    const next = kana[i + 1];
    const small = next && /[ぁぃぅぇぉゃゅょゎ]/.test(next);
    if (small && (PAIRS[c + next] || KANA[c])) {
      raw.push({ text: c + next, alts: plainAlts(c + next) });
      i++;
    } else {
      raw.push({ text: c, alts: plainAlts(c) });
    }
  }

  // Second pass, from the end so a っ can see the unit after it (and a
  // っ before another っ sees one already merged).
  const units: RomajiUnit[] = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i];
    if (r.alts) {
      units.unshift({ text: r.text, alts: r.alts });
      continue;
    }
    if (r.text === "ん") {
      const next = units[0];
      const single =
        next !== undefined &&
        next.alts.some((a) => {
          const c = a[0];
          return (
            c !== undefined && !VOWELS.includes(c) && c !== "n" && c !== "y"
          );
        });
      const alts = single ? ["n", ...N_ALWAYS] : N_ALWAYS;
      units.unshift({ text: "ん", alts });
      continue;
    }
    // っ: doubled consonant of the unit after it, or xtu.
    const next = units.shift();
    if (!next) {
      units.unshift({ text: "っ", alts: SMALL_TSU });
      continue;
    }
    const doubled = next.alts
      .filter((a) => {
        const c = a[0];
        return (
          c !== undefined && /[a-z]/.test(c) && !VOWELS.includes(c) && c !== "n"
        );
      })
      .map((a) => a[0] + a);
    const spelled = SMALL_TSU.flatMap((x) => next.alts.map((a) => x + a));
    units.unshift({
      text: "っ" + next.text,
      alts: uniq([...doubled, ...spelled]),
    });
  }
  return units;
}

/** The spelling shown for a unit before anything is typed. */
export function preferred(unit: RomajiUnit): string {
  return unit.alts[0] ?? "";
}
