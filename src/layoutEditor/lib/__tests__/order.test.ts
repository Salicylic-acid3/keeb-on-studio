import {
  fillLegends,
  mainAndSub,
  setLegendSlot,
  setMainAndSub,
  setMatrix,
  templateProject,
} from "../edit";
import { labelForCode, rowPreset } from "../keyLabels";
import { exportKle, importKle } from "../kle";
import {
  matrixRows,
  matrixStats,
  parseMatrix,
  readingRows,
  splitAt,
  stepInRows,
  suggestMatrix,
} from "../order";
import { sampleProject } from "../sample";

const names = (rows: ReturnType<typeof readingRows>) =>
  rows.map((r) => r.map((k) => k.legends[0]).join(" "));

describe("readingRows", () => {
  it("reads rows top to bottom, left to right, turned keys by where they sit", () => {
    expect(names(readingRows(sampleProject().keys))).toEqual([
      "Esc Q W E R T Y U I O P BS",
      "Tab A S D F G H J K L Enter",
      "Shift Z X C V B N M , . Shift",
      "Alt Space Space Fn",
    ]);
  });

  it("keeps a slightly staggered row together and skips decals", () => {
    const p = importKle([
      ["A", { y: 0.25 }, "B", { y: -0.25, d: true }, "x"],
      ["C"],
    ]);
    expect(names(readingRows(p.keys))).toEqual(["A B", "C"]);
  });

  it("steps through the keys and stops at the ends", () => {
    const p = importKle([["A", "B"], ["C"]]);
    const rows = readingRows(p.keys);
    const [a, b, c] = p.keys;
    expect(stepInRows(rows, a.id, 1)).toBe(b.id);
    expect(stepInRows(rows, b.id, 1)).toBe(c.id);
    expect(stepInRows(rows, c.id, 1)).toBeNull();
    expect(stepInRows(rows, a.id, -1)).toBeNull();
  });
});

describe("split keyboards", () => {
  const split = templateProject("split36");

  it("finds the gap between the halves", () => {
    expect(splitAt(split.keys)).toBe(7);
    expect(splitAt(sampleProject().keys)).toBeNull();
  });

  it("numbers the right half after the left when stacked", () => {
    expect(matrixRows(split, "across")).toHaveLength(4);
    const stacked = matrixRows(split, "stacked");
    expect(stacked).toHaveLength(8);
    expect(stacked[0]).toHaveLength(6);
    expect(stacked[4][0].cx).toBeGreaterThan(7);
  });
});

