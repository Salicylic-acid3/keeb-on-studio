/**
 * Which keyboards Keeb-On! Studio will talk to.
 *
 * Keeb-On! Studio drives Salicylic_acid3's keyboards and nothing else. The
 * test is the **USB vendor id**: every keyboard from this workshop is built
 * with VID 0x355D, and no other keyboard is. So the rule is a single number
 * rather than a list of names, and a keyboard designed next month works
 * without this app being told about it first.
 *
 * It used to be a list of names, for a reason that has since expired: a BLE
 * connection has no USB vendor id at all, so while Bluetooth was offered a
 * VID rule would have let any keyboard in over the air. Configuration is
 * USB-only now (see connectionMethods.ts), and a transport that always has a
 * vendor id can be gated on one.
 *
 * The vendor id is better than the name in two ways. It is checked *before*
 * connecting -- the browser's port picker only lists keyboards that match, so
 * a stranger's keyboard is never picked rather than picked and then hung up
 * on. And it does not go stale: adding a keyboard to the line-up means giving
 * it a product id in the numbering table, not editing this file.
 *
 * This is a guard against talking to the wrong keyboard, not a security
 * boundary. Anyone building their own firmware can claim any vendor id; the
 * point is that someone else's keyboard fails with an explanation and a
 * pointer to DYA Studio, rather than half-working and turning into a support
 * request.
 */

/**
 * The USB vendor id every Salicylic_acid3 keyboard is built with.
 *
 * Set in each shield's `Kconfig.defconfig`. Registered to moimate inc. and
 * used with permission. Product ids are per-keyboard (ErgoTrack 0x1028,
 * GoFortyMax 0x1029) and are deliberately *not* checked: the whole point of
 * gating on the vendor id is that a new keyboard needs no app change.
 */
export const KEEB_ON_USB_VENDOR_ID = 0x355d;

/**
 * A `filters` array for `navigator.serial.requestPort()`, so the browser's own
 * picker only offers keyboards this app can drive.
 */
export const KEEB_ON_SERIAL_FILTERS = [{ usbVendorId: KEEB_ON_USB_VENDOR_ID }];

/** The same filter in the shape `navigator.usb.requestDevice()` wants. */
export const KEEB_ON_WEBUSB_FILTERS = [{ vendorId: KEEB_ON_USB_VENDOR_ID }];

/**
 * Whether a USB vendor id is one of this workshop's keyboards.
 *
 * An absent id is *not* supported. Web Serial reports no vendor id for a plain
 * serial adapter, which is exactly the case worth refusing: the app would
 * otherwise happily start speaking the Studio protocol to whatever it is.
 */
export function isSupportedVendorId(
  vendorId: number | undefined | null,
): boolean {
  return vendorId === KEEB_ON_USB_VENDOR_ID;
}

/**
 * The keyboards this app knows by name, lower-cased
 * (`CONFIG_ZMK_KEYBOARD_NAME`).
 *
 * This is a **roster, not the gate.** Whether a keyboard may connect is
 * decided by {@link isSupportedVendorId}, so a keyboard designed tomorrow
 * works without being listed here. What this list is for is everything that
 * genuinely is per-keyboard and cannot be derived:
 *
 * - the firmware downloads, which need each board's repository and file names;
 * - the gallery's board field, which is validated against a fixed set so a
 *   post cannot claim to be for a keyboard that does not exist;
 * - per-keyboard tables elsewhere (battery half naming, trackpad gestures),
 *   which key off the name or the layout and simply show less when it is not
 *   one they know.
 *
 * A new keyboard connects and edits fine without an entry. It gains firmware
 * downloads and a gallery board when one is added.
 *
 * The names are the lower-case identifiers rather than the marketing names:
 * the same string keys each device's saved version history, so renaming a
 * keyboard would orphan its stored snapshots.
 */
export const SUPPORTED_DEVICE_NAMES = [
  // Salicylic-acid3/zmk-keyboard-clickboard-ergotrack
  "ergotrack",
  // Salicylic-acid3/zmk-keyboard-gofortymax-ortho
  "goforty-max",
] as const;

/**
 * Whether `name` is a keyboard on the roster above.
 *
 * Not a connection check -- see {@link isSupportedVendorId} for that. Callers
 * use this where a keyboard has to be one of the *known* ones: the gallery's
 * board field, and anything keyed to a specific board's data.
 */
export function isKnownDeviceName(name: string | undefined | null): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return SUPPORTED_DEVICE_NAMES.some((known) => known === normalized);
}
