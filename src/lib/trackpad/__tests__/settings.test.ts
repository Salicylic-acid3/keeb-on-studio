/**
 * Reading the trackpad's runtime settings off the wire.
 *
 * The failure worth guarding against is drawing a switch for a setting the
 * keyboard does not have. A toggle that writes into nothing looks like a
 * feature and behaves like a bug, and every one of the ways this can happen —
 * older firmware, a build without the setting, a value that arrived as the
 * wrong type — has to end in "draw nothing" rather than "assume false".
 */
import {
  ONE_HAND_PINCH_KEY,
  PINCH_INVERT_KEY,
  readTrackpadToggle,
} from "../settings";
import type { Setting } from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

function boolSetting(key: string, value: boolean, source = 0): Setting {
  return {
    customSubsystemIndex: 3,
    key,
    source,
    value: { boolValue: value },
  } as unknown as Setting;
}

describe("reading a trackpad toggle", () => {
  it("finds the setting and its value", () => {
    const rows = [
      boolSetting(ONE_HAND_PINCH_KEY, false),
      boolSetting(PINCH_INVERT_KEY, true),
    ];

    expect(readTrackpadToggle(rows, ONE_HAND_PINCH_KEY)?.enabled).toBe(false);
    expect(readTrackpadToggle(rows, PINCH_INVERT_KEY)?.enabled).toBe(true);
  });

  it("says nothing when the keyboard does not publish it", () => {
    // Firmware older than v0.7.4, or a build without
    // CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS. Not false — absent.
    expect(readTrackpadToggle([], ONE_HAND_PINCH_KEY)).toBeNull();
    expect(
      readTrackpadToggle(
        [boolSetting(PINCH_INVERT_KEY, true)],
        ONE_HAND_PINCH_KEY,
      ),
    ).toBeNull();
  });

  it("says nothing when the value is not a boolean", () => {
    const wrongType = {
      customSubsystemIndex: 3,
      key: ONE_HAND_PINCH_KEY,
      source: 0,
      value: { int32Value: 1 },
    } as unknown as Setting;

    expect(readTrackpadToggle([wrongType], ONE_HAND_PINCH_KEY)).toBeNull();
  });

  it("takes the first copy when both split halves report one", () => {
    // Each half registers its own; they are meant to agree, and the write goes
    // to every side regardless of which copy it was made through.
    const central = boolSetting(ONE_HAND_PINCH_KEY, true, 0);
    const peripheral = boolSetting(ONE_HAND_PINCH_KEY, true, 1);

    expect(
      readTrackpadToggle([central, peripheral], ONE_HAND_PINCH_KEY)?.setting,
    ).toBe(central);
  });
});
