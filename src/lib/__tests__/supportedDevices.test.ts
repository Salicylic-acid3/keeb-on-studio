import { SUPPORTED_DEVICE_NAMES, isSupportedDevice } from "../supportedDevices";

describe("isSupportedDevice", () => {
  it("accepts every name in the supported list", () => {
    for (const name of SUPPORTED_DEVICE_NAMES) {
      expect(isSupportedDevice(name)).toBe(true);
    }
  });

  it("accepts the names the firmware actually reports", () => {
    // These are CONFIG_ZMK_KEYBOARD_NAME in the two firmware repositories; if
    // this test fails, the app and the firmware have drifted apart.
    expect(isSupportedDevice("ergotrack")).toBe(true);
    expect(isSupportedDevice("goforty-max")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isSupportedDevice("ErgoTrack")).toBe(true);
    expect(isSupportedDevice("  GOFORTY-MAX  ")).toBe(true);
  });

  it("rejects other ZMK keyboards", () => {
    expect(isSupportedDevice("DYA2")).toBe(false);
    expect(isSupportedDevice("Corne")).toBe(false);
    expect(isSupportedDevice("ZMK Keyboard")).toBe(false);
  });

  it("does not accept a name that merely contains a supported one", () => {
    // Substring matching would let "not-ergotrack" through.
    expect(isSupportedDevice("not-ergotrack")).toBe(false);
    expect(isSupportedDevice("ergotrack-clone")).toBe(false);
  });

  it("rejects a missing name", () => {
    // Callers must wait for the device info to load before asking; an absent
    // name is never treated as supported.
    expect(isSupportedDevice(undefined)).toBe(false);
    expect(isSupportedDevice(null)).toBe(false);
    expect(isSupportedDevice("")).toBe(false);
  });
});
