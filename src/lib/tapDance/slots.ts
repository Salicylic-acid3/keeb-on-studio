/**
 * Turning a flat list of tap-dance settings back into slots.
 *
 * The keys carry the structure and nothing else does: `tap_dance0/taps`
 * element 2 is the third tap of the first dance. Kept apart from the
 * component so it can be tested as the pure function it is.
 *
 * Two things about the settings protocol shape this more than the keys do.
 *
 * List enumeration sends one notification per *active* array element, so an
 * array holding nothing produces no listed setting at all -- a fresh slot is
 * invisible except for its `term`. That is why a slot carries a `tapsRef` it
 * builds from whichever of its settings did arrive, rather than a listed
 * `Setting`: appending the first tap has to work with nothing to point at.
 *
 * And `arrayValue.size` is the array's current length, not its capacity, so
 * it cannot say when a slot is full. The capacity arrives as its own
 * `max_taps` setting, which the firmware pins to a single value.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** The firmware module's subsystem id. Must match its header. */
export const TAP_DANCE_SUBSYSTEM_ID = "keebon__runtime_tap_dance";

/** `tap_dance3/taps` -> slot 3, part "taps". */
const KEY_PATTERN = /^tap_dance(\d+)\/(taps|holds|term)$/;

/** The module-wide capacity setting, shared by every slot. */
const MAX_TAPS_KEY = "max_taps";
/**
 * Published by firmware that has hold actions. Its presence is the only way
 * to tell: a holds array with nothing in it is not listed at all.
 */
const MAX_HOLDS_KEY = "max_holds";

/** What it takes to name a slot's taps array, listed or not. */
export interface TapsRef {
  customSubsystemIndex: number;
  key: string;
  source: number;
}

export interface TapDanceSlot {
  index: number;
  /** One entry per configured tap, in tap order. */
  taps: Setting[];
  /** How to name the taps array — valid even when it holds nothing. */
  tapsRef: TapsRef;
  /**
   * What each tap count does when the key is still held once the dance is
   * decided; parallel to `taps`. Empty on firmware without hold actions.
   */
  holds: Setting[];
  holdsRef: TapsRef;
  /** False on firmware from before hold actions existed. */
  holdsSupported: boolean;
  term: Setting | null;
  /** Capacity, or 0 when the firmware did not say. */
  maxTaps: number;
}

/**
 * Group a flat list of settings into slots.
 *
 * Exported because the grouping is the part worth testing: the keys carry
 * the structure, and getting it wrong shows up as taps silently attached to
 * the wrong dance.
 */
export function groupIntoSlots(settings: Setting[]): TapDanceSlot[] {
  const slots = new Map<number, TapDanceSlot>();
  let maxTaps = 0;
  let holdsSupported = false;

  const slotFor = (index: number, from: Setting): TapDanceSlot => {
    let slot = slots.get(index);
    if (!slot) {
      slot = {
        index,
        taps: [],
        // Built from a sibling setting because the taps array may have no
        // listed row of its own. Every setting in a slot shares the
        // subsystem and source; only the key differs.
        tapsRef: {
          customSubsystemIndex: from.customSubsystemIndex,
          key: `tap_dance${index}/taps`,
          source: from.source,
        },
        holds: [],
        holdsRef: {
          customSubsystemIndex: from.customSubsystemIndex,
          key: `tap_dance${index}/holds`,
          source: from.source,
        },
        holdsSupported: false,
        term: null,
        maxTaps: 0,
      };
      slots.set(index, slot);
    }
    return slot;
  };

  for (const setting of settings) {
    if (setting.key === MAX_TAPS_KEY) {
      maxTaps = Math.max(maxTaps, setting.value?.int32Value ?? 0);
      continue;
    }
    if (setting.key === MAX_HOLDS_KEY) {
      holdsSupported = true;
      continue;
    }

    const match = KEY_PATTERN.exec(setting.key ?? "");
    if (!match) continue;
    const slot = slotFor(Number(match[1]), setting);

    if (match[2] === "term") {
      slot.term = setting;
      continue;
    }

    if (setting.value?.arrayValue) {
      (match[2] === "holds" ? slot.holds : slot.taps).push(setting);
    }
  }

  const byIndex = (a: Setting, b: Setting) =>
    (a.value?.arrayValue?.index ?? 0) - (b.value?.arrayValue?.index ?? 0);
  for (const slot of slots.values()) {
    slot.maxTaps = maxTaps;
    slot.holdsSupported = holdsSupported;
    slot.taps.sort(byIndex);
    slot.holds.sort(byIndex);
  }

  return [...slots.values()].sort((a, b) => a.index - b.index);
}
