/**
 * A pretend Vial keyboard that answers the same 32-byte requests as the
 * firmware. Demo mode runs the real protocol client against it, so the demo
 * is no looser and no stricter than a keyboard: what the demo accepts, the
 * firmware accepts, and vice versa.
 *
 * Also the keyboard the protocol tests talk to.
 */
import { VIAL_REPORT_SIZE, type VialTransport } from "./transport";
import { ID_UNHANDLED } from "./protocol";
import { parseKeycode, KC_NO } from "../keycodes/qmkKeycode";

export interface DemoKeyboardOptions {
  productName: string;
  /** xz-compressed vial.json bytes, as the firmware embeds them. */
  definition: Uint8Array;
  rows: number;
  cols: number;
  /** Keycode names [layer][row][col]; layer count is this array's length. */
  keymap: string[][][];
  /** Omit to simulate firmware without the OS-switch module. */
  keebOnOs?: { layersPerBlock: number; blockCount: number; detectedOs: number };
  unlockKeys?: Array<{ row: number; col: number }>;
  dynamicEntries?: { tapDance: number; combo: number; keyOverride: number };
}

export class DemoTransport implements VialTransport {
  readonly productName: string;
  private readonly definition: Uint8Array;
  private readonly rows: number;
  private readonly cols: number;
  private readonly layers: number;
  private readonly keymap: Uint8Array;
  private layoutOptions = 0;
  private unlocked = false;
  private unlockInProgress = false;
  private unlockCounter = 0;
  private readonly unlockKeys: Array<{ row: number; col: number }>;
  private readonly dynamicEntries: {
    tapDance: number;
    combo: number;
    keyOverride: number;
  };
  private readonly os: {
    layersPerBlock: number;
    blockCount: number;
    detectedOs: number;
    mode: number;
    blocks: number[];
    preview: number | null;
  } | null;
  /** 10-byte dynamic entries: tap dance, combo, key override. */
  private readonly entries: Uint8Array[][];
  /** QMK Settings, as qsid -> little-endian bytes (qmk_settings_reset()). */
  private readonly qmkSettings = new Map<number, Uint8Array>([
    [1, new Uint8Array([0])],
    [2, new Uint8Array([50, 0])],
    [3, new Uint8Array([0])],
    [4, new Uint8Array([175, 0])],
    [5, new Uint8Array([5])],
    [6, new Uint8Array([0x88, 0x13])],
    [7, new Uint8Array([200, 0])],
    [8, new Uint8Array([0])],
    // Mouse keys (MOUSEKEY_* defaults)
    [9, new Uint8Array([10, 0])],
    [10, new Uint8Array([16, 0])],
    [11, new Uint8Array([8, 0])],
    [12, new Uint8Array([10, 0])],
    [13, new Uint8Array([30, 0])],
    [14, new Uint8Array([10, 0])],
    [15, new Uint8Array([80, 0])],
    [16, new Uint8Array([8, 0])],
    [17, new Uint8Array([40, 0])],
    [18, new Uint8Array([0, 0])],
    [19, new Uint8Array([80, 0])],
    [20, new Uint8Array([5])],
    [21, new Uint8Array([0, 0, 0, 0])],
  ]);
  /** Macro buffer (DYNAMIC_KEYMAP_MACRO_COUNT macros, each 0-ended). */
  private readonly macroCount = 16;
  private readonly macroBuffer = new Uint8Array(1024);
  private disconnectListeners: Array<() => void> = [];
  /** Every request seen, for tests. */
  readonly log: Uint8Array[] = [];

