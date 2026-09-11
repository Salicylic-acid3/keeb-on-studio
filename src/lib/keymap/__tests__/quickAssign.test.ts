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
import { findKeyPressBehaviorId, nextKeyPosition } from "../quickAssign";
import type { BehaviorDefinition } from "../../../hooks/useKeymap";

function behaviors(entries: [number, string][]) {
  return new Map<number, BehaviorDefinition>(
    entries.map(([id, displayName]) => [
      id,
      { displayName } as BehaviorDefinition,
    ]),
  );
}

describe("finding the key press behavior", () => {
  it("finds it by name, since ids differ per device", () => {
    expect(
      findKeyPressBehaviorId(
        behaviors([
          [35, "Transparent"],
          [10, "Key Press"],
        ]),
      ),
    ).toBe(10);
  });

  it("accepts the short name too", () => {
    expect(findKeyPressBehaviorId(behaviors([[7, "kp"]]))).toBe(7);
  });

  it("prefers an id the board is already using", () => {
    // A real keyboard listed a behavior called "Key Press" whose id the
    // firmware then refused to bind. A binding already on the board is proof
    // the device accepts that id, so it wins over anything merely listed.
    const map = behaviors([
      [50397, "Key Press"],
      [10, "Key Press"],
    ]);
    expect(findKeyPressBehaviorId(map, [{ behaviorId: 10 }])).toBe(10);
  });

  it("ignores bindings that are not key presses", () => {
    const map = behaviors([
      [35, "Transparent"],
      [10, "Key Press"],
    ]);
    expect(
      findKeyPressBehaviorId(map, [{ behaviorId: 35 }, { behaviorId: 10 }]),
    ).toBe(10);
  });

  it("falls back to the listed behavior when the board has no key press", () => {
    const map = behaviors([[10, "Key Press"]]);
    expect(findKeyPressBehaviorId(map, [{ behaviorId: 35 }])).toBe(10);
  });

  it("returns null rather than guessing", () => {
    // A device without it should not be offered quick assign at all; a
    // fallback id would write some unrelated behavior onto every key.
    expect(findKeyPressBehaviorId(behaviors([[35, "Transparent"]]))).toBeNull();
    expect(findKeyPressBehaviorId(new Map())).toBeNull();
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
