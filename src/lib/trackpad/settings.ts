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
import type { TrackpadSettingsAccess } from "../../components/trackpad/TrackpadSettings";

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

/**
 * How far the pointer travels per count the pad reports, per axis, in tenths.
 *
 * Not the same thing as the resolutions above, and on this sensor not even
 * related: the resolutions set the range of the absolute finger coordinates the
 * firmware compares when deciding which axis a gesture is on, and have no
 * effect at all on the relative movement the cursor is built from. Pointer
 * speed is this pair.
 */
export const CURSOR_GAIN_X_KEY = "cursor_gain_x";
export const CURSOR_GAIN_Y_KEY = "cursor_gain_y";

/**
 * Reports to spread each movement across; 1 emits it immediately.
 *
 * The companion to the gains rather than a separate idea: the pad reports whole
 * counts, so slowly it reports 1, 0, 1, 0, and a gain much above 1 turns that
 * into visible steps with the gaps still in them. Draining a fraction per
 * report fills the gaps from what the report before did not spend.
 */
export const CURSOR_SMOOTHING_KEY = "cursor_smoothing";
/** Pointer movement withheld after a finger lands, in counts; 0 is off. */
export const TAP_DEAD_ZONE_KEY = "tap_dead_zone";

/**
 * Counts of finger travel to average the pointer over; 0 is off.
 *
 * A window measured in distance rather than reports, and for a different fault
 * than the smoothing above. The sensor's reported position, plotted against
 * where the finger truly is, is a gentle wave, and on the coarse long axis it
 * repeats every couple of millimetres and swings the reported speed better than
 * two to one. Because the wave is fixed in distance, a smoother counted in
 * reports slides off it — its right length changes with speed — while one
 * counted in distance sits on it at every speed. Set it near one ripple period
 * in the sensor's own counts (about 23 to the millimetre here).
 */
export const CURSOR_DISTANCE_SMOOTHING_KEY = "cursor_distance_smoothing";

/**
 * Period of the sensor's positional ripple per axis, in tenths of a count; 0
 * is off.
 *
 * The lag-free alternative to the distance window above. The reported position
 * carries a wave fixed to where the finger is over the electrodes, half an
 * electrode pitch long; given its period the firmware learns the wave's shape
 * from the first stroke and divides it out of every report. Geometry puts the
 * period at resolution / (2 × electrodes) — 76.0 on the ErgoTrack's long axis —
 * but the equaliser needs it to within a percent: a few percent off halves the
 * effect, which is why the unit is tenths (770 is 77.0) and why it is a knob to
 * scan rather than a constant. The earlier whole-count keys were retired rather
 * than reinterpreted, so a stored 76 could not silently become 7.6.
 */
export const RIPPLE_PERIOD_X_KEY = "ripple_period_x_x10";
export const RIPPLE_PERIOD_Y_KEY = "ripple_period_y_x10";

/** Tenths on the wire, whole counts with one decimal in the box. */
export const RIPPLE_PERIOD_SCALE = 10;

/**
 * Let the keyboard find the periods itself.
 *
 * The first two pads measured wanted different values, and the search — a
 * bank of candidate periods learning alongside the equaliser, the one whose
 * wave grows largest winning — takes ten or twenty seconds of ordinary use
 * and is remembered across power cycles. With this on, the periods above are
 * only where it starts; an axis with no wave never locks and keeps its value.
 */
export const RIPPLE_AUTO_KEY = "ripple_auto";

/**
 * Correct the ripple with a map learned over the pad's positions instead.
 *
 * No period and no search: 256 bins across each axis, each learning how the
 * movement reported there compares with the local average, whatever shape
 * the nonlinearity has. A few full-length strokes teach it; kept across
 * power cycles, forgotten when the pad scale changes. While this is on the
 * period rows and the search are idle, so the app hides them.
 */
export const RIPPLE_MAP_KEY = "ripple_map";

/** How many of the map's 256 bins per axis can correct, per half. Read-only. */
export const RIPPLE_MAP_LEARNED_X_KEY = "ripple_map_learned_x";
export const RIPPLE_MAP_LEARNED_Y_KEY = "ripple_map_learned_y";

/**
 * What the search found per axis, in tenths of a count; 0 is nothing yet.
 *
 * Written by the keyboard, for reading: without a debug build this is the one
 * way to tell whether a pad has locked on to its wave or is still looking,
 * and each half answers for its own pad. Shown as text, never as a box.
 */
export const RIPPLE_FOUND_X_KEY = "ripple_found_x_x10";
export const RIPPLE_FOUND_Y_KEY = "ripple_found_y_x10";

/**
 * Report pointer movement at most this often, in ms; 0 is every frame.
 *
 * For a split half whose pointer crosses a BLE link: the sensor's 200 frames
 * a second are twice that in notifications, which the link cannot carry, and
 * what it cannot carry it queues — lag on the pointer and, since key presses
 * wait in the same queue, late keystrokes. Movement is added up between
 * reports, so nothing is lost; 8 matches the link's 7.5 ms connection
 * interval. The half plugged into the computer has no such link and wants 0:
 * the one trackpad setting the two sides should NOT share, so it is read and
 * written per side.
 */
export const CURSOR_REPORT_INTERVAL_KEY = "cursor_report_interval_ms";
/**
 * Touch set / clear threshold multipliers, 1..255. The pad's sensitivity, and
 * with it how many electrodes the reported position is the centroid of. The
 * app shows one box and keeps the clear threshold a fixed step below the set
 * one, which is the hysteresis that stops a channel flickering at the edge of
 * the finger.
 */
