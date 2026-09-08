/**
 * Which keyboards Keeb-On! Studio will talk to.
 *
 * Keeb-On! Studio is deliberately narrowed to the keyboards Salicylic_acid3
 * develops; every other ZMK keyboard is pointed at upstream DYA Studio instead
 * (see the home page Q&A). This module is the one place that decides which is
 * which, so the rule and the list live together.
 *
 * The check is on the keyboard name the device reports over the ZMK Studio
 * protocol (`CONFIG_ZMK_KEYBOARD_NAME`), not on the USB vendor ID, because:
 *
 * - the name is available over *every* transport. A BLE connection has no USB
 *   vendor ID to test at all, so a VID-only rule would let any keyboard in
 *   over Bluetooth;
 * - it needs no firmware change, so it also covers boards already flashed with
 *   an older build.
 *
 * The firmware does now carry its own USB identity (VID 0x355D; PID 0x1028 for
 * ErgoTrack, 0x1029 for GoFortyMax), which would let the browser's serial port
 * picker be filtered down to these keyboards before the user picks one --
 * nicer than connecting and then rejecting. That needs a filter argument on
 * `connectSerial()` in @cormoran/zmk-studio-react-hook, which today calls
 * `navigator.serial.requestPort()` with no options, so it waits on a change
 * upstream (or on this app owning the serial-connect path itself).
 *
 * This is a guard against picking the wrong keyboard, not a security boundary:
 * the name is self-reported and anyone building their own firmware can claim
 * it. That is fine -- the point is that someone else's keyboard fails with an
 * explanation and a pointer to DYA Studio, rather than half-working and
 * turning into a support request.
 */

/**
 * `CONFIG_ZMK_KEYBOARD_NAME` of every supported keyboard, lower-cased.
 *
 * Keep these in sync with `Kconfig.defconfig` in the firmware repositories.
 * Note the names are intentionally the lower-case identifiers rather than the
 * marketing names: the same string keys each device's saved version history,
 * so renaming a keyboard would orphan its stored snapshots.
 */
export const SUPPORTED_DEVICE_NAMES = [
  // Salicylic-acid3/zmk-keyboard-clickboard-ergotrack
  "ergotrack",
  // Salicylic-acid3/zmk-keyboard-gofortymax-ortho
  "goforty-max",
] as const;

/**
 * Whether `name` is a keyboard Keeb-On! Studio supports.
 *
 * A missing name is *not* supported, but callers must only ask once the device
 * info has actually loaded -- during connection the name is briefly undefined,
 * and treating that as "unsupported" would reject every keyboard.
 */
export function isSupportedDevice(name: string | undefined | null): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return SUPPORTED_DEVICE_NAMES.some((supported) => supported === normalized);
}
