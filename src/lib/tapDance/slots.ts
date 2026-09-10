/**
 * Turning a flat list of tap-dance settings back into slots.
 *
 * The keys carry the structure and nothing else does: `tap_dance0/taps`
 * element 2 is the third tap of the first dance. Kept apart from the
 * component so it can be tested as the pure function it is.
 */
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";

/** The firmware module's subsystem id. Must match its header. */
export const TAP_DANCE_SUBSYSTEM_ID = "keebon__runtime_tap_dance";

/** `tap_dance3/taps` -> slot 3, part "taps". */
const KEY_PATTERN = /^tap_dance(\d+)\/(taps|term)$/;

export interface TapDanceSlot {
  index: number;
  /** One entry per configured tap, in tap order. */
  taps: Setting[];
  /** The array setting itself, needed to append or shorten it. */
  tapsSetting: Setting | null;
  term: Setting | null;
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

  const slotFor = (index: number): TapDanceSlot => {
    let slot = slots.get(index);
    if (!slot) {
      slot = { index, taps: [], tapsSetting: null, term: null, maxTaps: 0 };
      slots.set(index, slot);
    }
    return slot;
  };

  for (const setting of settings) {
    const match = KEY_PATTERN.exec(setting.key ?? "");
    if (!match) continue;
    const slot = slotFor(Number(match[1]));

    if (match[2] === "term") {
      slot.term = setting;
      continue;
    }

    slot.tapsSetting = setting;
    const array = setting.value?.arrayValue;
    if (array) {
      slot.taps.push(setting);
      // Every element reports the same maximum; the largest seen wins so an
      // empty array still knows its ceiling once one element exists.
      slot.maxTaps = Math.max(slot.maxTaps, array.size ?? 0);
    }
  }

  for (const slot of slots.values()) {
    slot.taps.sort(
      (a, b) =>
        (a.value?.arrayValue?.index ?? 0) - (b.value?.arrayValue?.index ?? 0),
    );
  }

  return [...slots.values()].sort((a, b) => a.index - b.index);
}
