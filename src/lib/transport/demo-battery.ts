/**
 * Battery levels in demo mode.
 *
 * Like tap dance, the firmware module publishes these as custom settings, so
 * the demo only has to produce settings shaped the way that module's would be.
 *
 * The two halves start at deliberately different levels, and the peripheral
 * starts low. That is the state worth being able to look at: a cell with
 * enough left for the key matrix and not enough for a capacitive trackpad is
 * what a failing half actually looks like, and it is the reading that makes
 * the panel worth having. The demo keyboard is ErgoTrack-shaped, whose cells
 * are done at about 2.7 V, so the peripheral sits just above that; the
 * central's voltage is published alongside its percentage the way
 * battery-report 65f3fc7d does (the percentage is the firmware's linear clamp
 * between 2.0 and 3.0 V, so the two agree).
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** Must match the firmware module's ZMK_BATTERY_REPORT_SUBSYSTEM_ID. */
export const BATTERY_IDENTIFIER = "keebon__battery";

const LEVELS: Record<string, number> = {
  central: 95,
  peripheral0: 72,
};
const CENTRAL_MV = 2950;
/** CONFIG_ZMK_NON_LIPO_LOW_MV on ErgoTrack. */
const CUTOFF_MV = 1200;

export function createBatterySettings(customSubsystemIndex: number): Setting[] {
  const levels: Setting[] = Object.entries(LEVELS).map(([key, percent]) => ({
    customSubsystemIndex,
    key,
    source: 0,
    hasUnsavedValue: false,
    meta: {
      confidentiality: 2,
      readPermission: 0,
      writePermission: 1,
      constraints: [
        { range: { min: { int32Value: 0 }, max: { int32Value: 100 } } },
      ],
    },
    value: { int32Value: percent },
  }));
  // The app only ever connects over USB, so the central half is on USB
  // power and its number is the last one measured on battery -- the same
  // thing a real keyboard says (battery-report aecfe5ec).
  levels.push({
    customSubsystemIndex,
    key: "central_on_usb",
    source: 0,
    hasUnsavedValue: false,
    meta: {
      confidentiality: 2,
      readPermission: 0,
      writePermission: 1,
      constraints: [],
    },
    value: { boolValue: true },
  });
  for (const [key, value] of [
    ["central_mv", CENTRAL_MV],
    ["cutoff_mv", CUTOFF_MV],
  ] as const) {
    levels.push({
      customSubsystemIndex,
      key,
      source: 0,
      hasUnsavedValue: false,
      meta: {
        confidentiality: 2,
        readPermission: 0,
        writePermission: 1,
        constraints: [],
      },
      value: { int32Value: value },
    });
  }
  return levels;
}
