/**
 * The one thing here that can hurt someone is the half naming.
 *
 * "Central" and "peripheral0" are firmware roles; which physical half each
 * one is depends on how the keyboard was built. Getting it backwards sends
 * the owner to change the battery in the half that was fine, and the symptom
 * they are chasing does not move.
 */
import {
  BATTERY_SUBSYSTEM_ID,
  batteryGuideFor,
  firmwareCutoffMv,
  millivoltsFromPercent,
  readBatteryLevels,
  voltagePercent,
} from "../levels";
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

  it("carries the central's voltage and leaves the peripheral's null", () => {
    // battery-report 65f3fc7d publishes `central_mv` beside the percentage.
    // The peripheral's voltage never crosses the split link, so it has none.
    const levels = readBatteryLevels(
      [
        level("central", 95),
        level("central_mv", 2950),
        level("peripheral0", 72),
      ],
      "ergotrack",
    );
    expect(levels.map((l) => [l.key, l.millivolts])).toEqual([
      ["central", 2950],
      ["peripheral0", null],
    ]);
  });

  it("treats a zero voltage as no voltage", () => {
    // 0 is what the firmware publishes when it has no voltage channel.
    const levels = readBatteryLevels([
      level("central", 40),
      level("central_mv", 0),
    ]);
    expect(levels[0].millivolts).toBeNull();
    expect(firmwareCutoffMv([level("cutoff_mv", 0)])).toBeNull();
    expect(firmwareCutoffMv([level("cutoff_mv", 1200)])).toBe(1200);
  });
});

describe("reading a voltage against the keyboard's guide", () => {
  it("knows ErgoTrack dies at 2.7 V", () => {
    // Observed: the keyboard stopped working at 2.7 V. The bar must read
    // empty there, whatever the firmware's percentage says.
    const guide = batteryGuideFor("ergotrack")!;
    expect(guide.deadMv).toBe(2700);
    expect(voltagePercent(2700, guide)).toBe(0);
    expect(voltagePercent(3200, guide)).toBe(100);
    expect(voltagePercent(2950, guide)).toBe(50);
  });

  it("reads the demo keyboard like ErgoTrack and knows nothing of others", () => {
    expect(batteryGuideFor("Keeb-On! Demo Keyboard")).toBe(
      batteryGuideFor("ergotrack"),
    );
    expect(batteryGuideFor("goforty-max")?.deadMv).toBe(2000);
    expect(batteryGuideFor("someone-elses")).toBeNull();
  });

  it("reads a percentage-only half back to the firmware's voltage", () => {
    // The firmware's percentage is a linear clamp between 2.0 and 3.0 V, so
    // 72% is 2.72 V exactly; 100% only says the cell is at or above 3.0 V.
    const guide = batteryGuideFor("ergotrack")!;
    expect(millivoltsFromPercent(72, guide)).toEqual({
      millivolts: 2720,
      atLeast: false,
    });
    expect(millivoltsFromPercent(100, guide)).toEqual({
      millivolts: 3000,
      atLeast: true,
    });
    expect(millivoltsFromPercent(0, guide).millivolts).toBe(2000);
  });
});
