import { exportVil, importVil } from "../vil";
import { parseKeycode } from "../keycodes/qmkKeycode";

const kc = (s: string) => parseKeycode(s)!;
const target = {
  uid: "0102030405060708",
  layerCount: 2,
  rows: 1,
  cols: 3,
  tapDanceCount: 2,
  comboCount: 1,
  keyOverrideCount: 1,
  macroCount: 2,
  settingIds: new Set([2, 7]),
};

describe(".vil files", () => {
  test("what Vial writes reads back in, and what we write Vial can read", () => {
    // Shaped like vial-gui's save_layout output.
    const vial = `{"version": 1, "uid": 578437695752307201, "layout": [[["KC_ESCAPE", "LT(1,KC_SPACE)", -1]], [["KC_TRNS", "LCTL(KC_C)", "KC_NO"]], [["KC_A", "KC_B", "KC_C"]]],
      "encoder_layout": [], "layout_options": 0,
      "macro": [[["text", "hi"], ["tap", "KC_ENTER", "KC_A"], ["delay", 120]], [], []],
      "vial_protocol": 6, "via_protocol": 9,
      "tap_dance": [["KC_ESCAPE", "MO(1)", "KC_CAPSLOCK", "KC_NO", 250], ["KC_NO", "KC_NO", "KC_NO", "KC_NO", 200], ["KC_NO", "KC_NO", "KC_NO", "KC_NO", 200]],
      "combo": [["KC_J", "KC_K", "KC_NO", "KC_NO", "KC_ESCAPE"]],
      "key_override": [{"trigger": "KC_BSPACE", "replacement": "KC_DELETE", "layers": 65535, "trigger_mods": 2, "negative_mod_mask": 0, "suppressed_mods": 2, "options": 135}],
      "settings": {"7": 230, "99": 1}}`;
    const imp = importVil(vial, target);
    expect(imp.otherKeyboard).toBe(false); // 578437695752307201 = bytes 01..08 little-endian
    expect(imp.keymap).toContainEqual({
      layer: 0,
      row: 0,
      col: 1,
      code: kc("LT(1,KC_SPC)"),
    });
    expect(
      imp.keymap.find((k) => k.layer === 0 && k.col === 2),
    ).toBeUndefined(); // -1: no key
    expect(imp.macros?.[0]).toEqual([
      { action: "string", text: "hi" },
      { action: "tap", keycode: kc("KC_ENT") },
      { action: "tap", keycode: kc("KC_A") },
      { action: "delay", ms: 120 },
    ]);
    expect(imp.tapDances?.[0]).toEqual({
      onTap: kc("KC_ESC"),
      onHold: kc("MO(1)"),
      onDoubleTap: kc("KC_CAPS"),
      onTapHold: 0,
      tappingTerm: 250,
    });
    expect(imp.keyOverrides?.[0].trigger).toBe(kc("KC_BSPC"));
    expect(imp.settings).toEqual({ 7: 230 });
    expect(imp.skipped.join(" ")).toMatch(/Layers 2 and up/);
    expect(imp.skipped.join(" ")).toMatch(/Tap dances 2 and up/);
    expect(imp.skipped.join(" ")).toMatch(/99/);

    const out = exportVil({
      uid: target.uid,
      vialProtocol: 6,
      keymap: [
        [[kc("KC_ESC"), kc("LT(1,KC_SPC)"), 0]],
        [[1, kc("LCTL(KC_C)"), 0]],
      ],
      layoutOptions: 0,
      macros: imp.macros!,
      tapDances: imp.tapDances!,
      combos: imp.combos!,
      keyOverrides: imp.keyOverrides!,
      settings: { 7: 230 },
    });
    expect(out).toContain('"uid":578437695752307201');
    const doc = JSON.parse(out.replace(/"uid":\d+/, '"uid":0'));
    // Vial's own spellings, as its save_layout writes them.
    expect(doc.layout[0][0]).toEqual(["KC_ESCAPE", "LT1(KC_SPACE)", "KC_NO"]);
    expect(doc.layout[1][0][1]).toBe("LCTL(KC_C)");
    expect(doc.tap_dance[0]).toEqual([
      "KC_ESCAPE",
      "MO(1)",
      "KC_CAPSLOCK",
      "KC_NO",
      250,
    ]);
    expect(doc.key_override[0].trigger).toBe("KC_BSPACE");
    expect(doc.macro[0]).toEqual([
      ["text", "hi"],
      ["tap", "KC_ENTER", "KC_A"],
      ["delay", 120],
    ]);
    // And back again unchanged.
    const again = importVil(out, target);
    expect(again.macros).toEqual(imp.macros);
    expect(again.tapDances).toEqual(imp.tapDances);
    expect(again.keyOverrides).toEqual(imp.keyOverrides);
  });

  test("a file from another keyboard is flagged; junk is refused", () => {
    expect(importVil('{"uid": 1, "layout": []}', target).otherKeyboard).toBe(
      true,
    );
    expect(() => importVil("hello", target)).toThrow();
    expect(() => importVil('{"a": 1}', target)).toThrow();
  });
});
