/**
 * Reading the battery levels the firmware publishes.
 *
 * `zmk-feature-battery-report` puts each half's percentage into a custom
 * setting, because ZMK's own reporting goes out over the BLE Battery Service
 * and is therefore invisible over USB — which is where someone sits when a
 * keyboard is misbehaving badly enough to make them ask about batteries.
 *
 * Keys are `central` and `peripheral0`, `peripheral1`, … The naming is the
 * firmware's, not the keyboard's: a split's "central" is one physical half
 * and its "peripheral0" the other, and which is which is a property of the
 * build. Turning that into "right" and "left" is the app's job and is done
 * per keyboard, because getting it backwards would send someone to change the
 * wrong battery.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** The firmware module's subsystem id. Must match its header. */
export const BATTERY_SUBSYSTEM_ID = "keebon__battery";

const CENTRAL_KEY = "central";
const PERIPHERAL_PATTERN = /^peripheral(\d+)$/;

export interface BatteryLevel {
  /** `central`, or `peripheral0`, `peripheral1`, … */
  key: string;
  /** 0–100. */
  percent: number;
  /**
   * Which half this is, in words the owner of *this* keyboard would use, or
   * null when the keyboard is not one we know the halves of.
   */
  label: string | null;
}

/**
 * Which physical half each firmware role is, per keyboard.
 *
 * Keyed by `CONFIG_ZMK_KEYBOARD_NAME`. ClickBoard ErgoTrack builds the right
 * half as the central (`clickboard_ergotrack_right.conf` carries
 * ZMK_STUDIO and the split central role), so its peripheral0 is the left.
 * A one-piece keyboard has only a central and needs no naming at all.
 */
const HALF_LABELS: Record<string, Record<string, string>> = {
  ergotrack: {
    central: "Right half",
    peripheral0: "Left half",
  },
  // The demo keyboard is ErgoTrack-shaped and reports a friendly name rather
  // than a keyboard name. Naming its halves here keeps demo mode honest about
  // the one thing this panel is for: someone trying the app before they own a
  // keyboard should see what they would see with one.
  "keeb-on! demo keyboard": {
    central: "Right half",
    peripheral0: "Left half",
  },
};

/**
 * Turn the listed settings into levels, central first then peripherals in
 * order.
 *
 * Settings that are not battery levels are ignored rather than rejected: this
 * reads one subsystem's listing, and being strict about the rest would only
 * make it break when the firmware grows a key.
 */
export function readBatteryLevels(
  settings: readonly Setting[],
  deviceName?: string | null,
): BatteryLevel[] {
  const labels = HALF_LABELS[(deviceName ?? "").trim().toLowerCase()] ?? {};
  const central: BatteryLevel[] = [];
  const peripherals: { index: number; level: BatteryLevel }[] = [];

  for (const setting of settings) {
    const key = setting.key ?? "";
    const percent = setting.value?.int32Value;
    if (percent === undefined) continue;

    if (key === CENTRAL_KEY) {
      central.push({ key, percent, label: labels[key] ?? null });
      continue;
    }

    const match = PERIPHERAL_PATTERN.exec(key);
    if (!match) continue;
    peripherals.push({
      index: Number(match[1]),
      level: { key, percent, label: labels[key] ?? null },
    });
  }

  peripherals.sort((a, b) => a.index - b.index);
  return [...central, ...peripherals.map((p) => p.level)];
}
