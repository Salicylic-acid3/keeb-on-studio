import { testBoard } from "../../../keyTest/lib/boards";
import { estimateMeta, keyboardMeta } from "../metadata";

describe("keyboard metadata", () => {
  it("estimates a 40% with its thumb row and home row", () => {
    const b = testBoard("goforty_max_ortho")!;
    const m = estimateMeta(b);
    expect(m.sizeClass).toBe("40");
    expect(m.allowGuide).toEqual(["30", "40"]);
    expect(m.thumbKeys.length).toBeGreaterThanOrEqual(3);
    expect(m.homeRow.L.map((p) => b.keys[p].label.main)).toEqual([
      "A",
      "S",
      "D",
      "F",
    ]);
    expect(m.homeRow.R.map((p) => b.keys[p].label.main)).toEqual([
      "J",
      "K",
      "L",
      "-",
    ]);
    expect(m.defaultLayerKeys.some((k) => k.layer === 2)).toBe(true);
  });

  it("calls a tenkey a pad with no guide", () => {
    const m = estimateMeta(testBoard("eztenkey")!);
    expect(m.sizeClass).toBe("pad");
    expect(m.defaultGuide).toBeNull();
  });

  it("has stored values for every registered keyboard", () => {
    for (const id of [
      "goforty_max_ortho",
      "clickboard_ergotrack",
      "ateighty_us",
    ]) {
      expect(keyboardMeta(testBoard(id)!).id).toBe(id);
    }
    expect(keyboardMeta(testBoard("clickboard_ergotrack")!).split).toBe(true);
  });
});
