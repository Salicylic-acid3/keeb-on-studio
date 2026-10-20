import { tokenize } from "../romaji";
import {
  expected,
  isDone,
  press,
  romajiLine,
  startRun,
  type Run,
} from "../engine";

const all = () => true;

function typeAll(
  run: Run,
  text: string,
  mode: "stop" | "advance" = "stop",
  typeable: (c: string) => boolean = all,
) {
  const results: string[] = [];
  let t = 0;
  for (const ch of text) {
    const r = press(run, ch, mode, typeable, ++t);
    run = r.run;
    results.push(r.result);
  }
  return { run, results };
}

describe("tokenize", () => {
  it("expands each kana to its accepted spellings", () => {
    expect(tokenize("し").map((u) => u.alts)).toEqual([["si", "shi", "ci"]]);
    expect(tokenize("つ")[0].alts).toEqual(["tu", "tsu"]);
    expect(tokenize("ふ")[0].alts).toEqual(["fu", "hu"]);
    expect(tokenize("ぢ")[0].alts).toEqual(["di"]);
  });

  it("joins a kana with its small kana, and also allows them apart", () => {
    const [u] = tokenize("ちゃ");
    expect(u.text).toBe("ちゃ");
    expect(u.alts).toEqual(
      expect.arrayContaining(["tya", "cha", "cya", "tixya", "chilya"]),
    );
  });

  it("types っ by doubling the next consonant or as xtu", () => {
    const [u] = tokenize("った");
    expect(u.text).toBe("った");
    expect(u.alts).toEqual(expect.arrayContaining(["tta", "xtuta", "ltuta"]));
    expect(u.alts).not.toContain("ta");
  });

  it("lets ん be a single n only before a consonant other than n or y", () => {
    expect(tokenize("んか")[0].alts).toEqual(["n", "nn", "xn", "n'"]);
    expect(tokenize("んあ")[0].alts).toEqual(["nn", "xn", "n'"]);
    expect(tokenize("んな")[0].alts).toEqual(["nn", "xn", "n'"]);
    expect(tokenize("んや")[0].alts).toEqual(["nn", "xn", "n'"]);
    expect(tokenize("ん")[0].alts).toEqual(["nn", "xn", "n'"]);
  });

  it("folds katakana, long vowels and full-width punctuation", () => {
    const units = tokenize("キーボード、Ａ");
    expect(units.map((u) => u.alts[0]).join("")).toBe("ki-bo-do,A");
  });

  it("passes other characters through as themselves", () => {
    expect(tokenize("a-1 ").map((u) => u.alts)).toEqual([
      ["a"],
      ["-"],
      ["1"],
      [" "],
    ]);
  });
});

describe("press", () => {
  it("accepts every spelling of a unit", () => {
    for (const spelling of ["si", "shi", "ci"]) {
      const { run, results } = typeAll(startRun("し", all, 0), spelling);
      expect(results.every((r) => r === "ok")).toBe(true);
      expect(isDone(run)).toBe(true);
    }
  });

  it("settles a single n by the press after it", () => {
    const { run, results } = typeAll(startRun("かんじ", all, 0), "kanji");
    expect(results).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(isDone(run)).toBe(true);
    expect(run.done).toEqual(["ka", "n", "ji"]);
  });

  it("still accepts nn where n alone would do", () => {
    const { run } = typeAll(startRun("かんじ", all, 0), "kannji");
    expect(isDone(run)).toBe(true);
    expect(run.done).toEqual(["ka", "nn", "ji"]);
  });

  it("requires nn before a vowel", () => {
    const run0 = startRun("きんえん", all, 0);
    const { run, results } = typeAll(run0, "kinen");
    // "kine" went in, then "n" started the ん; "kinen" is not complete.
    expect(results).toEqual(["ok", "ok", "ok", "miss", "ok"]);
    expect(isDone(run)).toBe(false);
  });

  it("stops on a wrong press in stop mode and reports the character wanted", () => {
    const run0 = startRun("あい", all, 0);
    const r1 = press(run0, "x", "stop", all, 1);
    expect(r1.result).toBe("miss");
    expect(r1.run.index).toBe(0);
    expect(r1.run.presses[0]).toMatchObject({
      expected: "a",
      got: "x",
      ok: false,
    });
    const r2 = press(r1.run, "a", "stop", all, 2);
    expect(r2.result).toBe("ok");
    expect(expected(r2.run)).toBe("i");
  });

  it("moves on after a wrong press in advance mode", () => {
    const run0 = startRun("あい", all, 0);
    const r1 = press(run0, "x", "advance", all, 1);
    expect(r1.result).toBe("miss");
    expect(r1.run.index).toBe(1);
    expect(r1.run.wrong.has(0)).toBe(true);
    expect(r1.run.done).toEqual(["a"]);
  });

  it("skips a unit no key can type and records it", () => {
    const noSlash = (c: string) => c !== "/";
    const run0 = startRun("a/b", noSlash, 0);
    const { run } = typeAll(run0, "a", "stop", noSlash);
    // "/" was skipped on the way to "b".
    expect(run.index).toBe(2);
    expect(run.skipped).toEqual([{ unit: 1, text: "/", chars: ["/"] }]);
    expect(expected(run)).toBe("b");
  });

  it("prefers a spelling whose keys exist", () => {
    // No "h" key: し must be si or ci, never shi.
    const noH = (c: string) => c !== "h";
    const run0 = startRun("し", noH, 0);
    expect(run0.live).toEqual(["si", "ci"]);
    expect(expected(run0)).toBe("s");
  });

  it("records start and finish times", () => {
    const { run } = typeAll(startRun("あ", all, 0), "a");
    expect(run.startedAt).toBe(1);
    expect(run.finishedAt).toBe(1);
  });

  it("shows the romaji line by the spelling typed so far", () => {
    const run0 = startRun("しゃしん", all, 0);
    expect(romajiLine(run0)).toEqual({
      typed: "",
      current: "sya",
      rest: "sinn",
    });
    const r = typeAll(run0, "sh").run;
    expect(romajiLine(r)).toEqual({ typed: "sh", current: "a", rest: "sinn" });
  });
});
