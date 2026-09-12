/**
 * The trackpad decisions the firmware lets the owner change.
 *
 * These used to be build switches — a rebuild, a flash and a keymap reset to
 * answer a question you can answer by trying it for ten seconds. They are now
 * custom settings, with the old Kconfig values as their defaults.
 *
 * Two things about them are worth knowing before reading a value.
 *
 * Each half registers its own copy, because a gesture is classified on the half
 * that owns the sensor, so a setting arrives once per split side. The two are
 * meant to agree: one pad pinching and the other not is a keyboard behaving
 * inconsistently. So reads take the first copy and writes go to every side
 * (see `allSources` on writeSettingToMemory).
 *
 * And a keyboard may simply not have them. Older firmware, or a build without
 * CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS, lists nothing here — which is why
 * every reader returns null rather than a default, so the UI can leave the row
 * out instead of showing a switch that does nothing.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** Must match IQS9151_SETTINGS_SUBSYSTEM_ID in the driver. */
export const TRACKPAD_SUBSYSTEM_ID = "keebon__trackpad";

/** Two fingers on one pad pinch to zoom. */
export const ONE_HAND_PINCH_KEY = "one_hand_pinch";

/** That pinch turns the wheel the other way. */
export const PINCH_INVERT_KEY = "pinch_invert";

/**
 * Counts the sensor spreads across each axis of the pad.
 *
 * The pair only makes sense as a ratio, and the ratio has to match the ratio of
 * the pad's two sides. Mismatched, it does not present as "the resolution is
 * wrong" — it presents as the pointer being reluctant in one direction, and as
 * scrolls, swipes and pinches all leaning the other way, because every axis
 * decision in the firmware compares counts rather than millimetres.
 */
export const RESOLUTION_X_KEY = "resolution_x";
export const RESOLUTION_Y_KEY = "resolution_y";

export interface TrackpadNumber {
  setting: Setting;
  value: number;
  min: number | null;
  max: number | null;
}

/** The named integer setting with its range, or null if this keyboard has none. */
export function readTrackpadNumber(
  settings: readonly Setting[],
  key: string,
): TrackpadNumber | null {
  const setting = settings.find((candidate) => candidate.key === key);
  if (!setting) return null;

  const scalar = setting.value?.arrayValue?.value ?? setting.value;
  const value = scalar?.int32Value;
  if (typeof value !== "number") return null;

  // The firmware publishes the legal span as a constraint; honouring it here
  // keeps the input from offering values the keyboard will refuse.
  const range = setting.meta?.constraints?.find(
    (c) => c.range !== undefined,
  )?.range;
  return {
    setting,
    value,
    min: range?.min?.int32Value ?? null,
    max: range?.max?.int32Value ?? null,
  };
}

export interface TrackpadToggle {
  /** The copy to write through. Writes go to every side regardless. */
  setting: Setting;
  enabled: boolean;
}

/**
 * The named boolean setting, or null when this keyboard does not have it.
 *
 * Null covers three cases that the caller treats the same way: the firmware
 * predates the setting, the key is absent, or it arrived as something other
 * than a boolean. In all three there is nothing useful to show.
 */
export function readTrackpadToggle(
  settings: readonly Setting[],
  key: string,
): TrackpadToggle | null {
  const setting = settings.find((candidate) => candidate.key === key);
  if (!setting) return null;

  // Same unwrapping the generic settings pane does: an array element carries
  // its scalar one level down, a plain setting is the scalar.
  const scalar = setting.value?.arrayValue?.value ?? setting.value;
  const enabled = scalar?.boolValue;
  if (typeof enabled !== "boolean") return null;

  return { setting, enabled };
}
