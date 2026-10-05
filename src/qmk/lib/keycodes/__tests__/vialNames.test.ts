import { parseVialKeycode, vialKeycodeName } from "../vialNames";
import { QMK_KEYCODES } from "../qmkKeycodesV6.generated";
import { parseKeycode } from "../qmkKeycode";

describe("Vial keycode names", () => {
  test("every keycode survives a trip through Vial's spelling", () => {
    const codes = [
      ...QMK_KEYCODES.map(([, c]) => c),
      ...[
        "LT(3,KC_A)",
        "LCTL(KC_C)",
        "LCTL_T(KC_ESC)",
        "MT(MOD_LCTL|MOD_LSFT,KC_A)",
        "TD(5)",
        "QK_MACRO_3",
        "OSL(2)",
        "TO(11)",
      ].map((s) => parseKeycode(s)!),
    ];
    for (const c of codes)
      expect([c, parseVialKeycode(vialKeycodeName(c))]).toEqual([c, c]);
  });

  test("the older names Vial writes", () => {
    expect(vialKeycodeName(parseKeycode("KC_CAPS")!)).toBe("KC_CAPSLOCK");
    expect(vialKeycodeName(parseKeycode("LT(1,KC_SPC)")!)).toBe(
      "LT1(KC_SPACE)",
    );
    expect(parseVialKeycode("KC_BSPACE")).toBe(parseKeycode("KC_BSPC"));
  });
});
