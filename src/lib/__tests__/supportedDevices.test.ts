/**
 * Two rules that used to be one, and are worth keeping apart.
 *
 * The **vendor id** decides whether a keyboard may connect at all. It is a
 * single number so that a keyboard designed next month works without this app
 * being told about it — which is the whole reason the rule moved off the name.
 *
 * The **name roster** decides nothing about connecting. It is what the parts
 * that genuinely are per-keyboard key off: firmware downloads, the gallery's
 * board field. A keyboard missing from it still connects and edits.
 */
import {
  KEEB_ON_USB_VENDOR_ID,
  KEEB_ON_SERIAL_FILTERS,
  KEEB_ON_WEBUSB_FILTERS,
  SUPPORTED_DEVICE_NAMES,
  isKnownDeviceName,
  isSupportedVendorId,
} from "../supportedDevices";

describe("the vendor id that decides who may connect", () => {
  it("is the one the firmware is built with", () => {
    // Set in every shield's Kconfig.defconfig. If this test fails, the app and
    // the firmware have drifted apart and no keyboard will appear in the
    // browser's picker at all.
    expect(KEEB_ON_USB_VENDOR_ID).toBe(0x355d);
    expect(isSupportedVendorId(0x355d)).toBe(true);
  });

  it("refuses ZMK's default vendor id", () => {
    // 0x1D50/0x615E is shared by every stock ZMK keyboard, which is exactly
    // why the firmware was given an id of its own.
    expect(isSupportedVendorId(0x1d50)).toBe(false);
  });

  it("refuses a device that reports no vendor id", () => {
    // A plain serial adapter. Treating "unknown" as allowed would let the app
    // start speaking the Studio protocol to whatever is on the other end.
    expect(isSupportedVendorId(undefined)).toBe(false);
    expect(isSupportedVendorId(null)).toBe(false);
  });

  it("offers the browser pickers the same id, in each one's shape", () => {
    // Web Serial spells it usbVendorId, WebUSB spells it vendorId. Getting
    // either wrong silently widens the picker back to every device.
    expect(KEEB_ON_SERIAL_FILTERS).toEqual([{ usbVendorId: 0x355d }]);
    expect(KEEB_ON_WEBUSB_FILTERS).toEqual([{ vendorId: 0x355d }]);
  });
});

describe("the roster of keyboards known by name", () => {
  it("holds the names the firmware actually reports", () => {
    expect(isKnownDeviceName("ergotrack")).toBe(true);
    expect(isKnownDeviceName("goforty-max")).toBe(true);
    expect([...SUPPORTED_DEVICE_NAMES]).toEqual(["ergotrack", "goforty-max"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isKnownDeviceName("ErgoTrack")).toBe(true);
    expect(isKnownDeviceName("  GOFORTY-MAX  ")).toBe(true);
  });

  it("does not accept a name that merely contains one", () => {
    // Substring matching would let "not-ergotrack" claim a gallery board.
    expect(isKnownDeviceName("not-ergotrack")).toBe(false);
    expect(isKnownDeviceName("ergotrack-clone")).toBe(false);
  });

  it("says no to a keyboard it has never heard of", () => {
    // Which is not the same as refusing it: this gates gallery posts and
    // firmware downloads, not the connection.
    expect(isKnownDeviceName("corne")).toBe(false);
    expect(isKnownDeviceName(undefined)).toBe(false);
    expect(isKnownDeviceName("")).toBe(false);
  });
});
