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
 * The key-press behavior's id on this device, or null if it has none.
 *
 * Behavior ids are assigned per device, so the name is the only handle the
 * app has to start from. The name alone turned out not to be enough: a real
 * keyboard reported a behavior called "Key Press" whose id the firmware then
 * refused to bind ("Invalid behavior ID: 50397"). Listing a behavior and
 * accepting it in a binding are not the same thing.
 *
 * So the keymap is asked first. A binding already on the board is proof that
 * this device accepts that id — it is what the device itself sent back when
 * the keymap was read. Only when the board has no key press anywhere does
 * this fall back to matching a listed behavior by name.
 *
 * Null means quick assign cannot work here and should not be offered. A
 * guessed id would land on some unrelated behavior, and the keymap would look
 * correct until a key was pressed.
 *
 * @param bindings every binding on the board, in any order. Cheap to pass and
 *   worth passing: it is the only evidence available of what the firmware
 *   will actually take.
 */
export function findKeyPressBehaviorId(
  behaviors: Map<number, BehaviorDefinition>,
  bindings?: readonly { behaviorId: number }[],
): number | null {
  const isKeyPress = (id: number) =>
    KEY_PRESS_NAMES.includes(behaviors.get(id)?.displayName ?? "");

  for (const binding of bindings ?? []) {
    if (isKeyPress(binding.behaviorId)) {
      return binding.behaviorId;
    }
  }

  for (const [id, behavior] of behaviors) {
    if (KEY_PRESS_NAMES.includes(behavior.displayName ?? "")) {
      return id;
    }
  }
  return null;
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
