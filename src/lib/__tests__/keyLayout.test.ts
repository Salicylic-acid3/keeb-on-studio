/**
 * The on-screen keyboard's shape.
 *
 * Two failures are worth a test here. A row that does not add up to ROW_UNITS
 * pushes its last key off the edge of a fixed-width strip, silently — the
 * picker still renders, it is just missing a key. And a JIS layout that has
 * quietly become a relabelled ANSI one would leave ￥, ろ and the keys beside
 * the space bar unreachable, which is the thing this layout exists to fix.
 */
import {
  KEY_LAYOUT_70,
  KEY_LAYOUT_JIS,
  ROW_UNITS,
  getKeyLayout,
  isSpacer,
  rowWidth,
} from "../keyLayout";

describe("on-screen keyboard layouts", () => {
  it.each([
    ["ANSI", KEY_LAYOUT_70],
    ["JIS", KEY_LAYOUT_JIS],
  ])("lays %s out on the same grid, row by row", (_name, layout) => {
    layout.forEach((row, index) => {
      expect({ row: index, width: rowWidth(row) }).toEqual({
        row: index,
        width: ROW_UNITS,
      });
    });
  });

  it("draws JIS for the JIS setting and ANSI for everything else", () => {
    expect(getKeyLayout("JIS")).toBe(KEY_LAYOUT_JIS);
    expect(getKeyLayout("US")).toBe(KEY_LAYOUT_70);
    // "US (ANSI) for JP" is a US keyboard typing Japanese: the keys really are
    // where ANSI puts them, so relabelling is the whole of the difference.
    expect(getKeyLayout("US_JP")).toBe(KEY_LAYOUT_70);
    expect(getKeyLayout(undefined)).toBe(KEY_LAYOUT_70);
  });

  it("offers the JIS keys that ANSI has nowhere to put", () => {
    // Each of these is unreachable from the ANSI picture, so their absence
    // would mean a JIS user cannot bind them from the layout view at all.
    const jis = new Set(
      KEY_LAYOUT_JIS.flat()
        .filter((item) => !isSpacer(item))
        .map((item) => (isSpacer(item) ? -1 : item.code)),
    );
    const ansi = new Set(
      KEY_LAYOUT_70.flat()
        .filter((item) => !isSpacer(item))
        .map((item) => (isSpacer(item) ? -1 : item.code)),
    );

    for (const code of [
      0x89, // ￥   International3
      0x87, // ろ   International1
      0x8a, // 変換 International4
      0x8b, // 無変換 International5
      0x88, // カタカナ/ひらがな International2
      0x90, // かな  LANG1, what an Apple JIS keyboard sends
      0x91, // 英数  LANG2
      0x32, // ]    Non-US Hash
    ]) {
      expect(jis.has(code)).toBe(true);
      expect(ansi.has(code)).toBe(false);
    }
  });

  it("keeps the keys ANSI has and JIS does not", () => {
    const jis = KEY_LAYOUT_JIS.flat().filter((item) => !isSpacer(item));
    // Backslash is the clearest case: on JIS its ANSI position is taken by ￥
    // and Enter, and the key itself moves to the bottom row as ろ (0x87).
    expect(jis.some((item) => !isSpacer(item) && item.code === 0x31)).toBe(
      false,
    );
  });

  it("draws Enter as the two arms of one L-shaped key", () => {
    // A real JIS Enter spans the alpha and home rows. This grid draws
    // rectangles, so it draws two — both selecting Enter — rather than leaving
    // a hole where the upper arm belongs.
    const enters = KEY_LAYOUT_JIS.flat().filter(
      (item) => !isSpacer(item) && item.code === 0x28,
    );
    expect(enters).toHaveLength(2);
  });
});
