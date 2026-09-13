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
  CURSOR_REPORT_INTERVAL_KEY,
  ONE_HAND_PINCH_KEY,
  PINCH_INVERT_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  readTrackpadNumberPerSide,
  readTrackpadToggle,
  sidesDisagree,
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

function intSetting(key: string, value: number, source = 0): Setting {
  return {
    customSubsystemIndex: 3,
    key,
    source,
    value: { int32Value: value },
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

describe("the two halves' copies", () => {
  it("are read central first, whatever order they arrived in", () => {
    const rows = [
      intSetting(CURSOR_REPORT_INTERVAL_KEY, 8, 1),
      intSetting(CURSOR_REPORT_INTERVAL_KEY, 0, 0),
    ];

    const sides = readTrackpadNumberPerSide(rows, CURSOR_REPORT_INTERVAL_KEY);
    expect(sides.map((side) => side.setting.source)).toEqual([0, 1]);
    expect(sides.map((side) => side.value)).toEqual([0, 8]);
  });

  it("are noticed when they differ, and not when they agree", () => {
    // A write that reached one half and not the other is invisible in a box
    // that shows one copy; this is what makes it visible.
    const apart = readTrackpadNumber(
      [
        intSetting(ONE_HAND_PINCH_KEY, 24, 0),
        intSetting(ONE_HAND_PINCH_KEY, 10, 1),
      ],
      ONE_HAND_PINCH_KEY,
    );
    expect(apart?.value).toBe(24);
    expect(apart?.copies).toEqual([24, 10]);
    expect(sidesDisagree(apart!)).toBe(true);

    const together = readTrackpadToggle(
      [
        boolSetting(PINCH_INVERT_KEY, true, 0),
        boolSetting(PINCH_INVERT_KEY, true, 1),
      ],
      PINCH_INVERT_KEY,
    );
    expect(sidesDisagree(together!)).toBe(false);
    expect(
      sidesDisagree(
        readTrackpadToggle(
          [
            boolSetting(PINCH_INVERT_KEY, true, 0),
            boolSetting(PINCH_INVERT_KEY, false, 1),
          ],
          PINCH_INVERT_KEY,
        )!,
      ),
    ).toBe(true);
  });

  it("are written back together by committing the shown value", async () => {
    // Normally an unchanged box writes nothing. When the halves differ, the
    // unchanged value is exactly what needs writing — to the other half.
    const writes: unknown[] = [];
    const access = {
      isLoading: false,
      writeSettingToMemory: async (...args: unknown[]) => {
        writes.push(args);
      },
      saveSection: async () => {},
    };
    const apart = readTrackpadNumber(
      [
        intSetting(ONE_HAND_PINCH_KEY, 24, 0),
        intSetting(ONE_HAND_PINCH_KEY, 10, 1),
      ],
      ONE_HAND_PINCH_KEY,
    )!;

    await commitTrackpadNumber(access, apart, "24", { min: 1, max: 100 });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual([
      apart.setting,
      { int32Value: 24 },
      { allSources: true },
    ]);

    // Whereas a per-side field with an unchanged value still writes nothing.
    const side = readTrackpadNumberPerSide(
      [
        intSetting(CURSOR_REPORT_INTERVAL_KEY, 0, 0),
        intSetting(CURSOR_REPORT_INTERVAL_KEY, 8, 1),
      ],
      CURSOR_REPORT_INTERVAL_KEY,
    )[1];
    await commitTrackpadNumber(
      access,
      side,
      "8",
      { min: 0, max: 100 },
      1,
      false,
    );
    expect(writes).toHaveLength(1);

    await commitTrackpadNumber(
      access,
      side,
      "6",
      { min: 0, max: 100 },
      1,
      false,
    );
    expect(writes[1]).toEqual([
      side.setting,
      { int32Value: 6 },
      { allSources: false },
    ]);
  });
});
