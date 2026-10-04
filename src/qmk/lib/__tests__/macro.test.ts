import {
  decodeMacro,
  encodeMacro,
  packMacroBuffer,
  splitMacroBuffer,
  type MacroStep,
} from "../macro";
import { parseKeycode } from "../keycodes/qmkKeycode";

describe("Vial macro bytes", () => {
  const steps: MacroStep[] = [
    { action: "string", text: "Hello, world!" },
    { action: "tap", keycode: parseKeycode("KC_ENT")! },
    { action: "delay", ms: 300 },
    { action: "down", keycode: parseKeycode("KC_LCTL")! },
    { action: "tap", keycode: parseKeycode("KC_C")! },
    { action: "up", keycode: parseKeycode("KC_LCTL")! },
    { action: "tap", keycode: parseKeycode("LCTL(KC_V)")! },
    { action: "tap", keycode: parseKeycode("MO(1)")! },
    { action: "tap", keycode: parseKeycode("QK_BOOT")! }, // 0x7C00: low byte 0
  ];

  test("encodes like the firmware reads, and back", () => {
    const bytes = encodeMacro(steps);
    expect(bytes).not.toContain(0);
    expect(bytes.slice(0, 13)).toEqual([...Buffer.from("Hello, world!")]);
    expect(bytes.slice(13, 16)).toEqual([1, 1, 0x28]);
    // 300 ms = (46 - 1) + (2 - 1) * 255
    expect(bytes.slice(16, 20)).toEqual([1, 4, 46, 2]);
    expect(decodeMacro(Uint8Array.from(bytes))).toEqual(steps);
  });

  test("the whole buffer: macros back to back, each 0-ended", () => {
    const buf = packMacroBuffer(
      [steps, [], [{ action: "string", text: "x" }]],
      200,
    );
    const parts = splitMacroBuffer(buf, 4);
    expect(parts).toHaveLength(4);
    expect(decodeMacro(parts[0])).toEqual(steps);
    expect(parts[1]).toHaveLength(0);
    expect(decodeMacro(parts[2])).toEqual([{ action: "string", text: "x" }]);
    expect(buf[199]).toBe(0);
    expect(() => packMacroBuffer([steps], 10)).toThrow();
    expect(() => encodeMacro([{ action: "string", text: "日本語" }])).toThrow();
  });
});
