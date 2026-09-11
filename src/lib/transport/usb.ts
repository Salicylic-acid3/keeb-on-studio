/**
 * Connecting over USB, to this workshop's keyboards only.
 *
 * The picker is opened here rather than through the library's `connectSerial()`
 * so that it can be **filtered by vendor id**. The library calls
 * `requestPort()` with no options, which lists every serial device on the
 * machine -- an Arduino, a USB-to-TTL cable, someone else's keyboard -- and
 * leaves the app to connect first and object afterwards. Filtering means a
 * keyboard this app cannot drive is never offered in the first place.
 *
 * Everything else the library's version does is kept, because the rest of the
 * app depends on it: `connectToSerialPort` builds the transport, and
 * `rememberSerialPort` is what lets auto-reconnect know which of several
 * paired ports the user actually chose.
 */
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import {
  connectToSerialPort,
  findRememberedSerialPort,
  getPairedSerialPorts,
  isWebSerialSupported,
  rememberSerialPort,
} from "@cormoran/zmk-studio-react-hook";
import { connect as connectWebUsb } from "./webUsb";
import {
  KEEB_ON_SERIAL_FILTERS,
  isSupportedVendorId,
} from "../supportedDevices";

export function shouldUseWebUsbForUsbConnection(
  userAgent = navigator.userAgent,
) {
  return /\bAndroid\b/i.test(userAgent) && /\bChrome\//i.test(userAgent);
}

export function isUsbConnectionAvailable() {
  return (
    isWebSerialSupported() ||
    (shouldUseWebUsbForUsbConnection() && "usb" in navigator)
  );
}

/**
 * Thrown when a port is not one of this workshop's keyboards.
 *
 * Named so the connect screen can tell it apart from a real failure and show
 * the explanation-and-pointer notice instead of an error.
 */
export class UnsupportedKeyboardError extends Error {
  constructor() {
    super("This keyboard is not one Keeb-On! Studio can configure.");
    this.name = "UnsupportedKeyboardError";
  }
}

/** A serial port, narrowed to the part used here. */
type PortLike = { getInfo?: () => { usbVendorId?: number } | undefined };

/**
 * The vendor id a port reports, or undefined.
 *
 * `getInfo()` is synchronous and cannot fail per the spec, but a port from a
 * polyfill or a test double may not have it -- and a port whose id cannot be
 * read must not be treated as though it had passed.
 */
export function vendorIdOf(port: unknown): number | undefined {
  return (port as PortLike | null)?.getInfo?.()?.usbVendorId;
}

/**
 * Paired ports belonging to one of this workshop's keyboards.
 *
 * Auto-reconnect needs this as well as the filtered picker: permission granted
 * before this rule existed is still on record, so the browser can still hand
 * back a port for a keyboard the app should no longer drive.
 */
export async function getPairedKeebOnPorts() {
  const ports = await getPairedSerialPorts();
  return ports.filter((port) => isSupportedVendorId(vendorIdOf(port)));
}

/** Opens the browser's port picker, showing only this workshop's keyboards. */
export async function connect(): Promise<RpcTransport> {
  if (shouldUseWebUsbForUsbConnection()) {
    return connectWebUsb();
  }

  if (typeof navigator === "undefined" || !("serial" in navigator)) {
    throw new Error("Web Serial API is not available in this browser.");
  }
  const serial = navigator.serial;
  if (!serial) {
    throw new Error("Web Serial API is not available in this browser.");
  }

  const port = await serial.requestPort({ filters: KEEB_ON_SERIAL_FILTERS });

  // The filter is the browser's promise, not ours. Checking again costs
  // nothing and means a browser that ignores `filters` -- or a port arriving
  // by some future route -- still cannot get past here.
  if (!isSupportedVendorId(vendorIdOf(port))) {
    throw new UnsupportedKeyboardError();
  }

  const transport = await connectToSerialPort(port);
  rememberSerialPort(port, await getPairedSerialPorts());
  return transport;
}

/**
 * Reconnects to one of this workshop's already-paired keyboards, without a
 * picker.
 *
 * The library's `connectToPairedSerial()` would do this, but it knows nothing
 * about vendor ids: it reconnects to whichever port it remembers, or failing
 * that the first paired one. Given a list already narrowed to this workshop's
 * keyboards, this picks the remembered one out of it and otherwise takes the
 * first, which is the same rule applied to the right set.
 *
 * Returns null when the list is empty -- "stay disconnected and show the
 * connect screen", not an error.
 */
export async function reconnectToKeebOnPort(
  ports: SerialPort[],
): Promise<RpcTransport | null> {
  if (ports.length === 0) return null;
  const port = findRememberedSerialPort(ports) ?? ports[0];
  return connectToSerialPort(port);
}
