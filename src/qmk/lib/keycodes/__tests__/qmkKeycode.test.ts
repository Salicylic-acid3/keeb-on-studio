import {
  decodeKeycode,
  encodeKeycode,
  formatKeycode,
  keycodeToText,
  parseKeycode,
  keycodeByName,
  MOD_LCTL,
  MOD_LSFT,
  MOD_RIGHT,
} from "../qmkKeycode";
import { QMK_KEYCODES } from "../qmkKeycodesV6.generated";

describe("qmkKeycode", () => {
  test("plain keycodes match QMK numbering (v6)", () => {
    expect(keycodeByName("KC_A")).toBe(0x0004);
    expect(keycodeByName("KC_SPC")).toBe(0x002c);
    expect(keycodeByName("KC_TRNS")).toBe(0x0001);
    expect(keycodeByName("QK_BOOT")).toBe(0x7c00);
    expect(keycodeByName("KC_LNG1")).toBe(0x0090);
  });

  test("every named keycode survives decode -> encode -> format -> parse", () => {
    for (const [, code] of QMK_KEYCODES) {
      const key = decodeKeycode(code);
      expect(encodeKeycode(key)).toBe(code);
      expect(parseKeycode(formatKeycode(key))).toBe(code);
    }
  });

  test.each([
    ["MO(1)", 0x5221],
    ["TO(2)", 0x5202],
    ["DF(4)", 0x5244],
    ["TG(3)", 0x5263],
    ["OSL(1)", 0x5281],
    ["TT(1)", 0x52c1],
    ["LT(1,KC_SPC)", 0x4100 | 0x2c],
    ["MT(MOD_LCTL,KC_A)", 0x2100 | 0x04],
    ["MT(MOD_LCTL|MOD_LSFT,KC_A)", 0x2300 | 0x04],
    ["MT(MOD_RSFT,KC_ENT)", 0x2000 | ((MOD_LSFT | MOD_RIGHT) << 8) | 0x28],
    ["LCTL_T(KC_A)", 0x2104],
    ["RSFT_T(KC_ENT)", 0x3228],
    ["LCTL(KC_C)", 0x0100 | 0x06],
    ["LCTL(LSFT(KC_A))", 0x0300 | 0x04],
    ["LSG(KC_S)", 0x0a00 | 0x16],
    ["RALT(KC_A)", 0x1404],
    ["OSM(MOD_LSFT)", 0x52a2],
    ["LM(1,MOD_LCTL)", 0x5000 | (1 << 5) | 1],
    ["TD(3)", 0x5703],
    ["QK_MACRO_2", 0x7702],
    ["M(2)", 0x7702],
    ["_______", 0x0001],
    ["XXXXXXX", 0x0000],
    ["0x1234", 0x1234],
  ])("parses %s", (text, code) => {
    expect(parseKeycode(text)).toBe(code);
  });

  test.each([
    [0x5221, "MO(1)"],
    [0x412c, "LT(1,KC_SPC)"],
    [0x2304, "MT(MOD_LCTL|MOD_LSFT,KC_A)"],
    [0x0306, "LCTL(LSFT(KC_C))"],
    [0x1404, "RALT(KC_A)"],
    [0x52a2, "OSM(MOD_LSFT)"],
    [0x5703, "TD(3)"],
    [0x7702, "QK_MACRO_2"],
    [0x0001, "KC_TRNS"],
    [0x0000, "KC_NO"],
    [0x7c00, "QK_BOOT"],
  ])("formats 0x%s", (code, text) => {
    expect(keycodeToText(code)).toBe(text);
    expect(parseKeycode(text)).toBe(code);
  });

  test("rejects what it cannot read instead of guessing", () => {
    expect(parseKeycode("KC_NOPE")).toBeUndefined();
    expect(parseKeycode("LT(99,KC_A)")).toBeUndefined();
    expect(parseKeycode("LT(1,MO(2))")).toBeUndefined();
    expect(parseKeycode("LCTL(RSFT(KC_A))")).toBeUndefined();
    expect(parseKeycode("MT(MOD_FOO,KC_A)")).toBeUndefined();
  });

  test("decodes structure", () => {
    expect(decodeKeycode(0x2304)).toEqual({
      kind: "modTap",
      mods: MOD_LCTL | MOD_LSFT,
      code: 0x04,
    });
    expect(decodeKeycode(0x412c)).toEqual({
      kind: "layerTap",
      layer: 1,
      code: 0x2c,
    });
    expect(decodeKeycode(0x5221)).toEqual({
      kind: "layer",
      op: "MO",
      layer: 1,
    });
  });
});