  constructor(options: DemoKeyboardOptions) {
    this.productName = options.productName;
    this.definition = options.definition;
    this.rows = options.rows;
    this.cols = options.cols;
    this.layers = options.keymap.length;
    this.keymap = new Uint8Array(this.layers * this.rows * this.cols * 2);
    options.keymap.forEach((layer, l) =>
      layer.forEach((row, r) =>
        row.forEach((name, c) => {
          const code = parseKeycode(name);
          if (code === undefined)
            throw new Error(`Demo keymap: unknown keycode ${name}`);
          this.writeKeycode(l, r, c, code);
        }),
      ),
    );
    this.unlockKeys = options.unlockKeys ?? [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    this.dynamicEntries = options.dynamicEntries ?? {
      tapDance: 0,
      combo: 0,
      keyOverride: 0,
    };
    // Firmware defaults (dynamic_keymap.c): empty entries, tap dance term 200.
    const td = () => new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 200, 0]);
    this.entries = [
      Array.from({ length: this.dynamicEntries.tapDance }, td),
      Array.from(
        { length: this.dynamicEntries.combo },
        () => new Uint8Array(10),
      ),
      Array.from(
        { length: this.dynamicEntries.keyOverride },
        () => new Uint8Array(10),
      ),
    ];
    this.os = options.keebOnOs
      ? { ...options.keebOnOs, mode: 0, blocks: [0, 1, 2, 0], preview: null }
      : null;
  }

  private offset(layer: number, row: number, col: number) {
    return ((layer * this.rows + row) * this.cols + col) * 2;
  }

  readKeycode(layer: number, row: number, col: number): number {
    if (layer >= this.layers || row >= this.rows || col >= this.cols)
      return KC_NO;
    const o = this.offset(layer, row, col);
    return (this.keymap[o] << 8) | this.keymap[o + 1];
  }

  private writeKeycode(layer: number, row: number, col: number, code: number) {
    if (layer >= this.layers || row >= this.rows || col >= this.cols) return;
    const o = this.offset(layer, row, col);
    this.keymap[o] = (code >> 8) & 0xff;
    this.keymap[o + 1] = code & 0xff;
  }

  /** The block the pretend firmware would make active, mirroring keebon_os.c. */
  get activeBlock(): number {
    if (!this.os) return 0;
    if (this.os.preview !== null) return this.os.preview;
    if (this.os.mode > 0) return this.os.blocks[this.os.mode - 1];
    const target = { 2: 0, 3: 1, 4: 1, 1: 2 }[this.os.detectedOs] ?? 3;
    return this.os.blocks[target];
  }

  async exchange(request: Uint8Array): Promise<Uint8Array> {
    this.log.push(request.slice());
    const r = new Uint8Array(VIAL_REPORT_SIZE);
    r.set(request);
    const cmd = request[0];
    const d = request;
    switch (cmd) {
      case 0x01: // protocol version
        r[1] = 0x00;
        r[2] = 0x09;
        break;
      case 0x02: // get keyboard value
        if (d[1] === 0x02) {
          r[2] = (this.layoutOptions >>> 24) & 0xff;
          r[3] = (this.layoutOptions >>> 16) & 0xff;
          r[4] = (this.layoutOptions >>> 8) & 0xff;
          r[5] = this.layoutOptions & 0xff;
        } else if (d[1] === 0x80 && this.os) {
          r.set(
            [
              1,
              this.os.detectedOs,
              this.os.mode,
              this.activeBlock,
              ...this.os.blocks,
              this.os.layersPerBlock,
              this.os.blockCount,
              this.os.preview ?? 0xff,
            ],
            2,
          );
        } else {
          r[0] = ID_UNHANDLED;
        }
        break;
      case 0x03: // set keyboard value
        if (d[1] === 0x02) {
          this.layoutOptions =
            ((d[2] << 24) | (d[3] << 16) | (d[4] << 8) | d[5]) >>> 0;
        } else if (d[1] === 0x80 && this.os) {
          this.os.mode = d[2] & 3;
          this.os.blocks = [d[3], d[4], d[5], d[6]].map((b) =>
            b < this.os!.blockCount ? b : 0,
          );
        } else if (d[1] === 0x81 && this.os) {
          this.os.preview = d[2] === 0xff ? null : d[2] % this.os.blockCount;
        } else {
          r[0] = ID_UNHANDLED;
        }
        break;
      case 0x04: // get keycode
        {
          const code = this.readKeycode(d[1], d[2], d[3]);
          r[4] = code >> 8;
          r[5] = code & 0xff;
        }
        break;
      case 0x05: // set keycode
        this.writeKeycode(d[1], d[2], d[3], (d[4] << 8) | d[5]);
        break;
      case 0x0c: // macro count
        r[1] = this.macroCount;
        break;
      case 0x0d: // macro buffer size
        r[1] = this.macroBuffer.length >> 8;
        r[2] = this.macroBuffer.length & 0xff;
        break;
      case 0x0e: {
        const offset = (d[1] << 8) | d[2];
        const size = d[3];
        if (size <= 28) {
          for (let i = 0; i < size; i++)
            r[4 + i] = this.macroBuffer[offset + i] ?? 0;
        }
        break;
      }
      case 0x0f: {
        // Refused while locked, as via.c does (goto skip: the reply is the
        // request echoed back, and nothing is written).
        if (!this.unlocked) break;
        const offset = (d[1] << 8) | d[2];
        const size = d[3];
        if (size <= 28) {
          for (let i = 0; i < size; i++) {
            if (offset + i < this.macroBuffer.length)
              this.macroBuffer[offset + i] = d[4 + i];
          }
        }
        break;
      }
      case 0x11: // layer count
        r[1] = this.layers;
        break;
      case 0x12: {
        // get keymap buffer
        const offset = (d[1] << 8) | d[2];
        const size = d[3];
        if (size <= 28) {
          for (let i = 0; i < size; i++) {
            r[4 + i] =
              offset + i < this.keymap.length ? this.keymap[offset + i] : 0;
          }
        }
        break;
      }
      case 0x13: {
        // set keymap buffer
        const offset = (d[1] << 8) | d[2];
        const size = d[3];
        if (size <= 28) {
          for (let i = 0; i < size; i++) {
            if (offset + i < this.keymap.length)
              this.keymap[offset + i] = d[4 + i];
          }
        }
        break;
      }
      case 0xfe: // Vial
        r.fill(0);
        this.vial(d, r);
        break;
      default:
        r[0] = ID_UNHANDLED;
    }
    return r;
  }

  private vial(d: Uint8Array, r: Uint8Array) {
    switch (d[1]) {
      case 0x00: // keyboard id
        r[0] = 6;
        r.set([0x23, 0x75, 0x96, 0x3e, 0x65, 0x9e, 0xb7, 0x43], 4);
        break;
      case 0x01: {
        const sz = this.definition.length;
        r[0] = sz & 0xff;
        r[1] = (sz >> 8) & 0xff;
        r[2] = (sz >> 16) & 0xff;
        r[3] = (sz >> 24) & 0xff;
        break;
      }
      case 0x02: {
        const page = d[2] | (d[3] << 8);
        const start = page * VIAL_REPORT_SIZE;
        if (start < this.definition.length) {
          r.set(this.definition.slice(start, start + VIAL_REPORT_SIZE));
        }
        break;
      }
      case 0x05: // unlock status
        r.fill(0xff);
        r[0] = this.unlocked ? 1 : 0;
        r[1] = this.unlockInProgress ? 1 : 0;
        this.unlockKeys.forEach((k, i) => {
          r[2 + i * 2] = k.row;
          r[3 + i * 2] = k.col;
        });
        break;
      case 0x06: // unlock start
        this.unlockInProgress = true;
        this.unlockCounter = 3;
        break;
      case 0x07: // unlock poll: the demo "holds the keys" for you
        if (this.unlockInProgress) {
          this.unlockCounter--;
          if (this.unlockCounter <= 0) {
            this.unlockInProgress = false;
            this.unlocked = true;
          }
        }
        r[0] = this.unlocked ? 1 : 0;
        r[1] = this.unlockInProgress ? 1 : 0;
        r[2] = this.unlockCounter;
        break;
      case 0x08:
        this.unlocked = false;
        break;
      case 0x09: {
        // QMK Settings query: ids greater than the one asked for.
        r.fill(0xff);
        const after = d[2] | (d[3] << 8);
        [...this.qmkSettings.keys()]
          .filter((id) => id > after)
          .slice(0, 16)
          .forEach((id, i) => {
            r[i * 2] = id & 0xff;
            r[i * 2 + 1] = id >> 8;
          });
        break;
      }
      case 0x0a: {
        const v = this.qmkSettings.get(d[2] | (d[3] << 8));
        r[0] = v ? 0 : 1;
        if (v) r.set(v, 1);
        break;
      }
      case 0x0b: {
        const qsid = d[2] | (d[3] << 8);
        const v = this.qmkSettings.get(qsid);
        r[0] = v ? 0 : 1;
        if (v) this.qmkSettings.set(qsid, d.slice(4, 4 + v.length));
        break;
      }
      case 0x0d: {
        if (d[2] === 0x00) {
          r[0] = this.dynamicEntries.tapDance;
          r[1] = this.dynamicEntries.combo;
          r[2] = this.dynamicEntries.keyOverride;
          break;
        }
        // 1/2 tap dance, 3/4 combo, 5/6 key override: odd get, even set.
        const kind = Math.floor((d[2] - 1) / 2);
        const list = this.entries[kind];
        const index = d[3];
        if (!list || index >= list.length) {
          r[0] = 1;
          break;
        }
        if (d[2] % 2 === 1) {
          r[0] = 0;
          r.set(list[index], 1);
        } else {
          list[index] = d.slice(4, 14);
          r[0] = 0;
        }
        break;
      }
      default:
        break;
    }
  }

  onDisconnect(listener: () => void) {
    this.disconnectListeners.push(listener);
  }

  async close() {
    for (const l of this.disconnectListeners) l();
  }
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
