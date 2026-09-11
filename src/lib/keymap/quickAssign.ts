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
import { combineWithModifiers } from "../keycodes";

/** Display names ZMK uses for the key-press behavior. */
const KEY_PRESS_NAMES = ["Key Press", "kp"];

/**
 * The param1 a key-press binding takes for a keycode from the on-screen
 * keyboard.
 *
 * The on-screen keyboard speaks bare HID usage ids — 0x1A for W — because that
 * is what the key dialog's grid and its highlighting use. A binding does not:
 * &kp wants the full usage with the page in the high half, 0x0007001A. Writing
 * the bare id produced three rounds of "Invalid behavior ID: 50397", which was
 * this app mislabelling the firmware's INVALID_PARAMETERS: the behavior id was
 * right every time and the value was out of range. Nothing caught it earlier
 * because the demo transport validates no parameters at all, so quick assign
 * worked perfectly everywhere except on a real keyboard.
 *
 * No modifiers: quick assign is for plain keys, and anything with a modifier
 * goes through the dialog.
 */
export function keyPressParam(code: number): number {
  return combineWithModifiers(code, 0);
}

/**
 * Every id on this device that claims to be a key press, best first.
 *
 * Behavior ids are device-local, so the name is the only handle the app has.
 * The order is the order of decreasing evidence:
 *
 * 1. ids already bound on the board — the device sent these back itself when
 *    the keymap was read, so it demonstrably knows them;
 * 2. anything else listed under a key-press name.
 *
 * The caller writes with the first and uses the whole list to decide whether
 * the key it is looking at is a plain key press. An empty list means quick
 * assign cannot work here and should not be offered; it never falls back to a
 * guessed id, which would land on some unrelated behavior and look right until
 * the key was pressed.
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
