import { qmkLegend, zmkLegend } from "../firmwareLabels";

describe("legends from a firmware keymap", () => {
  it("names plain QMK keys, with the shifted legend where a cap has one", () => {
    expect(qmkLegend("KC_Q", "us")).toEqual({ main: "Q" });
    expect(qmkLegend("KC_1", "us")).toEqual({ main: "1", sub: "!" });
    expect(qmkLegend("KC_2", "jis")).toEqual({ main: "2", sub: '"' });
    expect(qmkLegend("KC_ENT", "us")).toEqual({ main: "Enter" });
    expect(qmkLegend("KC_RGHT", "us")).toEqual({ main: "→" });
    expect(qmkLegend("KC_INT3", "jis")).toEqual({ main: "¥", sub: "|" });
    expect(qmkLegend("KC_P7", "us")).toEqual({ main: "7" });
    expect(qmkLegend("KC_F12", "us")).toEqual({ main: "F12" });
  });

  it("takes the tap key of a hold-tap and calls a layer key Fn", () => {
    expect(qmkLegend("SFT_T(KC_DOT)", "us")).toEqual({ main: ".", sub: ">" });
    expect(qmkLegend("LT(1, KC_SPC)", "us")).toEqual({ main: "Space" });
    expect(qmkLegend("MO(1)", "us")).toEqual({ main: "Fn" });
  });

  it("leaves keys that send no plain key without a legend", () => {
    expect(qmkLegend("_______", "us")).toEqual({ main: "" });
    expect(qmkLegend("KC_TRNS", "us")).toEqual({ main: "" });
    expect(qmkLegend("QK_BOOT", "us")).toEqual({ main: "" });
    expect(zmkLegend("bt BT_NXT", "us")).toEqual({ main: "" });
    expect(zmkLegend("none", "us")).toEqual({ main: "" });
    expect(zmkLegend("kp LG(LBKT)", "us")).toEqual({ main: "" });
  });

  it("names ZMK keys the same way", () => {
    expect(zmkLegend("kp N1", "us")).toEqual({ main: "1", sub: "!" });
    expect(zmkLegend("kp LSHFT", "us")).toEqual({ main: "Shift" });
    expect(zmkLegend("lt_mid 2 SPACE", "us")).toEqual({ main: "Space" });
    expect(zmkLegend("mt_mid LGUI LANG2", "us")).toEqual({ main: "英数" });
    expect(zmkLegend("kp FSLH", "us")).toEqual({ main: "/", sub: "?" });
  });
});
