/**
 * The one thing here that can hurt someone is the half naming.
 *
 * "Central" and "peripheral0" are firmware roles; which physical half each
 * one is depends on how the keyboard was built. Getting it backwards sends
 * the owner to change the battery in the half that was fine, and the symptom
 * they are chasing does not move.
 */
import { readBatteryLevels, BATTERY_SUBSYSTEM_ID } from "../levels";
import type { Setting } from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

function level(key: string, percent: number) {
  return {
    customSubsystemIndex: 17,
    key,
    source: 0,
    value: { int32Value: percent },
  } as Setting;
}

describe("reading battery levels", () => {
  it("matches the firmware module's subsystem id", () => {
    // Both sides hard-code this string; if they disagree the panel silently
    // shows nothing at all, which looks exactly like a keyboard that does not
    // report its battery.
    expect(BATTERY_SUBSYSTEM_ID).toBe("keebon__battery");
  });

  it("names ErgoTrack's halves the way its owner would", () => {
    // The right half is the central on this keyboard: its .conf carries the
    // Studio config and the split central role.
    const levels = readBatteryLevels(
      [level("central", 80), level("peripheral0", 12)],
      "ergotrack",
    );
    expect(levels.map((l) => [l.label, l.percent])).toEqual([
      ["Right half", 80],
      ["Left half", 12],
    ]);
  });

  it("says nothing about halves it cannot name", () => {
    // A keyboard we do not know might be built either way round. Showing the
    // raw key is honest; guessing is not.
    const levels = readBatteryLevels([level("central", 50)], "someone-elses");
    expect(levels[0].label).toBeNull();
    expect(levels[0].key).toBe("central");
  });

  it("puts the central first and the peripherals in order", () => {
    const levels = readBatteryLevels([
      level("peripheral1", 30),
      level("peripheral0", 20),
      level("central", 90),
    ]);
    expect(levels.map((l) => l.key)).toEqual([
      "central",
      "peripheral0",
      "peripheral1",
    ]);
  });

  it("sorts peripherals numerically, not as text", () => {
    const levels = readBatteryLevels([
      level("peripheral10", 10),
      level("peripheral2", 20),
    ]);
    expect(levels.map((l) => l.key)).toEqual(["peripheral2", "peripheral10"]);
  });

  it("ignores settings that are not battery levels", () => {
    // The listing is one subsystem's, but being strict about the rest would
    // only break the panel the day the firmware grows a key.
    expect(readBatteryLevels([level("something_else", 1)])).toEqual([]);
  });

  it("skips a level with no value rather than reporting zero", () => {
    // A secure setting arrives without its value while locked. Rendering that
    // as 0% would be a flat battery that is not flat.
    const missing = {
      customSubsystemIndex: 17,
      key: "central",
      source: 0,
    } as Setting;
    expect(readBatteryLevels([missing])).toEqual([]);
  });
});
