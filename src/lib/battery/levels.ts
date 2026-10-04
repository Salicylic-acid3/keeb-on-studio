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
const CENTRAL_MV_KEY = "central_mv";
const CENTRAL_ON_USB_KEY = "central_on_usb";
const CUTOFF_MV_KEY = "cutoff_mv";
const PERIPHERAL_PATTERN = /^peripheral(\d+)$/;

export interface BatteryLevel {
  /** `central`, or `peripheral0`, `peripheral1`, … */
  key: string;
  /** 0–100, the firmware's linear clamp between its configured voltages. */
  percent: number;
  /**
   * The same sample in millivolts (battery-report 65f3fc7d and later; only
   * the central half has it), or null. This is what the card shows when it
   * can: a cell dies at a voltage, and its owner learns which one, while a
   * percentage between two configured voltages says less the lower it gets.
   */
  millivolts: number | null;
  /**
   * Which half this is, in words the owner of *this* keyboard would use, or
   * null when the keyboard is not one we know the halves of.
   */
  label: string | null;
}

/**
 * What a voltage means on a given keyboard: the cells it takes, and where
 * "full" and "empty" are for them. The firmware's percentage is a clamp
 * between two configured voltages that were set before anyone had watched a
 * cell run down; these come from watching.
 */
export interface BatteryGuide {
  /** Reads as full at and above this. */
  fullMv: number;
  /** Reads as empty at and below this; the bar hits zero here. */
  emptyMv: number;
  /** Below this the keyboard has actually stopped working. */
  deadMv: number;
  /**
   * The two voltages the firmware's own percentage is a linear clamp between
   * (CONFIG_ZMK_NON_LIPO_MIN_MV / MAX_MV). A half that only reports the
   * percentage — a split peripheral, whose voltage never crosses the link —
   * can be read back to a voltage through these, to within the firmware's
   * rounding.
   */
  percentMinMv: number;
  percentMaxMv: number;
  /** The one-line explanation shown under the readings. */
  note: string;
}

/**
 * Keyed by `CONFIG_ZMK_KEYBOARD_NAME`, like the half labels.
 *
 * ErgoTrack: two CR2032 in parallel per half, 3.0 to 3.3 V new, and the
 * keyboard has stopped working below about 2.7 V (observed by its owner;
 * the keys outlive the pointer). GoFortyMax: two AAA cells in series,
 * 3.0 to 3.2 V new for alkaline and used up around 2.0 V; NiMH cells sit at
 * 2.4 to 2.6 V almost the whole way, which is not a fault.
 */
const BATTERY_GUIDES: Record<string, BatteryGuide> = {
  ergotrack: {
    fullMv: 3200,
    emptyMv: 2700,
    deadMv: 2700,
    percentMinMv: 2000,
    percentMaxMv: 3000,
    note: "Two CR2032 cells in parallel in each half: new cells read 3.0 to 3.3 V. Below about 2.7 V this keyboard has stopped working — the trackpad goes before the keys do — so treat that as empty.",
  },
  "goforty-max": {
    fullMv: 3200,
    emptyMv: 2000,
    deadMv: 2000,
    percentMinMv: 2000,
    percentMaxMv: 3000,
    note: "Two AAA cells in series: new alkaline cells read 3.0 to 3.2 V and are used up at about 2.0 V. NiMH cells sit at 2.4 to 2.6 V almost until the end; that is normal, not a fault.",
  },
};
BATTERY_GUIDES["keeb-on! demo keyboard"] = BATTERY_GUIDES.ergotrack;

export function batteryGuideFor(
  deviceName?: string | null,
): BatteryGuide | null {
  return BATTERY_GUIDES[(deviceName ?? "").trim().toLowerCase()] ?? null;
}

/**
 * The voltage a firmware percentage stands for, undoing the firmware's linear
 * clamp. Exact to the firmware's rounding below the top; at 100% the cell is
 * at or above `percentMaxMv` and the answer is a floor, which the caller
 * shows as such.
 */
export function millivoltsFromPercent(
  percent: number,
  guide: BatteryGuide,
): { millivolts: number; atLeast: boolean } {
  const clamped = Math.max(0, Math.min(100, percent));
  const span = guide.percentMaxMv - guide.percentMinMv;
  return {
    millivolts: Math.round(guide.percentMinMv + (span * clamped) / 100),
    atLeast: clamped >= 100,
  };
}

/** Where a voltage sits between a guide's empty and full, 0–100. */
export function voltagePercent(
  millivolts: number,
  guide: BatteryGuide,
): number {
  const span = guide.fullMv - guide.emptyMv;
  if (span <= 0) return 0;
  const ratio = (millivolts - guide.emptyMv) / span;
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
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
  // One piece: the firmware's "central" is the whole keyboard, and showing
  // the word "central" for it would send someone looking for another half.
  "goforty-max": {
    central: "Keyboard",
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
  // 0 is "no voltage channel", not a reading.
  const centralMv =
    settings.find((setting) => setting.key === CENTRAL_MV_KEY)?.value
      ?.int32Value || null;

  for (const setting of settings) {
    const key = setting.key ?? "";
    const percent = setting.value?.int32Value;
    if (percent === undefined) continue;

    if (key === CENTRAL_KEY) {
      central.push({
        key,
        percent,
        millivolts: centralMv,
        label: labels[key] ?? null,
      });
      continue;
    }

    const match = PERIPHERAL_PATTERN.exec(key);
    if (!match) continue;
    peripherals.push({
      index: Number(match[1]),
      level: { key, percent, millivolts: null, label: labels[key] ?? null },
    });
  }

  peripherals.sort((a, b) => a.index - b.index);
  return [...central, ...peripherals.map((p) => p.level)];
}

/**
 * The voltage below which the firmware switches the keyboard off to protect
 * its cells, in millivolts, or null when the firmware does not say (older
 * battery-report, or a build without the non-LiPo module).
 */
export function firmwareCutoffMv(settings: readonly Setting[]): number | null {
  return (
    settings.find((setting) => setting.key === CUTOFF_MV_KEY)?.value
      ?.int32Value || null
  );
}

/**
 * True when the central half is powered over USB (battery-report aecfe5ec
 * and later). Its sensor then reads the USB rail, so the firmware keeps the
 * last level it measured on battery and this says that is what is shown.
 * Older firmware has no such key, and the answer is false.
 */
export function centralIsOnUsb(settings: readonly Setting[]): boolean {
  return settings.some(
    (setting) =>
      setting.key === CENTRAL_ON_USB_KEY && setting.value?.boolValue === true,
  );
}
