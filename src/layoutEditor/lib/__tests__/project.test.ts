import { rotateKeys, setMatrix } from "../edit";
import { importKle } from "../kle";
import {
  exportText,
  isProject,
  projectFileText,
  readLayoutText,
  rowsToJson,
} from "../project";
import { sampleProject } from "../sample";

function numbered() {
  const p = { ...importKle([["Esc", "Q"], ["Tab"]]), name: "My Board" };
  return setMatrix(
    p,
    new Map([
      [p.keys[0].id, { row: 0, col: 0 }],
      [p.keys[1].id, { row: 0, col: 1 }],
      [p.keys[2].id, { row: 1, col: 0 }],
    ]),
  );
}

describe("project files", () => {
  it("come back exactly as they were saved", () => {
    const base = numbered();
    const p = rotateKeys(base, [base.keys[1].id], { x: 1, y: 1 }, 15);
    expect(readLayoutText(projectFileText(p))).toEqual(p);
    const turned = sampleProject();
    expect(readLayoutText(projectFileText(turned))).toEqual(turned);
  });

  it("are refused when damaged", () => {
    const text = projectFileText(numbered()).replace('"cx": 0.5', '"cx": "x"');
    expect(() => readLayoutText(text)).toThrow();
    expect(isProject({ name: "", keys: [{}], groups: [] })).toBe(false);
    expect(isProject(numbered())).toBe(true);
  });
});

describe("readLayoutText", () => {
  it("still reads KLE data, Raw data and vial.json", () => {
    expect(readLayoutText('[["A","B"]]').keys).toHaveLength(2);
    expect(readLayoutText('[{w:2},"A"],\n["B"]').keys).toHaveLength(2);
    const vial = JSON.stringify({ layouts: { keymap: [["0,0", "0,1"]] } });
    expect(readLayoutText(vial).keys[1].matrix).toEqual({ row: 0, col: 1 });
    expect(() => readLayoutText("nope")).toThrow();
  });
});

describe("exportText", () => {
  it("writes a row to a line", () => {
    expect(rowsToJson([["A"], [{ w: 2 }, "B"]])).toBe(
      '[\n  ["A"],\n  [{"w":2},"B"]\n]',
    );
    expect(rowsToJson([])).toBe("[]");
  });

  it("gives VIA and Vial the matrix whatever is on screen, without the name", () => {
    const p = numbered();
    const via = exportText(p, "via", "legend");
    expect(JSON.parse(via.text)).toEqual([["0,0", "0,1"], ["1,0"]]);
    expect(via.fileName).toBe("My_Board-via-keymap.json");
    expect(exportText(p, "vial", "both").text).toBe(via.text);
  });

  it("gives KLE the layer on screen, with the name", () => {
    const p = numbered();
    expect(JSON.parse(exportText(p, "kle-json", "legend").text)).toEqual([
      { name: "My Board" },
      ["Esc", "Q"],
      ["Tab"],
    ]);
    expect(exportText(p, "kle-raw", "matrix").text).toBe(
      '{name:"My Board"},\n["0,0","0,1"],\n["1,0"]',
    );
    expect(exportText(p, "kle-raw", "matrix").fileName).toBe(
      "My_Board-matrix.txt",
    );
  });

  it("names files after the layout, falling back to 'layout'", () => {
    const p = { ...numbered(), name: " " };
    expect(exportText(p, "project", "legend").fileName).toBe(
      "layout.keebon-layout.json",
    );
    const ja = { ...numbered(), name: "試作 1号" };
    expect(exportText(ja, "project", "legend").fileName).toBe(
      "試作_1号.keebon-layout.json",
    );
  });
});
