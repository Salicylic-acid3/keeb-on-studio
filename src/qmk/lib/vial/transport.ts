/**
 * Raw HID transport for Vial keyboards.
 *
 * Vial speaks VIA's protocol: 32-byte reports in, 32-byte reports out, one
 * reply per request, on the raw HID interface (usage page 0xFF60, usage
 * 0x61). The browser side of that is WebHID. Everything above this file deals
 * in request/reply byte arrays and never touches the device API directly, so
 * the demo keyboard can stand in for a real one by implementing the same
 * interface.
 */

export const VIAL_REPORT_SIZE = 32;

/** Only this workshop's keyboards: the same gate as the ZMK side. */
export const KEEB_ON_VENDOR_ID = 0x355d;
export const RAW_HID_USAGE_PAGE = 0xff60;
export const RAW_HID_USAGE = 0x61;

export interface VialTransport {
  /** Human-readable device name, for the title bar. */
  readonly productName: string;
  /** Send one 32-byte request and wait for the 32-byte reply. */
  exchange(request: Uint8Array): Promise<Uint8Array>;
  close(): Promise<void>;
  /** Called once when the device goes away underneath us. */
  onDisconnect(listener: () => void): void;
}

export class VialTransportError extends Error {}

// Minimal WebHID typings: the DOM lib shipped with TypeScript does not
// include them, and the shapes used here are small.
interface HidInputReportEventLike extends Event {
  reportId: number;
  data: DataView;
}
interface HidDeviceLike {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(
    type: "inputreport",
    listener: (e: HidInputReportEventLike) => void,
  ): void;
  removeEventListener(
    type: "inputreport",
    listener: (e: HidInputReportEventLike) => void,
  ): void;
  collections: Array<{ usagePage: number; usage: number }>;
}
interface HidLike {
  requestDevice(options: {
    filters: Array<{
      vendorId?: number;
      productId?: number;
      usagePage?: number;
      usage?: number;
    }>;
  }): Promise<HidDeviceLike[]>;
  getDevices(): Promise<HidDeviceLike[]>;
  addEventListener(
    type: "disconnect",
    listener: (e: { device: HidDeviceLike }) => void,
  ): void;
  removeEventListener(
    type: "disconnect",
    listener: (e: { device: HidDeviceLike }) => void,
  ): void;
}

function getHid(): HidLike | undefined {
  return (navigator as unknown as { hid?: HidLike }).hid;
}

export function isWebHidAvailable(): boolean {
  return getHid() !== undefined;
}

const RAW_HID_FILTER = {
  vendorId: KEEB_ON_VENDOR_ID,
  usagePage: RAW_HID_USAGE_PAGE,
  usage: RAW_HID_USAGE,
};

/**
 * Open the browser's device picker, filtered to this workshop's raw HID
 * interfaces. Resolves to null when the person closes the picker without
 * choosing, which is not an error.
 */
export async function requestWebHidTransport(): Promise<WebHidTransport | null> {
  const hid = getHid();
  if (!hid)
    throw new VialTransportError("WebHID is not available in this browser");
  const devices = await hid.requestDevice({ filters: [RAW_HID_FILTER] });
  const device = devices.find((d) =>
    d.collections.some(
      (c) => c.usagePage === RAW_HID_USAGE_PAGE && c.usage === RAW_HID_USAGE,
    ),
  );
  if (!device) return null;
  if (!device.opened) await device.open();
  return new WebHidTransport(device, hid);
}

/**
 * Reopen a keyboard the browser already granted, without the picker. Used
 * on return visits so the top page can offer "the keyboard from last time".
 */
export async function reopenGrantedWebHidTransport(): Promise<WebHidTransport | null> {
  const hid = getHid();
  if (!hid) return null;
  const devices = await hid.getDevices();
  const device = devices.find(
    (d) =>
      d.vendorId === KEEB_ON_VENDOR_ID &&
      d.collections.some(
        (c) => c.usagePage === RAW_HID_USAGE_PAGE && c.usage === RAW_HID_USAGE,
      ),
  );
  if (!device) return null;
  if (!device.opened) await device.open();
  return new WebHidTransport(device, hid);
}

export class WebHidTransport implements VialTransport {
  private queue: Promise<unknown> = Promise.resolve();
  private pending: ((reply: Uint8Array) => void) | null = null;
  /** Fails the request in flight; set alongside `pending`. */
  private failPending: ((err: Error) => void) | null = null;
  private disconnectListeners: Array<() => void> = [];
  private readonly onInput = (e: HidInputReportEventLike) => {
    const reply = new Uint8Array(
      e.data.buffer,
      e.data.byteOffset,
      e.data.byteLength,
    );
    const resolve = this.pending;
    this.pending = null;
    this.failPending = null;
    resolve?.(reply.slice(0, VIAL_REPORT_SIZE));
  };
  private readonly onHidDisconnect = (e: { device: HidDeviceLike }) => {
    if (e.device !== this.device) return;
    // A request waiting on a keyboard that has been unplugged fails now,
    // rather than after the reply timeout.
    const fail = this.failPending;
    this.pending = null;
    this.failPending = null;
    fail?.(new VialTransportError("The keyboard was disconnected"));
    this.teardown();
    for (const l of this.disconnectListeners) l();
  };

  private readonly device: HidDeviceLike;
  private readonly hid: HidLike;

  constructor(device: HidDeviceLike, hid: HidLike) {
    this.device = device;
    this.hid = hid;
    device.addEventListener("inputreport", this.onInput);
    hid.addEventListener("disconnect", this.onHidDisconnect);
  }

  get productName() {
    return this.device.productName;
  }

  exchange(request: Uint8Array): Promise<Uint8Array> {
    // One request in flight at a time: VIA replies carry no sequence number,
    // so the only way to pair a reply with its request is to never overlap.
    const run = this.queue.then(() => this.exchangeNow(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private exchangeNow(request: Uint8Array): Promise<Uint8Array> {
    if (request.length !== VIAL_REPORT_SIZE) {
      throw new VialTransportError(`request must be ${VIAL_REPORT_SIZE} bytes`);
    }
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.failPending = null;
        reject(new VialTransportError("The keyboard did not answer in time"));
      }, 2000);
      this.pending = (reply) => {
        clearTimeout(timer);
        resolve(reply);
      };
      this.failPending = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.device.sendReport(0, request as BufferSource).catch((err) => {
        clearTimeout(timer);
        this.pending = null;
        this.failPending = null;
        reject(err);
      });
    });
  }

  onDisconnect(listener: () => void) {
    this.disconnectListeners.push(listener);
  }

  private teardown() {
    this.device.removeEventListener("inputreport", this.onInput);
    this.hid.removeEventListener("disconnect", this.onHidDisconnect);
  }

  async close() {
    this.teardown();
    if (this.device.opened) await this.device.close();
  }
}
