/**
 * The picker is opened here rather than in the library so it can be filtered
 * by vendor id, and the things worth testing are the ones that would fail
 * quietly: a missing filter (the picker silently widens back to every serial
 * device on the machine), and a port getting past the vendor check anyway
 * (auto-reconnect walking into a keyboard granted before the rule existed).
 */
import {
  connectToSerialPort,
  findRememberedSerialPort,
  getPairedSerialPorts,
  rememberSerialPort,
} from "@cormoran/zmk-studio-react-hook";
import { connect as connectWebUsb } from "../webUsb";
import {
  connect,
  getPairedKeebOnPorts,
  isUsbConnectionAvailable,
  reconnectToKeebOnPort,
  shouldUseWebUsbForUsbConnection,
  UnsupportedKeyboardError,
  vendorIdOf,
} from "../usb";
import { KEEB_ON_USB_VENDOR_ID } from "../../supportedDevices";

jest.mock("@cormoran/zmk-studio-react-hook", () => ({
  connectToSerialPort: jest.fn(async () => ({ transport: true })),
  findRememberedSerialPort: jest.fn(() => null),
  getPairedSerialPorts: jest.fn(async () => []),
  isWebSerialSupported: jest.fn(() => "serial" in navigator),
  rememberSerialPort: jest.fn(),
}));

jest.mock("../webUsb", () => ({
  connect: jest.fn(),
}));

type NavigatorWithOptionalTransport = Navigator & {
  serial?: unknown;
  usb?: unknown;
};

const androidChromeUserAgent =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const desktopChromeUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** A stand-in for a serial port reporting `vendorId`. */
function port(vendorId?: number) {
  return { getInfo: () => ({ usbVendorId: vendorId }) };
}

/** Installs a `navigator.serial` whose picker hands back `picked`. */
function withSerial(picked: unknown) {
  const requestPort = jest.fn(async () => picked);
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: { requestPort, getPorts: jest.fn(async () => []) },
  });
  return requestPort;
}

describe("USB transport selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (navigator as NavigatorWithOptionalTransport).serial;
    delete (navigator as NavigatorWithOptionalTransport).usb;
  });

  test("uses WebUSB for Android Chrome", async () => {
    await connectWithUserAgent(androidChromeUserAgent);

    expect(connectWebUsb).toHaveBeenCalledTimes(1);
    expect(connectToSerialPort).not.toHaveBeenCalled();
  });

  test("uses Web Serial for non-Android Chrome", async () => {
    withSerial(port(KEEB_ON_USB_VENDOR_ID));

    await connectWithUserAgent(desktopChromeUserAgent);

    expect(connectToSerialPort).toHaveBeenCalledTimes(1);
    expect(connectWebUsb).not.toHaveBeenCalled();
  });

  test("detects Android Chrome user agents", () => {
    expect(shouldUseWebUsbForUsbConnection(androidChromeUserAgent)).toBe(true);
    expect(shouldUseWebUsbForUsbConnection(desktopChromeUserAgent)).toBe(false);
  });

  test("treats Web Serial support as USB-capable", () => {
    withSerial(port(KEEB_ON_USB_VENDOR_ID));

    expect(isUsbConnectionAvailable()).toBe(true);
  });

  test("treats Android Chrome WebUSB as USB-capable without Web Serial", () => {
    const userAgentSpy = jest
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(androidChromeUserAgent);
    Object.defineProperty(navigator, "usb", {
      configurable: true,
      value: { requestDevice: jest.fn() },
    });

    expect(isUsbConnectionAvailable()).toBe(true);

    userAgentSpy.mockRestore();
  });
});

describe("keeping the picker to this workshop's keyboards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (navigator as NavigatorWithOptionalTransport).serial;
  });

  test("asks the browser for this vendor id only", async () => {
    // Without the filter the picker lists every serial device on the machine —
    // an Arduino, a USB-to-TTL cable, someone else's keyboard — and the app is
    // left to connect first and object afterwards.
    const requestPort = withSerial(port(KEEB_ON_USB_VENDOR_ID));

    await connectWithUserAgent(desktopChromeUserAgent);

    expect(requestPort).toHaveBeenCalledWith({
      filters: [{ usbVendorId: KEEB_ON_USB_VENDOR_ID }],
    });
  });

  test("remembers the port it connected to", async () => {
    // This is what lets auto-reconnect pick the right one of several paired
    // keyboards next time.
    const picked = port(KEEB_ON_USB_VENDOR_ID);
    withSerial(picked);

    await connectWithUserAgent(desktopChromeUserAgent);

    expect(rememberSerialPort).toHaveBeenCalledWith(picked, []);
  });

  test("refuses a port the filter should never have offered", async () => {
    // The filter is the browser's promise, not ours.
    withSerial(port(0x1d50));

    await expect(connectWithUserAgent(desktopChromeUserAgent)).rejects.toThrow(
      UnsupportedKeyboardError,
    );
    expect(connectToSerialPort).not.toHaveBeenCalled();
  });

  test("refuses a port that reports no vendor id at all", async () => {
    withSerial({ getInfo: () => ({}) });

    await expect(connectWithUserAgent(desktopChromeUserAgent)).rejects.toThrow(
      UnsupportedKeyboardError,
    );
  });

  test("reads a vendor id, and survives a port that cannot give one", () => {
    expect(vendorIdOf(port(0x355d))).toBe(0x355d);
    expect(vendorIdOf({})).toBeUndefined();
    expect(vendorIdOf(null)).toBeUndefined();
  });
});

describe("reconnecting without a picker", () => {
  beforeEach(() => jest.clearAllMocks());

  test("only offers paired ports from this workshop", async () => {
    // Permission granted before this rule existed is still on record, so the
    // browser will happily hand back a keyboard the picker would now hide.
    const ours = port(KEEB_ON_USB_VENDOR_ID);
    (getPairedSerialPorts as jest.Mock).mockResolvedValueOnce([
      port(0x1d50),
      ours,
      port(undefined),
    ]);

    expect(await getPairedKeebOnPorts()).toEqual([ours]);
  });

  test("prefers the port the user last chose", async () => {
    const first = port(KEEB_ON_USB_VENDOR_ID);
    const remembered = port(KEEB_ON_USB_VENDOR_ID);
    (findRememberedSerialPort as jest.Mock).mockReturnValueOnce(remembered);

    await reconnectToKeebOnPort([first, remembered] as never);

    expect(connectToSerialPort).toHaveBeenCalledWith(remembered);
  });

  test("falls back to the first when none is remembered", async () => {
    const first = port(KEEB_ON_USB_VENDOR_ID);
    (findRememberedSerialPort as jest.Mock).mockReturnValueOnce(null);

    await reconnectToKeebOnPort([first] as never);

    expect(connectToSerialPort).toHaveBeenCalledWith(first);
  });

  test("stays disconnected when nothing is paired", async () => {
    // Null, not an error: "show the connect screen" rather than "something
    // went wrong".
    expect(await reconnectToKeebOnPort([])).toBeNull();
    expect(connectToSerialPort).not.toHaveBeenCalled();
  });
});

async function connectWithUserAgent(userAgent: string) {
  const userAgentSpy = jest
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue(userAgent);

  try {
    return await connect();
  } finally {
    userAgentSpy.mockRestore();
  }
}
