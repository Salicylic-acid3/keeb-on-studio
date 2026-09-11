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
import {
  keyPressCandidates,
  keyPressParam,
  nextKeyPosition,
} from "../quickAssign";
import type { BehaviorDefinition } from "../../../hooks/useKeymap";

function behaviors(entries: [number, string][]) {
  return new Map<number, BehaviorDefinition>(
    entries.map(([id, displayName]) => [
      id,
      { displayName } as BehaviorDefinition,
    ]),
  );
}

describe("the keycode a binding is written with", () => {
  // This is the whole of the bug that took three rounds to find. The picker
  // hands out bare usage ids; a binding wants the page in the high half. The
  // demo transport validates nothing, so only real hardware ever said no —
  // and it said INVALID_PARAMETERS, which the app printed as "Invalid
  // behavior ID: 50397", sending the search after the wrong thing entirely.
  it("puts the keyboard page on a bare usage id", () => {
    expect(keyPressParam(0x1a)).toBe(0x0007001a); // W
    expect(keyPressParam(0x04)).toBe(0x00070004); // A
  });

  it("leaves a code that already carries its page alone", () => {
    // Consumer-page keys come through the picker fully formed; wrapping one
    // again would move the page and write some unrelated usage.
    expect(keyPressParam(0x000c00b5)).toBe(0x000c00b5); // next track
  });

  it("adds no modifiers", () => {
    // Quick assign is plain keys only. A stray modifier flag here would be
    // invisible on the board and only show up when the key was pressed.
    expect(keyPressParam(0x1a) >>> 24).toBe(0);
  });
});

describe("listing the key press candidates", () => {
  it("puts ids the board already binds first", () => {
    // An id the device sent back itself is better evidence than a name match,
    // since the names are ours and the ids are the device's.
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
