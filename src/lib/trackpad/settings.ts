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
