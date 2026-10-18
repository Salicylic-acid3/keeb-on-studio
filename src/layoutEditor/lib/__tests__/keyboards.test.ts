import { ERGOTRACK } from "../../../lib/layouts";
import { isIsoEnter, mainAndSub } from "../edit";
import { findOverlaps } from "../geometry";
import { keyboardProject, keyboardTemplates } from "../keyboards";

describe("keyboard templates", () => {
  it("lists every keyboard once and opens each without overlapping keys", () => {
    const all = keyboardTemplates();
    expect(all.length).toBeGreaterThanOrEqual(28);
    expect(new Set(all.map((k) => k.id)).size).toBe(all.length);
    for (const { id, name } of all) {
      const project = keyboardProject(id);
      expect(project).not.toBeNull();
      expect(project!.name).toBe(name);
      expect(project!.keys.length).toBeGreaterThan(3);
      // A few real layouts have keys that touch a little (turned thumb keys).
      expect(findOverlaps(project!.keys).size).toBeLessThanOrEqual(12);
    }
  });

  it("carries the matrix positions of a QMK keyboard", () => {
    const project = keyboardProject("goforty_ortho")!;
    expect(project.keys.every((k) => k.matrix)).toBe(true);
  });

  it("places a ZMK keyboard's keys where its physical layout has them", () => {
    const project = keyboardProject("clickboard_ergotrack")!;
    expect(project.keys).toHaveLength(ERGOTRACK.keys.length);
    const first = project.keys[0];
    expect(first.cx).toBeCloseTo(0.75);
    expect(first.cy).toBeCloseTo(0.88);
    // A thumb key turned 15 degrees about its own centre stays there.
    const turned = project.keys.find((k) => k.angle === 15)!;
    expect(turned.cx).toBeCloseTo(4.95);
    expect(turned.cy).toBeCloseTo(4.91);
  });

  it("opens the ErgoTrack with no keys clashing", () => {
    const project = keyboardProject("clickboard_ergotrack")!;
    expect(findOverlaps(project.keys).size).toBe(0);
  });

  it("draws the InSixty JP's Enter as an ISO Enter at the right edge", () => {
    const project = keyboardProject("insixty_jp")!;
    const enter = project.keys.find(
      (k) => k.matrix?.row === 7 && k.matrix.col === 7,
    )!;
    expect(isIsoEnter(enter)).toBe(true);
    expect(enter.cx + enter.w / 2).toBeCloseTo(16);
    expect(enter.cy - enter.h / 2).toBeCloseTo(1);
    expect(findOverlaps(project.keys).size).toBe(0);
  });

  it("fills in the legends of the default keymap", () => {
    const legend = (id: string, row: number, col: number) => {
      const key = keyboardProject(id)!.keys.find(
        (k) => k.matrix?.row === row && k.matrix.col === col,
      )!;
      return mainAndSub(key);
    };
    expect(legend("goforty_jp", 0, 1)).toEqual({ main: "Q", sub: "" });
    expect(legend("goforty_jp", 0, 0)).toEqual({ main: "Tab", sub: "" });
    // Its Enter sits at another matrix position in the drawing.
    expect(legend("goforty_jp", 1, 11)).toEqual({ main: "Enter", sub: "" });
    // Every keyboard opens with most of its keys named.
    for (const { id } of keyboardTemplates()) {
      const keys = keyboardProject(id)!.keys;
      const named = keys.filter((k) => mainAndSub(k).main).length;
      expect([id, named / keys.length > 0.6]).toEqual([id, true]);
    }
    const ergotrack = keyboardProject("clickboard_ergotrack")!;
    expect(mainAndSub(ergotrack.keys[0])).toEqual({ main: "Esc", sub: "" });
    expect(mainAndSub(ergotrack.keys[1])).toEqual({ main: "1", sub: "!" });
  });

  it("draws the ClickBoard ErgoMini as built, not as a plain grid", () => {
    // Its vial.json on the older branches was the simplified grid of
    // keyboard.json; the real board has staggered columns, four thumb keys
    // turned to the hand and half-height up and down arrows.
    const ergomini = keyboardProject("clickboard_ergomini")!;
    expect(ergomini.keys).toHaveLength(50);
    expect(ergomini.keys.filter((k) => k.angle !== 0)).toHaveLength(4);
    expect(ergomini.keys.filter((k) => k.h === 0.5)).toHaveLength(4);
    // As in the VIA definition, the left thumb keys touch at their corners
    // by a few hundredths of a unit; nothing else overlaps.
    const clashes = ergomini.keys.filter((k) =>
      findOverlaps(ergomini.keys).has(k.id),
    );
    expect(
      clashes.map((k) => `${k.matrix!.row},${k.matrix!.col}`).sort(),
    ).toEqual(["3,3", "3,4", "3,5"]);
  });

  it("knows no keyboard by a wrong id", () => {
    expect(keyboardProject("nope")).toBeNull();
  });
});
