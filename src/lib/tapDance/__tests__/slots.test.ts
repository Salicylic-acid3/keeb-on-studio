/**
 * The keys carry the structure: `tap_dance0/taps` element 2 is the third tap
 * of the first dance, and nothing else says so. Getting the grouping wrong
 * would attach taps to the wrong dance without any error, which is the kind
 * of bug that is only found by pressing keys.
 */
import { groupIntoSlots } from "../slots";
import type { Setting } from "../../../proto/cormoran/zmk/custom_settings/custom_settings";

function tap(slot: number, index: number, size: number, behaviorId: number) {
  return {
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
  return { key: `tap_dance${slot}/term`, value: { int32Value: ms } } as Setting;
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

  it("remembers how many taps a slot can hold", () => {
    const slots = groupIntoSlots([tap(0, 0, 3, 10)]);
    expect(slots[0].maxTaps).toBe(3);
  });

  it("ignores settings that are not tap dance", () => {
    const other = {
      key: "something/else",
      value: { int32Value: 1 },
    } as Setting;
    expect(groupIntoSlots([other])).toEqual([]);
  });
});
