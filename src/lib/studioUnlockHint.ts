/**
 * How to unlock *this* keyboard.
 *
 * The unlock prompt's generic line — "press the studio unlock key combination
 * on your keyboard" — is true of every ZMK keyboard and useful for none: the
 * gesture is whatever the keymap author bound, and someone reading the dialog
 * is precisely the person who does not know what that is. So when the keyboard
 * names itself over the Studio protocol and it is one this app knows, the
 * dialog can simply say.
 *
 * Right now it never has to. Both keyboards ship with CONFIG_ZMK_STUDIO_LOCKING
 * off and are configured over USB, so there is no lock to open and no unlock
 * key in either keymap. The table is empty rather than deleted: the mechanism
 * is fine, it is the instructions that stopped being true, and an instruction
 * naming keys that no longer do anything is worse than the vague line it
 * replaced. If a keyboard ever ships locked again, its entry goes here and
 * the firmware's keymap keeps the matching comment next to the binding.
 */

/** Keyed by `CONFIG_ZMK_KEYBOARD_NAME`, lower-cased. */
const UNLOCK_HINTS: Record<string, string> = {};

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