describe("suggestMatrix", () => {
  it("numbers an empty layout row by row", () => {
    const p = importKle([
      ["A", "B", "C"],
      ["D", "E"],
    ]);
    const s = suggestMatrix(p, "across");
    expect(p.keys.map((k) => s.get(k.id))).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it("carries on from positions already given and skips used ones", () => {
    let p = importKle([
      ["A", "B", "C"],
      ["D", "E"],
    ]);
    const [a, b, c, d, e] = p.keys;
    p = setMatrix(
      p,
      new Map([
        [a.id, { row: 2, col: 3 }],
        [e.id, { row: 3, col: 0 }],
      ]),
    );
    const s = suggestMatrix(p, "across");
    expect(s.has(a.id)).toBe(false);
    expect(s.get(b.id)).toEqual({ row: 2, col: 4 });
    expect(s.get(c.id)).toEqual({ row: 2, col: 5 });
    // 3,0 is E's, so D takes the next free column of row 3.
    expect(s.get(d.id)).toEqual({ row: 3, col: 1 });
  });

  it("gives the right half its own rows when stacked", () => {
    const split = templateProject("split36");
    const s = suggestMatrix(split, "stacked");
    const rightTop = split.keys.find((k) => k.cy === 0.5 && k.cx === 8.5)!;
    expect(s.get(rightTop.id)).toEqual({ row: 4, col: 0 });
    expect(suggestMatrix(split, "across").get(rightTop.id)).toEqual({
      row: 0,
      col: 6,
    });
  });
});

describe("matrixStats", () => {
  it("counts the extent, the gaps and the clashes", () => {
    let p = importKle([["A", "B", "C"], ["D"]]);
    const [a, b, c] = p.keys;
    p = setMatrix(
      p,
      new Map([
        [a.id, { row: 0, col: 0 }],
        [b.id, { row: 1, col: 2 }],
        [c.id, { row: 1, col: 2 }],
      ]),
    );
    const s = matrixStats(p);
    expect([s.rows, s.cols, s.missing, s.free]).toEqual([2, 3, 1, 4]);
    expect(s.duplicates).toEqual(new Set([b.id, c.id]));
  });

  it("reads positions typed loosely", () => {
    expect(parseMatrix("2,5")).toEqual({ row: 2, col: 5 });
    expect(parseMatrix(" 10 3 ")).toEqual({ row: 10, col: 3 });
    expect(parseMatrix("2-5")).toEqual({ row: 2, col: 5 });
    expect(parseMatrix("25")).toBeNull();
    expect(parseMatrix("a,b")).toBeNull();
  });
});

describe("legends", () => {
  it("puts a shifted legend above the main one, as KLE prints them", () => {
    let p = importKle([["x"]]);
    const id = p.keys[0].id;
    p = setMainAndSub(p, id, "1", "!");
    expect(mainAndSub(p.keys[0])).toEqual({ main: "1", sub: "!" });
    expect(exportKle(p, "legend")).toEqual([["!\n1"]]);
    p = setMainAndSub(p, id, "A", "");
    expect(exportKle(p, "legend")).toEqual([["A"]]);
    expect(setMainAndSub(p, id, "A", "")).toBe(p);
  });

  it("reads KLE's two-legend keys back the same way", () => {
    const p = importKle([["!\n1", "Tab"]]);
    expect(mainAndSub(p.keys[0])).toEqual({ main: "1", sub: "!" });
    expect(mainAndSub(p.keys[1])).toEqual({ main: "Tab", sub: "" });
  });

  it("sets any of the twelve positions and pours a row in", () => {
    let p = importKle([["", "", ""]]);
    p = setLegendSlot(p, p.keys[0].id, 4, "mid");
    expect(p.keys[0].legends[4]).toBe("mid");
    p = fillLegends(
      p,
      p.keys.map((k) => k.id),
      rowPreset("number", "us"),
    );
    expect(p.keys.map(mainAndSub)).toEqual([
      { main: "1", sub: "!" },
      { main: "2", sub: "@" },
      { main: "3", sub: "#" },
    ]);
  });

  it("carries both layers out together", () => {
    let p = importKle([["A", "a\n\n\nz"]]);
    p = setMatrix(p, new Map(p.keys.map((k, i) => [k.id, { row: 0, col: i }])));
    expect(exportKle(p, "both")).toEqual([
      [{ a: 0 }, "A\n\n\n0,0", "a\n\n\nz\n\n0,1"],
    ]);
  });
});

describe("labelForCode", () => {
  it("names keys the way keycaps do", () => {
    expect(labelForCode("KeyQ", "us")).toEqual({ main: "Q" });
    expect(labelForCode("Escape", "us")).toEqual({ main: "Esc" });
    expect(labelForCode("F11", "jis")).toEqual({ main: "F11" });
    expect(labelForCode("Digit2", "us")).toEqual({ main: "2", sub: "@" });
    expect(labelForCode("Digit2", "jis")).toEqual({ main: "2", sub: '"' });
    expect(labelForCode("IntlYen", "jis")).toEqual({ main: "¥", sub: "|" });
    expect(labelForCode("IntlYen", "us")).toBeNull();
    expect(labelForCode("Unidentified", "us")).toBeNull();
  });

  it("has a longer number row on JIS", () => {
    expect(rowPreset("number", "us")).toHaveLength(12);
    expect(rowPreset("number", "jis")).toHaveLength(13);
    expect(rowPreset("top", "us")[0]).toEqual({ main: "Q" });
  });
});
