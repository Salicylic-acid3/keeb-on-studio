/**
 * How to unlock *this* keyboard.
 *
 * The unlock prompt used to say "press the studio unlock key combination on
 * your keyboard", which is true of every ZMK keyboard and useful for none:
 * the gesture is whatever the keymap author bound, and someone reading the
 * dialog is precisely the person who does not know what that is. Studio
 * locking was off on both of these keyboards until it had to be turned on for
 * Bluetooth to work at all, so most owners will meet this dialog for the first
 * time with no idea what it wants.
 *
 * The keyboard names itself over the Studio protocol, and this app only talks
 * to two keyboards, so it can simply say. The generic line stays as the
 * fallback for a keyboard whose name we do not recognise.
 *
 * These strings describe what the shipped keymaps bind, so they go stale if
 * the firmware moves the unlock gesture -- which is why the firmware keeps its
 * reason next to the binding, and why this file names the config that has to
 * match.
 */

/** Keyed by `CONFIG_ZMK_KEYBOARD_NAME`, lower-cased. */
const UNLOCK_HINTS: Record<string, string> = {
  // config/clickboard_ergotrack.keymap -> drag_layer, position 13
  ergotrack:
    "Hold a left-click key and press the top-right key on the right half (Delete on the base layer).",
  // config/goforty_max.keymap -> layer 1, first position
  "goforty-max":
    "Hold the layer 1 key and press the top-left key (the Bluetooth previous-profile key on the base layer).",
};

/**
 * The instruction for this keyboard, or null when it is not one we know.
 *
 * Null means the caller should show the generic wording rather than guess:
 * a confidently wrong key combination is worse than an vague true one.
 */
export function unlockHintFor(
  deviceName: string | undefined | null,
): string | null {
  if (!deviceName) return null;
  return UNLOCK_HINTS[deviceName.trim().toLowerCase()] ?? null;
}
