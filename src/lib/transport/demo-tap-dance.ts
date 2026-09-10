/**
 * Tap dance in demo mode.
 *
 * The firmware module (zmk-feature-runtime-tap-dance) keeps its slots as
 * ordinary custom settings under its own subsystem id, so the demo does not
 * need a handler of its own: it only has to produce settings shaped the way
 * that module's would be, owned by a subsystem index the demo advertises.
 *
 * Demo mode matters here more than for most features. Someone deciding
 * whether a 30% layout can carry the keys they need has to be able to try
 * tap dance *before* buying a keyboard, and this is the only place they can.
 *
 * Two slots start configured and two start empty on purpose. Empty is the
 * state a freshly flashed keyboard is actually in, and it is the state that
 * exercises the awkward path -- an array with no elements lists no settings
 * at all, so "add the first tap" has to work with nothing to point at.
 */
import type {
  Setting,
  SettingConstraint,
  SettingValue,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** Must match the firmware module's ZMK_RUNTIME_TAP_DANCE_SUBSYSTEM_ID. */
export const TAP_DANCE_IDENTIFIER = "keebon__runtime_tap_dance";

/** Slots the demo keyboard advertises (firmware default: 4). */
const SLOT_COUNT = 4;

/** Taps per slot the demo keyboard allows (firmware default: 3). */
const MAX_TAPS = 3;

/** Default wait between taps, in ms (firmware default: 200). */
const DEFAULT_TERM_MS = 200;

const KEY_PRESS = 10;
const CAPS_WORD = 8;

/** Escape / Tab / Backspace, as this app encodes a &kp parameter. */
const KC_ESC = 0x29;
const KC_TAB = 0x2b;

/**
 * What each slot starts holding. Slots absent from here start empty.
 *
 * Slot 0 mixes two different behaviors deliberately: a tap dance whose taps
 * were all key presses would suggest that is all it can do.
 */
const INITIAL_TAPS: Record<number, { behaviorId: number; param1: number }[]> = {
  0: [
    { behaviorId: KEY_PRESS, param1: KC_ESC },
    { behaviorId: CAPS_WORD, param1: 0 },
  ],
  1: [{ behaviorId: KEY_PRESS, param1: KC_TAB }],
};

function scalarSetting(
  customSubsystemIndex: number,
  key: string,
  value: SettingValue,
  constraints: SettingConstraint[],
): Setting {
  return {
    customSubsystemIndex,
    key,
    source: 0,
    hasUnsavedValue: false,
    meta: {
      confidentiality: 2,
      readPermission: 0,
      writePermission: 0,
      constraints,
    },
    value,
  };
}

/**
 * The settings a keyboard with this module would list.
 *
 * One row per *active* array element, which is how the firmware enumerates
 * arrays -- so a slot with no taps contributes only its `term`, and that is
 * what tells the app the slot exists at all.
 */
export function createTapDanceSettings(
  customSubsystemIndex: number,
): Setting[] {
  const settings: Setting[] = [
    // The capacity. An array's RPC value reports its current length and the
    // protocol has no field for the maximum, so the firmware publishes it as
    // its own setting, pinned by a range to the one value that is true.
    scalarSetting(customSubsystemIndex, "max_taps", { int32Value: MAX_TAPS }, [
      {
        range: { min: { int32Value: MAX_TAPS }, max: { int32Value: MAX_TAPS } },
      },
    ]),
  ];

  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const taps = INITIAL_TAPS[slot] ?? [];
    taps.forEach((tap, index) => {
      settings.push({
        customSubsystemIndex,
        key: `tap_dance${slot}/taps`,
        source: 0,
        hasUnsavedValue: false,
        meta: {
          confidentiality: 2,
          readPermission: 0,
          writePermission: 0,
          constraints: [{ behaviorId: {} }],
        },
        value: {
          arrayValue: {
            index,
            size: taps.length,
            value: {
              behaviorValue: {
                behaviorId: tap.behaviorId,
                param1: tap.param1,
                param2: 0,
              },
            },
          },
        },
      });
    });

    settings.push(
      scalarSetting(
        customSubsystemIndex,
        `tap_dance${slot}/term`,
        { int32Value: DEFAULT_TERM_MS },
        [{ range: { min: { int32Value: 50 }, max: { int32Value: 1000 } } }],
      ),
    );
  }

  return settings;
}
