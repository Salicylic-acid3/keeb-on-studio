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
 *
 * One consequence is deliberate and was weighed. This app is for the ZMK
 * keyboards from this workshop, but the vendor id is shared with every
 * keyboard here, ZMK or not — ClickBoard ErgoMini, for one, reports 0x355D on
 * USB. So a keyboard that speaks no ZMK Studio protocol can still be offered
 * in the picker and then fail the handshake. Filtering on product ids as well
 * would stop that, and would also undo the point of the change: a keyboard
 * designed next month would be refused by its own configurator until someone
 * remembered to add its number here. The owner's call (2026-09-11) is to leave
 * it, and to improve the message someone actually meets if it turns out to
 * confuse people.
 */

/**
 * The USB vendor id every Salicylic_acid3 keyboard is built with.
 *
 * Set in each shield's `Kconfig.defconfig`. Registered to moimate inc. and
 * used with permission. Product ids are per-keyboard (ErgoTrack 0x1028,
 * GoFortyWL Ortho 0x1029) and are deliberately *not* checked: the whole point of
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
 * The entries are **storage keys**, not what the firmware reports today: the
 * same string keys each device's saved version history (and the gallery's
 * board field, the battery tables...), so they never change. A keyboard that
 * is renamed keeps its key, and its new name is listed in
 * {@link DEVICE_NAME_ALIASES}; {@link deviceKeyFor} turns either into the key.
 */
export const SUPPORTED_DEVICE_NAMES = [
  // Salicylic-acid3/zmk-keyboard-clickboard-ergotrack
  "ergotrack",
  // Salicylic-acid3/zmk-keyboard-gofortywl-ortho (GoFortyWL Ortho; the
  // firmware called itself "goforty-max" while it was GoFortyMax Ortho)
  "goforty-max",
  // Salicylic-acid3/zmk-keyboard-bethirtywl-qaz (BeThirtyWL QAZ; formerly
  // BeThirtyMax QAZ, "be30max-qaz")
  "be30max-qaz",
  // Salicylic-acid3/zmk-keyboard-bethirtywl-ortho (BeThirtyWL Ortho;
  // formerly BeThirtyMax Ortho, "be30max-ortho")
  "be30max-ortho",
] as const;

/**
 * Names the firmware reports now, lower-cased, for keyboards that were
 * renamed: each maps to the storage key the keyboard had before.
 *
 * GoFortyMax Ortho / BeThirtyMax QAZ / BeThirtyMax Ortho became GoFortyWL
 * Ortho / BeThirtyWL QAZ / BeThirtyWL Ortho (2026-11), and their firmware
 * reports the product name since. A keyboard still on the old firmware
 * reports the old name, so both have to work, and both have to find the same
 * saved history.
 */
export const DEVICE_NAME_ALIASES: Readonly<Record<string, string>> = {
  "gofortywl ortho": "goforty-max",
  "bethirtywl qaz": "be30max-qaz",
  "bethirtywl ortho": "be30max-ortho",
};

/**
 * The key a keyboard's per-device data is stored under: the name lower-cased
 * and trimmed, with a renamed keyboard's new name mapped to its old key.
 * Null for no name.
 */
export function deviceKeyFor(name: string | undefined | null): string | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return DEVICE_NAME_ALIASES[normalized] ?? normalized;
}

/**
 * What to key a device's stored data by. A renamed keyboard's new name maps to
 * the key its data already has; any other name is used exactly as reported,
 * as it always was, so nothing stored for it moves.
 */
export function storageKeyForDevice(name: string): string {
  const alias = DEVICE_NAME_ALIASES[name.trim().toLowerCase()];
  return alias ?? name;
}

/**
 * Physical layout names a keyboard's firmware used to report, mapped to the
 * name it reports now. Saved keymaps and gallery posts carry the layout name
 * they were made on, so one made on a GoFortyMax Ortho has to count as made
 * for the GoFortyWL Ortho it is.
 */
export const FORMER_LAYOUT_NAMES: Readonly<Record<string, string>> = {
  "GoFortyMax Ortho": "GoFortyWL Ortho",
  "BeThirtyMax QAZ": "BeThirtyWL QAZ",
  "BeThirtyMax Ortho": "BeThirtyWL Ortho",
};

/** A layout name under the keyboard's current name. */
export function currentLayoutName(name: string): string {
  return FORMER_LAYOUT_NAMES[name] ?? name;
}

/** Whether two layout names are the same keyboard, before or after a rename. */
export function sameLayoutName(a: string, b: string): boolean {
  return currentLayoutName(a) === currentLayoutName(b);
}

/**
 * Whether `name` is a keyboard on the roster above (under its old or new
 * name).
 *
 * Not a connection check -- see {@link isSupportedVendorId} for that. Callers
 * use this where a keyboard has to be one of the *known* ones: the gallery's
 * board field, and anything keyed to a specific board's data.
 */
export function isKnownDeviceName(name: string | undefined | null): boolean {
  const key = deviceKeyFor(name);
  return SUPPORTED_DEVICE_NAMES.some((known) => known === key);
}

/**
 * Marketing names of the ZMK boards, for the line under the ZMK/QMK switch on
 * the top page. Separate from the roster above because that one is keyed by
 * firmware identifier and must never be renamed.
 */
export const ZMK_MODELS = [
  "ClickBoard ErgoTrack",
  "GoFortyWL Ortho",
  "BeThirtyWL QAZ",
  "BeThirtyWL Ortho",
];
