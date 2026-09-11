/**
 * Two decisions, both of which go wrong quietly if they are wrong.
 *
 * The behavior id is device-local, so a guessed one writes some unrelated
 * behavior onto a key and the keymap looks fine until it is pressed.
 *
 * The advance must stop at the end rather than wrap: someone using this is
 * looking at the keyboard, not at a counter, and a wrap would start
 * overwriting the keys they just set without anything on screen changing.
 */
import { keyPressCandidates, nextKeyPosition } from "../quickAssign";
import type { BehaviorDefinition } from "../../../hooks/useKeymap";

function behaviors(entries: [number, string][]) {
  return new Map<number, BehaviorDefinition>(
    entries.map(([id, displayName]) => [
      id,
      { displayName } as BehaviorDefinition,
    ]),
  );
}

describe("listing the key press candidates", () => {
  it("puts ids the board already binds first", () => {
    // A real keyboard listed "Key Press" as 50397 and then refused to bind
    // it. An id the device itself sent back is the better bet, so it is
    // tried first — but the other is kept, because the first one may fail.
    const map = behaviors([
      [50397, "Key Press"],
      [10, "Key Press"],
    ]);
    expect(keyPressCandidates(map, [{ behaviorId: 10 }])).toEqual([10, 50397]);
  });

  it("still offers a listed id when the board binds none", () => {
    const map = behaviors([
      [35, "Transparent"],
      [10, "Key Press"],
    ]);
    expect(keyPressCandidates(map, [{ behaviorId: 35 }])).toEqual([10]);
  });

  it("accepts the short name too", () => {
    expect(keyPressCandidates(behaviors([[7, "kp"]]))).toEqual([7]);
  });

  it("lists an id once however often it is bound", () => {
    // The board is mostly key presses; without this the list would be
    // hundreds of copies of the same id and every retry would repeat it.
    const map = behaviors([[10, "Key Press"]]);
    expect(
      keyPressCandidates(map, [
        { behaviorId: 10 },
        { behaviorId: 10 },
        { behaviorId: 10 },
      ]),
    ).toEqual([10]);
  });

  it("offers nothing rather than guessing", () => {
    // A device with no key press should not be offered quick assign at all;
    // a fallback id would write some unrelated behavior onto every key.
    expect(keyPressCandidates(behaviors([[35, "Transparent"]]))).toEqual([]);
    expect(keyPressCandidates(new Map())).toEqual([]);
  });

  it("ignores bindings naming a behavior the device never listed", () => {
    expect(keyPressCandidates(behaviors([]), [{ behaviorId: 99 }])).toEqual([]);
  });
});

describe("advancing to the next key", () => {
  const positions = [0, 1, 2, 5, 6];

  it("moves to the next position the layout actually has", () => {
    // Layouts skip numbers — ErgoTrack's gesture positions sit above its
    // physical keys — so this is the next in the list, not the next integer.
    expect(nextKeyPosition(positions, 2)).toBe(5);
  });

  it("stops at the end instead of wrapping", () => {
    expect(nextKeyPosition(positions, 6)).toBeNull();
  });

  it("starts at the first key when nothing is selected", () => {
    expect(nextKeyPosition(positions, null)).toBe(0);
  });

  it("gives up on a position the layout does not have", () => {
    // Switching layouts mid-run can leave the selection pointing at a key
    // that no longer exists; advancing from a guess would be worse.
    expect(nextKeyPosition(positions, 99)).toBeNull();
  });

  it("has nowhere to go on an empty layout", () => {
    expect(nextKeyPosition([], null)).toBeNull();
    expect(nextKeyPosition([], 0)).toBeNull();
  });
});
