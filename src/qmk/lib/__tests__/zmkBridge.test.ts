import {
  bindingToKeycode,
  keycodeToBinding,
  QMK_BEHAVIOR,
  qmkBehaviors,
} from "../zmkBridge";
import { parseKeycode } from "../keycodes/qmkKeycode";
import { QMK_KEYCODES } from "../keycodes/qmkKeycodesV6.generated";
import { formatBehaviorBinding } from "../../../lib/behaviorMetadata";

const roundTrip = (text: string) =>
  bindingToKeycode(keycodeToBinding(parseKeycode(text)!));

describe("zmkBridge", () => {
  test.each([
    "KC_A",
    "KC_SPC",
    "KC_TRNS",
    "KC_NO",
    "KC_LCTL",
    "KC_RGUI",
    "LCTL(KC_C)",
    "LCTL(LSFT(KC_A))",
    "RALT(KC_A)",
    "LSG(KC_S)",
    "MT(MOD_LCTL,KC_A)",
    "MT(MOD_LCTL|MOD_LSFT,KC_A)",
    "MT(MOD_RSFT,KC_ENT)",
    "LT(1,KC_SPC)",
    "MO(1)",
    "TO(2)",
    "TG(3)",
    "OSL(1)",
    "TT(2)",
    "DF(4)",
    "OSM(MOD_LSFT)",
    "OSM(MOD_LCTL|MOD_LALT)",
    "TD(3)",
    "QK_MACRO_2",
    "QK_BOOT",
    "QK_RBT",
    "KC_MUTE",
    "KC_VOLU",
    "KC_MPLY",
    "KC_WSCH",
    "MS_BTN1",
    "MS_BTN5",
    "MS_UP",
    "MS_LEFT",
    "MS_WHLD",
    "MS_WHLR",
    "MS_ACL1",
    "KC_LNG1",
    "KC_INT1",
    "LM(1,MOD_LCTL)",
    "EE_CLR",
    "KC_PWR",
  ])("%s survives QMK -> ZMK -> QMK", (text) => {
    expect(roundTrip(text)).toBe(parseKeycode(text));
  });

  test("every named keycode survives the round trip", () => {
    for (const [, code] of QMK_KEYCODES) {
      expect(bindingToKeycode(keycodeToBinding(code))).toBe(code);
    }
  });

  test("plain keys become Key Press with a keyboard-page usage", () => {
    expect(keycodeToBinding(parseKeycode("KC_A")!)).toEqual({
      behaviorId: QMK_BEHAVIOR.keyPress,
      param1: 0x070004,
      param2: 0,
    });
    expect(keycodeToBinding(parseKeycode("LSFT(KC_A)")!).param1).toBe(
      0x02070004,
    );
    expect(keycodeToBinding(parseKeycode("KC_MUTE")!).param1).toBe(0x0c00e2);
  });

  test("refuses a left+right modifier mix instead of guessing", () => {
    expect(() =>
      bindingToKeycode({
        behaviorId: QMK_BEHAVIOR.keyPress,
        param1: 0x11070004,
        param2: 0,
      }),
    ).toThrow(/left and right/);
  });

  test("keycaps read through the shared formatter", () => {
    const behaviors = qmkBehaviors({ tapDanceCount: 4, macroCount: 2 });
    const label = (text: string) => {
      const b = keycodeToBinding(parseKeycode(text)!);
      return formatBehaviorBinding(b, behaviors.get(b.behaviorId)!, {
        shortFormat: true,
      });
    };
    expect(label("KC_A")).toBe("A");
    expect(label("LCTL(KC_C)")).toBe("LC(C)");
    expect(label("MO(1)")).toBe("MO 1");
    expect(label("TT(2)")).toBe("TT 2");
    expect(label("LT(1,KC_SPC)")).toBe("LT 1 Space");
    expect(label("TD(3)")).toMatch(/3/);
    expect(label("KC_TRNS")).toBe("▽");
    expect(label("EE_CLR")).toBe("EE_CLR");
    expect(label("MS_BTN1")).toBe("LCLK");
  });
});
