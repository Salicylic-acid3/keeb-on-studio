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
 * the panel worth having.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** Must match the firmware module's ZMK_BATTERY_REPORT_SUBSYSTEM_ID. */
export const BATTERY_IDENTIFIER = "keebon__battery";

const LEVELS: Record<string, number> = {
  central: 74,
  peripheral0: 12,
};

export function createBatterySettings(customSubsystemIndex: number): Setting[] {
  return Object.entries(LEVELS).map(([key, percent]) => ({
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
}
