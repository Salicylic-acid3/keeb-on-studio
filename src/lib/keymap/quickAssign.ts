/**
 * Setting a run of keys without opening a dialog each time.
 *
 * The dialog is the right tool for one key: it can express anything a binding
 * can be — a layer tap, a mod tap, a macro, parameters and all. It is the
 * wrong tool for thirty keys in a row, because every key costs an open, a
 * choice and a close, and the thing being edited disappears behind the modal
 * while you choose.
 *
 * Quick assign is the other half of that trade: one behavior only — a plain
 * key press — chosen from a keyboard that is always on screen, applied to the
 * selected key, which then advances to the next one. Anything that is not a
 * plain keycode still goes through the dialog, which is why the dialog stays
 * exactly as it was.
 *
 * The two decisions worth testing live here: which behavior a plain keycode
 * actually is on *this* device, and which key comes next.
 */
import type { BehaviorDefinition } from "../../hooks/useKeymap";

/** Display names ZMK uses for the key-press behavior. */
const KEY_PRESS_NAMES = ["Key Press", "kp"];

/**
 * Every id on this device that claims to be a key press, best first.
 *
 * There is no reliable way to know which one the firmware will accept. A real
 * keyboard reported a behavior called "Key Press" and then refused to bind it
 * ("Invalid behavior ID: 50397") — listing a behavior and accepting it in a
 * binding are not the same thing, and nothing in the listing says which is
 * which. Picking one and hoping is what produced that error twice.
 *
 * So the caller gets all of them and finds out by asking the device, keeping
 * whichever works. The order is the order of decreasing evidence:
 *
 * 1. ids already bound on the board — the device sent these back itself when
 *    the keymap was read, so it demonstrably knows them;
 * 2. anything else listed under a key-press name.
 *
 * An empty list means quick assign cannot work here and should not be
 * offered. It never guesses an id that nothing named: that would land on some
 * unrelated behavior and the keymap would look right until a key was pressed.
 *
 * @param bindings every binding on the board, in any order.
 */
export function keyPressCandidates(
  behaviors: Map<number, BehaviorDefinition>,
  bindings?: readonly { behaviorId: number }[],
): number[] {
  const named = (id: number) =>
    KEY_PRESS_NAMES.includes(behaviors.get(id)?.displayName ?? "");

  const ordered: number[] = [];
  const add = (id: number) => {
    if (named(id) && !ordered.includes(id)) ordered.push(id);
  };

  for (const binding of bindings ?? []) add(binding.behaviorId);
  for (const id of behaviors.keys()) add(id);
  return ordered;
}

/**
 * The key after this one, or null at the end.
 *
 * Deliberately does not wrap. Running off the end of the board and quietly
 * starting again at the top would overwrite the keys just set, and the person
 * doing this is looking at the keyboard rather than at a counter. Stopping is
 * visible; wrapping is not.
 *
 * @param positions the key positions the layout actually has, in the order
 *   they are drawn. A layout may skip numbers — ErgoTrack's gesture positions
 *   sit above its physical keys — so "the next one" is the next in this list
 *   rather than the next integer.
 */
export function nextKeyPosition(
  positions: readonly number[],
  current: number | null,
): number | null {
  if (current === null) return positions[0] ?? null;
  const index = positions.indexOf(current);
  if (index < 0) return null;
  return positions[index + 1] ?? null;
}
