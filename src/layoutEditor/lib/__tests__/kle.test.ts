import {
  exportKle,
  importKle,
  kleToRawData,
  parseKleText,
  type KleDocument,
} from "../kle";
import type { LayoutProject } from "../model";
import { sampleProject } from "../sample";

/** What a round trip has to keep: where each key is and what it says. */
function shape(project: LayoutProject) {
  return project.keys
    .map((k) => ({
      cx: Math.round(k.cx * 1e4) / 1e4,
      cy: Math.round(k.cy * 1e4) / 1e4,
      w: k.w,
      h: k.h,
      angle: k.angle,
      legends: k.legends,
      matrix: k.matrix,
      option: k.option,
      kle: k.kle,
    }))
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

describe("importKle", () => {
  it("places keys by their centre", () => {
    const p = importKle([
      ["A", { w: 2 }, "B"],
      [{ x: 0.5 }, "C"],
    ]);
    expect(p.keys.map((k) => [k.cx, k.cy, k.w])).toEqual([
      [0.5, 0.5, 1],
      [2, 0.5, 2],
      [1, 1.5, 1],
    ]);
    expect(p.groups).toEqual([]);
  });

  it("returns to the rotation origin when rx / ry are set, as KLE does", () => {
    const p = importKle([["A"], ["B"], [{ r: 90, rx: 5, ry: 3 }, "C"], ["D"]]);
    const [, , c, d] = p.keys;
    // C sits at (5,3) before turning; a quarter turn around (5,3) puts its
    // centre at (4.5, 3.5). D is one row below C in the turned frame.
    expect([c.cx, c.cy]).toEqual([4.5, 3.5]);
    expect([d.cx, d.cy]).toEqual([3.5, 3.5]);
    expect(c.groupId).toBeDefined();
    expect(c.groupId).toBe(d.groupId);
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0].pivot).toEqual({ x: 5, y: 3 });
  });

  it("reads a matrix position and a layout option apart from legends", () => {
    const p = importKle([["0,0", "0,1\n\n\n1,0", "Esc"]]);
    expect(p.keys[0].matrix).toEqual({ row: 0, col: 0 });
    expect(p.keys[0].legends[0]).toBe("");
    expect(p.keys[1].matrix).toEqual({ row: 0, col: 1 });
    expect(p.keys[1].option).toEqual({ index: 1, choice: 0 });
    expect(p.keys[2].matrix).toBeUndefined();
    expect(p.keys[2].legends[0]).toBe("Esc");
  });

  it("honours the alignment flag", () => {
    const p = importKle([[{ a: 7 }, "Mid"]]);
    expect(p.keys[0].legends[4]).toBe("Mid");
  });

  it("keeps the name and the second rectangle of a stepped key", () => {
    const p = importKle([
      { name: "Test" },
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, "Enter"],
    ]);
    expect(p.name).toBe("Test");
    expect(p.keys[0].kle).toEqual({ x2: -0.25, y2: 0, w2: 1.5, h2: 1 });
  });

  it("rejects what is not rows", () => {
    expect(() => importKle({})).toThrow();
    expect(() => importKle([["A", { r: 5 }, "B"]])).toThrow();
  });
});

describe("exportKle", () => {
  const cases: Record<string, KleDocument> = {
    plain: [
      ["A", { w: 2 }, "B"],
      [{ x: 0.5 }, "C"],
      [{ y: 0.25 }, "D"],
    ],
    rotated: [
      ["A", "B"],
      [{ r: 15, rx: 4, ry: 2.5, y: -1, x: -1 }, "C", "D"],
      ["E"],
      [{ r: -15, rx: 4, ry: 2.5 }, "F"],
      [{ r: 30, rx: 1, ry: 1, w: 1.5 }, "G"],
    ],
    onlyRotated: [[{ r: 20, rx: 2, ry: 2 }, "A", "B"]],
    stepped: [
      { name: "ISO" },
      ["A", { x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, "Enter"],
    ],
    decorated: [
      [{ c: "#ff0000", t: "#ffffff", p: "DSA" }, "A", { g: true }, "B"],
      [{ g: false, c: "#cccccc", d: true }, "label", { n: true }, "F"],
    ],
    legends: [["!\n1", { a: 7 }, "Mid", { a: 0 }, "a\nb\nc\nd\ne\nf"]],
    matrix: [["0,0", "0,1\n\n\n1,0"], ["1,0"]],
  };

  for (const [name, doc] of Object.entries(cases)) {
    it(`round-trips ${name}`, () => {
      const before = importKle(doc);
      const layer = name === "matrix" ? "matrix" : "legend";
      const after = importKle(exportKle(before, layer));
      expect(shape(after)).toEqual(shape(before));
      expect(after.name).toBe(before.name);
    });
  }

  it("round-trips the sample", () => {
    const before = sampleProject();
    expect(shape(importKle(exportKle(before, "legend")))).toEqual(
      shape(before),
    );
  });

  it("writes the matrix where VIA and Vial read it", () => {
    const p = importKle([["Esc", "Q"]]);
    p.keys[0].matrix = { row: 0, col: 0 };
    p.keys[1].matrix = { row: 0, col: 1 };
    expect(exportKle(p, "matrix")).toEqual([["0,0", "0,1"]]);
    expect(exportKle(p, "legend")).toEqual([["Esc", "Q"]]);
  });

  it("writes a moved key at its new place", () => {
    const p = importKle([["A", "B"]]);
    p.keys[1].cx += 0.5;
    p.keys[1].cy += 1;
    expect(exportKle(p, "legend")).toEqual([["A"], [{ x: 1.5 }, "B"]]);
  });
});

describe("parseKleText", () => {
  it("reads downloaded JSON", () => {
    expect(parseKleText('[["A","B"]]')).toEqual([["A", "B"]]);
  });

  it("reads the Raw data box", () => {
    const raw = '[{a:7,w:1.5},"Tab","{x:1}"],\n[{x:0.25},"A:",":"]';
    expect(parseKleText(raw)).toEqual([
      [{ a: 7, w: 1.5 }, "Tab", "{x:1}"],
      [{ x: 0.25 }, "A:", ":"],
    ]);
  });

  it("reads layouts.keymap out of a VIA definition or vial.json", () => {
    const text = JSON.stringify({ layouts: { keymap: [["0,0"]] } });
    expect(parseKleText(text)).toEqual([["0,0"]]);
  });

  it("rejects other text", () => {
    expect(() => parseKleText("")).toThrow();
    expect(() => parseKleText("hello")).toThrow();
    expect(() => parseKleText('{"a":1}')).toThrow();
  });

  it("writes Raw data it can read back", () => {
    const doc: KleDocument = [{ name: "N" }, [{ w: 1.5 }, 'A"b', "C\nD"]];
    const raw = kleToRawData(doc);
    expect(raw).toBe('{name:"N"},\n[{w:1.5},"A\\"b","C\\nD"]');
    expect(parseKleText(raw)).toEqual(doc);
  });
});

describe("exportKle numbers", () => {
  it("writes turned clusters without rounding residue", () => {
    const text = JSON.stringify(exportKle(sampleProject(), "legend"));
    expect(text).not.toMatch(/\d\.\d{5,}/);
    expect(text).toContain('{"r":10,"rx":5.75,"ry":3.6,"x":-2.75,"w":1.25}');
  });
});