export const TOUCH_SET_THRESHOLD_KEY = "touch_set_threshold";
export const TOUCH_CLEAR_THRESHOLD_KEY = "touch_clear_threshold";
export const TOUCH_THRESHOLD_HYSTERESIS = 6;

/** Three-finger swipe thresholds per sensor axis, in counts. */
export const SWIPE3_THRESHOLD_X_KEY = "swipe3_threshold_x";
export const SWIPE3_THRESHOLD_Y_KEY = "swipe3_threshold_y";

/**
 * The sensor's own low-speed filter, one key per register.
 *
 * Everything above happens after the sensor has reported; this is what it does
 * before. Below `bottom_speed` counts per report a position filter with weight
 * `bottom_beta` holds the finger where it was, and below `stationary_threshold`
 * the report is suppressed altogether — which is where "stops on each
 * electrode, then jumps" on a coarse axis comes from. Exposed so that can be
 * tuned without another flash.
 */
export const FILTER_BOTTOM_SPEED_KEY = "filter_bottom_speed";
export const FILTER_TOP_SPEED_KEY = "filter_top_speed";
export const FILTER_BOTTOM_BETA_KEY = "filter_bottom_beta";
export const FILTER_STATIC_BETA_KEY = "filter_static_beta";
export const STATIONARY_THRESHOLD_KEY = "stationary_threshold";
export const JITTER_DELTA_KEY = "jitter_delta";

export interface TrackpadNumber {
  setting: Setting;
  value: number;
  min: number | null;
  max: number | null;
  /**
   * What every split side holds for this key, in source order — the central
   * first. The sides are meant to agree, and usually do, but a write that
   * reached one half and not the other leaves them apart with nothing on
   * screen to say so: the row shows the first copy. A row whose copies differ
   * says so beside the box, and the next commit writes both.
   */
  copies: number[];
}

function scalarOf(setting: Setting) {
  return setting.value?.arrayValue?.value ?? setting.value;
}

function numberFrom(setting: Setting): TrackpadNumber | null {
  const value = scalarOf(setting)?.int32Value;
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
    copies: [value],
  };
}

/** The named integer setting with its range, or null if this keyboard has none. */
export function readTrackpadNumber(
  settings: readonly Setting[],
  key: string,
): TrackpadNumber | null {
  const sides = readTrackpadNumberPerSide(settings, key);
  if (sides.length === 0) return null;
  return { ...sides[0], copies: sides.map((side) => side.value) };
}

/**
 * The named integer setting once per split side, central first.
 *
 * For the few settings that are legitimately different on the two halves —
 * the report interval paces a Bluetooth link that only one half's pointer
 * crosses — each side gets its own box, and each box writes only its side.
 */
export function readTrackpadNumberPerSide(
  settings: readonly Setting[],
  key: string,
): TrackpadNumber[] {
  return settings
    .filter((candidate) => candidate.key === key)
    .sort((a, b) => a.source - b.source)
    .map(numberFrom)
    .filter((field): field is TrackpadNumber => field !== null);
}

/** True when the split sides hold different values for this field. */
export function sidesDisagree(field: {
  copies: readonly (number | boolean)[];
}): boolean {
  return new Set(field.copies).size > 1;
}

export interface TrackpadToggle {
  /** The copy to write through. Writes go to every side regardless. */
  setting: Setting;
  enabled: boolean;
  /** Every side's copy, central first; see TrackpadNumber.copies. */
  copies: boolean[];
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
  // Same unwrapping the generic settings pane does: an array element carries
  // its scalar one level down, a plain setting is the scalar.
  const sides = settings
    .filter((candidate) => candidate.key === key)
    .sort((a, b) => a.source - b.source)
    .map((setting) => ({ setting, enabled: scalarOf(setting)?.boolValue }))
    .filter(
      (side): side is { setting: Setting; enabled: boolean } =>
        typeof side.enabled === "boolean",
    );
  if (sides.length === 0) return null;

  return {
    setting: sides[0].setting,
    enabled: sides[0].enabled,
    copies: sides.map((side) => side.enabled),
  };
}

/**
 * Parse what was typed into a number box, clamp it to the firmware's range and
 * write it to every side. A blank or unchanged box writes nothing: there is
 * nothing to say — unless the sides disagree, in which case an unchanged box
 * is still worth writing, because that is what brings them back together.
 *
 * `scale` is how many stored units one typed unit is: a setting the firmware
 * keeps in tenths but the box shows in whole counts passes 10, and "77.5"
 * becomes 775. The range is in stored units either way.
 *
 * `everySide` false writes only the side this copy came from — for the
 * per-side rows, where the two halves are meant to differ.
 */
export async function commitTrackpadNumber(
  settings: TrackpadSettingsAccess,
  field: TrackpadNumber,
  draft: string,
  fallbackRange: { min: number; max: number },
  scale = 1,
  everySide = true,
) {
  const typed = Number.parseFloat(draft);
  if (!Number.isFinite(typed)) return;
  const parsed = Math.round(typed * scale);
  if (parsed === field.value && !(everySide && sidesDisagree(field))) return;

  const min = field.min ?? fallbackRange.min;
  const max = field.max ?? fallbackRange.max;
  const clamped = Math.min(max, Math.max(min, parsed));

  await settings.writeSettingToMemory(
    field.setting,
    { int32Value: clamped },
    { allSources: everySide },
  );
  await settings.saveSection(field.setting.customSubsystemIndex);
}
