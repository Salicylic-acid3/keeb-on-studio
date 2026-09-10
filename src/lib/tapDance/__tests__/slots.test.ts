/**
 * The keys carry the structure: `tap_dance0/taps` element 2 is the third tap
 * of the first dance, and nothing else says so. Getting the grouping wrong
 * would attach taps to the wrong dance without any error, which is the kind
 * of bug that is only found by pressing keys.
 *
 * Two of these guard against assumptions that were wrong the first time
 * round: that an empty array still lists a setting to append to (it lists
 * nothing at all), and that an array element's `size` says how many it may
 * hold (it says how many it does).
 */
import { groupIntoSlots } from "../slots";
import type { Setting } from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

const SUBSYSTEM = 16;

function tap(slot: number, index: number, size: number, behaviorId: number) {
  return {
    customSubsystemIndex: SUBSYSTEM,
    source: 0,
    key: `tap_dance${slot}/taps`,
    value: {
      arrayValue: {
        index,
        size,
        value: { behaviorValue: { behaviorId, param1: 0, param2: 0 } },
      },
    },
  } as Setting;
}

function term(slot: number, ms: number) {
  return {
    customSubsystemIndex: SUBSYSTEM,
    source: 0,
    key: `tap_dance${slot}/term`,
    value: { int32Value: ms },
  } as Setting;
}

function maxTaps(count: number) {
  return {
    customSubsystemIndex: SUBSYSTEM,
    source: 0,
    key: "max_taps",
    value: { int32Value: count },
  } as Setting;
}

describe("grouping settings into tap dance slots", () => {
  it("keeps each slot's taps to itself", () => {
    const slots = groupIntoSlots([
      tap(0, 0, 3, 10),
      tap(1, 0, 3, 20),
      tap(0, 1, 3, 11),
      term(1, 250),
      term(0, 180),
    ]);

    expect(slots.map((s) => s.index)).toEqual([0, 1]);
    expect(slots[0].taps).toHaveLength(2);
    expect(slots[1].taps).toHaveLength(1);
    expect(slots[0].term?.value?.int32Value).toBe(180);
    expect(slots[1].term?.value?.int32Value).toBe(250);
  });

  it("puts taps in tap order however they arrive", () => {
    // The RPC gives no ordering guarantee, and "third tap" being listed first
    // would silently rename every row.
    const slots = groupIntoSlots([
      tap(0, 2, 3, 12),
      tap(0, 0, 3, 10),
      tap(0, 1, 3, 11),
    ]);
    expect(
      slots[0].taps.map(
        (s) => s.value?.arrayValue?.value?.behaviorValue?.behaviorId,
      ),
    ).toEqual([10, 11, 12]);
  });

  it("sorts slots numerically, not as text", () => {
    // Slot 10 sorts before slot 2 as a string, which would put the list in a
    // baffling order the moment someone configures more than nine.
    const slots = groupIntoSlots([tap(10, 0, 1, 1), tap(2, 0, 1, 1)]);
    expect(slots.map((s) => s.index)).toEqual([2, 10]);
  });

  it("reports a slot with no taps rather than dropping it", () => {
    // This is the normal state of a fresh slot, and the whole reason this
    // screen exists -- if it vanished here there would be nothing to add to.
    const slots = groupIntoSlots([term(0, 200)]);
    expect(slots).toHaveLength(1);
    expect(slots[0].taps).toEqual([]);
    expect(slots[0].term).not.toBeNull();
  });

  it("can name a taps array that lists nothing", () => {
    // An array with no elements produces no list notifications at all, so
    // appending the first tap has to work from a reference built out of a
    // sibling setting. Without this, a fresh slot stays empty forever.
    const slots = groupIntoSlots([term(2, 200)]);
    expect(slots[0].tapsRef).toEqual({
      customSubsystemIndex: SUBSYSTEM,
      key: "tap_dance2/taps",
      source: 0,
    });
  });

  it("takes the capacity from the firmware, not from an element's size", () => {
    // An element's `size` is the array's current length. Reading it as the
    // maximum made a full slot of every slot, so "add a tap" was never
    // offered.
    const slots = groupIntoSlots([maxTaps(3), tap(0, 0, 1, 10), term(0, 200)]);
    expect(slots[0].taps).toHaveLength(1);
    expect(slots[0].maxTaps).toBe(3);
  });

  it("leaves the capacity unknown when the firmware did not say", () => {
    // Older firmware has no max_taps setting. Zero means "no ceiling known",
    // which the screen treats as no reason to disable adding.
    const slots = groupIntoSlots([tap(0, 0, 1, 10)]);
    expect(slots[0].maxTaps).toBe(0);
  });

  it("does not mistake the capacity for a slot", () => {
    expect(groupIntoSlots([maxTaps(3)])).toEqual([]);
  });

  it("ignores settings that are not tap dance", () => {
    const other = {
      key: "something/else",
      value: { int32Value: 1 },
    } as Setting;
    expect(groupIntoSlots([other])).toEqual([]);
  });
});
