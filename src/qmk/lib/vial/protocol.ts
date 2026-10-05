/**
 * VIA + Vial protocol client.
 *
 * Request and reply are both 32 bytes. Byte 0 is the VIA command id; Vial's
 * own commands are tunnelled under 0xFE with the Vial command in byte 1.
 * Keeb-On!'s OS-switch commands ride on VIA's keyboard_value get/set with
 * value ids from 0x80 up (see users/salicylic_acid3/keebon_os.c in the
 * firmware fork).
 *
 * Numbers below are from quantum/via.h and quantum/vial.h of that fork, which
 * is pinned at VIA protocol 9 / Vial protocol 6.
 */
import { VIAL_REPORT_SIZE, type VialTransport } from "./transport";

export const SUPPORTED_VIAL_PROTOCOL = 6;
export const SUPPORTED_VIA_PROTOCOL = 9;

// quantum/via.h
const ID_GET_PROTOCOL_VERSION = 0x01;
const ID_GET_KEYBOARD_VALUE = 0x02;
const ID_SET_KEYBOARD_VALUE = 0x03;
const ID_DYNAMIC_KEYMAP_GET_KEYCODE = 0x04;
const ID_DYNAMIC_KEYMAP_SET_KEYCODE = 0x05;
const ID_DYNAMIC_KEYMAP_GET_LAYER_COUNT = 0x11;
const ID_BOOTLOADER_JUMP = 0x0b;
const ID_DYNAMIC_KEYMAP_MACRO_GET_COUNT = 0x0c;
const ID_DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE = 0x0d;
const ID_DYNAMIC_KEYMAP_MACRO_GET_BUFFER = 0x0e;
const ID_DYNAMIC_KEYMAP_MACRO_SET_BUFFER = 0x0f;
const ID_DYNAMIC_KEYMAP_GET_BUFFER = 0x12;
const ID_VIAL_PREFIX = 0xfe;
export const ID_UNHANDLED = 0xff;

const KV_LAYOUT_OPTIONS = 0x02;
const KV_SWITCH_MATRIX_STATE = 0x03;
// users/salicylic_acid3/keebon_os.h
const KV_KEEBON_OS = 0x80;
const KV_KEEBON_OS_PREVIEW = 0x81;

// quantum/vial.h
const VIAL_GET_KEYBOARD_ID = 0x00;
const VIAL_GET_SIZE = 0x01;
const VIAL_GET_DEF = 0x02;
const VIAL_GET_UNLOCK_STATUS = 0x05;
const VIAL_UNLOCK_START = 0x06;
const VIAL_UNLOCK_POLL = 0x07;
const VIAL_LOCK = 0x08;
const VIAL_QMK_SETTINGS_QUERY = 0x09;
const VIAL_QMK_SETTINGS_GET = 0x0a;
const VIAL_QMK_SETTINGS_SET = 0x0b;
const VIAL_DYNAMIC_ENTRY_OP = 0x0d;
const DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES = 0x00;
const DYNAMIC_VIAL_TAP_DANCE_GET = 0x01;
const DYNAMIC_VIAL_TAP_DANCE_SET = 0x02;
const DYNAMIC_VIAL_COMBO_GET = 0x03;
const DYNAMIC_VIAL_COMBO_SET = 0x04;
const DYNAMIC_VIAL_KEY_OVERRIDE_GET = 0x05;
const DYNAMIC_VIAL_KEY_OVERRIDE_SET = 0x06;

/** Largest keymap-buffer slice one report can carry (via.c: size <= 28). */
const KEYMAP_BUFFER_CHUNK = 28;

export class VialProtocolError extends Error {}

export interface VialKeyboardId {
  vialProtocol: number;
  /** 8-byte keyboard UID as lowercase hex. */
  uid: string;
}

export interface VialUnlockStatus {
  unlocked: boolean;
  unlockInProgress: boolean;
  /** Matrix positions to hold for unlocking. */
  unlockKeys: Array<{ row: number; col: number }>;
}

export interface VialDynamicEntryCounts {
  tapDance: number;
  combo: number;
  keyOverride: number;
}

/** quantum/vial.h vial_tap_dance_entry_t (10 bytes, little-endian). */
export interface VialTapDanceEntry {
  onTap: number;
  onHold: number;
  onDoubleTap: number;
  onTapHold: number;
  tappingTerm: number;
}

/** quantum/vial.h vial_combo_entry_t: up to four keycodes in, one out. */
export interface VialComboEntry {
  input: [number, number, number, number];
  output: number;
}

/** quantum/vial.h vial_key_override_entry_t. */
export interface VialKeyOverrideEntry {
  trigger: number;
  replacement: number;
  layers: number;
  triggerMods: number;
  negativeModMask: number;
  suppressedMods: number;
  options: number;
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

export function decodeTapDance(b: Uint8Array): VialTapDanceEntry {
  return {
    onTap: u16(b, 0),
    onHold: u16(b, 2),
    onDoubleTap: u16(b, 4),
    onTapHold: u16(b, 6),
    tappingTerm: u16(b, 8),
  };
}
export function encodeTapDance(e: VialTapDanceEntry): number[] {
  return [
    ...le16(e.onTap),
    ...le16(e.onHold),
    ...le16(e.onDoubleTap),
    ...le16(e.onTapHold),
    ...le16(e.tappingTerm),
  ];
}
export function decodeCombo(b: Uint8Array): VialComboEntry {
  return {
    input: [u16(b, 0), u16(b, 2), u16(b, 4), u16(b, 6)],
    output: u16(b, 8),
  };
}
export function encodeCombo(e: VialComboEntry): number[] {
  return [...e.input.flatMap(le16), ...le16(e.output)];
}
export function decodeKeyOverride(b: Uint8Array): VialKeyOverrideEntry {
  return {
    trigger: u16(b, 0),
    replacement: u16(b, 2),
    layers: u16(b, 4),
    triggerMods: b[6],
    negativeModMask: b[7],
    suppressedMods: b[8],
    options: b[9],
  };
}
export function encodeKeyOverride(e: VialKeyOverrideEntry): number[] {
  return [
    ...le16(e.trigger),
    ...le16(e.replacement),
    ...le16(e.layers),
    e.triggerMods & 0xff,
    e.negativeModMask & 0xff,
    e.suppressedMods & 0xff,
    e.options & 0xff,
  ];
}

/** What the OS-switch module reports; see keebon_os.c. */
export interface KeebOnOsState {
  protocol: number;
  /** QMK os_variant_t: 0 unsure, 1 linux, 2 windows, 3 macos, 4 ios. */
  detectedOs: number;
  /** 0 auto, 1 windows, 2 macos, 3 linux. */
  mode: number;
  activeBlock: number;
  /** Block index per target: windows, macos, linux, other. */
  blocks: [number, number, number, number];
  layersPerBlock: number;
  blockCount: number;
  /** Block being previewed, or null. */
  previewBlock: number | null;
}

function request(...bytes: number[]): Uint8Array {
  const buf = new Uint8Array(VIAL_REPORT_SIZE);
  buf.set(bytes);
  return buf;
}

export class VialClient {
  readonly transport: VialTransport;

  constructor(transport: VialTransport) {
    this.transport = transport;
  }

  private async send(...bytes: number[]): Promise<Uint8Array> {
    return this.transport.exchange(request(...bytes));
  }

  private async sendVial(cmd: number, ...args: number[]): Promise<Uint8Array> {
    return this.send(ID_VIAL_PREFIX, cmd, ...args);
  }

  async getViaProtocolVersion(): Promise<number> {
    const r = await this.send(ID_GET_PROTOCOL_VERSION);
    return (r[1] << 8) | r[2];
  }

  async getKeyboardId(): Promise<VialKeyboardId> {
    const r = await this.sendVial(VIAL_GET_KEYBOARD_ID);
    const vialProtocol = r[0] | (r[1] << 8) | (r[2] << 16) | (r[3] << 24);
    const uid = Array.from(r.slice(4, 12))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { vialProtocol, uid };
  }

  /** The xz-compressed vial.json, exactly as embedded in the firmware. */
  async getDefinitionBytes(): Promise<Uint8Array> {
    const sizeReply = await this.sendVial(VIAL_GET_SIZE);
    const size =
      sizeReply[0] |
      (sizeReply[1] << 8) |
      (sizeReply[2] << 16) |
      (sizeReply[3] << 24);
    if (size === 0 || size > 1 << 20) {
      throw new VialProtocolError(
        `Unexpected keyboard definition size ${size}`,
      );
    }
    const out = new Uint8Array(size);
    const pages = Math.ceil(size / VIAL_REPORT_SIZE);
    for (let page = 0; page < pages; page++) {
      const r = await this.sendVial(
        VIAL_GET_DEF,
        page & 0xff,
        (page >> 8) & 0xff,
      );
      const start = page * VIAL_REPORT_SIZE;
      out.set(r.slice(0, Math.min(VIAL_REPORT_SIZE, size - start)), start);
    }
    return out;
  }

  async getLayerCount(): Promise<number> {
    const r = await this.send(ID_DYNAMIC_KEYMAP_GET_LAYER_COUNT);
    return r[1];
  }

  async getKeycode(layer: number, row: number, col: number): Promise<number> {
    const r = await this.send(ID_DYNAMIC_KEYMAP_GET_KEYCODE, layer, row, col);
    return (r[4] << 8) | r[5];
  }

  async setKeycode(
    layer: number,
    row: number,
    col: number,
    keycode: number,
  ): Promise<void> {
    await this.send(
      ID_DYNAMIC_KEYMAP_SET_KEYCODE,
      layer,
      row,
      col,
      (keycode >> 8) & 0xff,
      keycode & 0xff,
    );
  }

  /**
   * Read the whole keymap in 28-byte slices. Returns keycodes indexed
   * [layer][row][col]; the buffer is big-endian uint16 in that order.
   */
  async getKeymap(
    layers: number,
    rows: number,
    cols: number,
  ): Promise<number[][][]> {
    const total = layers * rows * cols * 2;
    const raw = new Uint8Array(total);
    for (let offset = 0; offset < total; offset += KEYMAP_BUFFER_CHUNK) {
      const size = Math.min(KEYMAP_BUFFER_CHUNK, total - offset);
      const r = await this.send(
        ID_DYNAMIC_KEYMAP_GET_BUFFER,
        (offset >> 8) & 0xff,
        offset & 0xff,
        size,
      );
      raw.set(r.slice(4, 4 + size), offset);
    }
    const keymap: number[][][] = [];
    let i = 0;
    for (let l = 0; l < layers; l++) {
      const layer: number[][] = [];
      for (let r = 0; r < rows; r++) {
        const row: number[] = [];
        for (let c = 0; c < cols; c++) {
          row.push((raw[i] << 8) | raw[i + 1]);
          i += 2;
        }
        layer.push(row);
      }
      keymap.push(layer);
    }
    return keymap;
  }

  async getLayoutOptions(): Promise<number> {
    const r = await this.send(ID_GET_KEYBOARD_VALUE, KV_LAYOUT_OPTIONS);
    return ((r[2] << 24) | (r[3] << 16) | (r[4] << 8) | r[5]) >>> 0;
  }

  async setLayoutOptions(value: number): Promise<void> {
    await this.send(
      ID_SET_KEYBOARD_VALUE,
      KV_LAYOUT_OPTIONS,
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
  }

  async getUnlockStatus(): Promise<VialUnlockStatus> {
    const r = await this.sendVial(VIAL_GET_UNLOCK_STATUS);
    const unlockKeys: Array<{ row: number; col: number }> = [];
    for (let i = 2; i + 1 < VIAL_REPORT_SIZE; i += 2) {
      if (r[i] === 0xff && r[i + 1] === 0xff) break;
      unlockKeys.push({ row: r[i], col: r[i + 1] });
    }
    return { unlocked: r[0] === 1, unlockInProgress: r[1] === 1, unlockKeys };
  }

  async unlockStart(): Promise<void> {
    await this.sendVial(VIAL_UNLOCK_START);
  }

  /** Returns the remaining countdown; 0 once unlocked. */
  async unlockPoll(): Promise<{
    unlocked: boolean;
    inProgress: boolean;
    counter: number;
  }> {
    const r = await this.sendVial(VIAL_UNLOCK_POLL);
    return { unlocked: r[0] === 1, inProgress: r[1] === 1, counter: r[2] };
  }

  async lock(): Promise<void> {
    await this.sendVial(VIAL_LOCK);
  }

  async getDynamicEntryCounts(): Promise<VialDynamicEntryCounts> {
    const r = await this.sendVial(
      VIAL_DYNAMIC_ENTRY_OP,
      DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES,
    );
    return { tapDance: r[0], combo: r[1], keyOverride: r[2] };
  }

  private async getEntry(op: number, index: number): Promise<Uint8Array> {
    const r = await this.sendVial(VIAL_DYNAMIC_ENTRY_OP, op, index);
    if (r[0] !== 0)
      throw new VialProtocolError(`Entry ${index} could not be read`);
    return r.slice(1, 11);
  }

  private async setEntry(
    op: number,
    index: number,
    bytes: number[],
  ): Promise<void> {
    const r = await this.sendVial(VIAL_DYNAMIC_ENTRY_OP, op, index, ...bytes);
    if (r[0] !== 0)
      throw new VialProtocolError(`Entry ${index} could not be written`);
  }

  async getTapDance(index: number): Promise<VialTapDanceEntry> {
    return decodeTapDance(
      await this.getEntry(DYNAMIC_VIAL_TAP_DANCE_GET, index),
    );
  }
  async setTapDance(index: number, entry: VialTapDanceEntry): Promise<void> {
    await this.setEntry(
      DYNAMIC_VIAL_TAP_DANCE_SET,
      index,
      encodeTapDance(entry),
    );
  }
  async getCombo(index: number): Promise<VialComboEntry> {
    return decodeCombo(await this.getEntry(DYNAMIC_VIAL_COMBO_GET, index));
  }
  async setCombo(index: number, entry: VialComboEntry): Promise<void> {
    await this.setEntry(DYNAMIC_VIAL_COMBO_SET, index, encodeCombo(entry));
  }
  async getKeyOverride(index: number): Promise<VialKeyOverrideEntry> {
    return decodeKeyOverride(
      await this.getEntry(DYNAMIC_VIAL_KEY_OVERRIDE_GET, index),
    );
  }
  async setKeyOverride(
    index: number,
    entry: VialKeyOverrideEntry,
  ): Promise<void> {
    await this.setEntry(
      DYNAMIC_VIAL_KEY_OVERRIDE_SET,
      index,
      encodeKeyOverride(entry),
    );
  }

  /**
   * The QMK Settings ids this firmware has (quantum/qmk_settings.c). The
   * firmware lists ids greater than the one asked for, 2 bytes each, until
   * an 0xFFFF; an empty list means no QMK Settings at all.
   */
  async listQmkSettings(): Promise<number[]> {
    const ids: number[] = [];
    let after = 0;
    for (let guard = 0; guard < 64; guard++) {
      const r = await this.sendVial(
        VIAL_QMK_SETTINGS_QUERY,
        after & 0xff,
        (after >> 8) & 0xff,
      );
      let added = false;
      for (let i = 0; i + 1 < VIAL_REPORT_SIZE; i += 2) {
        const id = u16(r, i);
        if (id === 0xffff) break;
        if (id > after) {
          ids.push(id);
          after = id;
          added = true;
        }
      }
      if (!added) break;
    }
    return ids;
  }

  /** A setting's value; `width` bytes, little-endian. */
  async getQmkSetting(qsid: number, width: number): Promise<number> {
    const r = await this.sendVial(
      VIAL_QMK_SETTINGS_GET,
      qsid & 0xff,
      (qsid >> 8) & 0xff,
    );
    if (r[0] !== 0)
      throw new VialProtocolError(`QMK setting ${qsid} could not be read`);
    let v = 0;
    for (let i = 0; i < width; i++) v += r[1 + i] * 2 ** (8 * i);
    return v;
  }

  async setQmkSetting(
    qsid: number,
    width: number,
    value: number,
  ): Promise<void> {
    const bytes = Array.from(
      { length: width },
      (_, i) => Math.floor(value / 2 ** (8 * i)) & 0xff,
    );
    const r = await this.sendVial(
      VIAL_QMK_SETTINGS_SET,
      qsid & 0xff,
      (qsid >> 8) & 0xff,
      ...bytes,
    );
    if (r[0] !== 0)
      throw new VialProtocolError(`QMK setting ${qsid} could not be written`);
  }

  async getMacroCount(): Promise<number> {
    return (await this.send(ID_DYNAMIC_KEYMAP_MACRO_GET_COUNT))[1];
  }

  async getMacroBufferSize(): Promise<number> {
    const r = await this.send(ID_DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE);
    return (r[1] << 8) | r[2];
  }

  async getMacroBuffer(size: number): Promise<Uint8Array> {
    const out = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += KEYMAP_BUFFER_CHUNK) {
      const n = Math.min(KEYMAP_BUFFER_CHUNK, size - offset);
      const r = await this.send(
        ID_DYNAMIC_KEYMAP_MACRO_GET_BUFFER,
        offset >> 8,
        offset & 0xff,
        n,
      );
      out.set(r.slice(4, 4 + n), offset);
    }
    return out;
  }

  /**
   * Write the whole macro buffer. Vial refuses this while the keyboard is
   * locked (via.c), so callers unlock first. The last byte goes last: the
   * firmware will not play macros while it is not 0, which keeps a write cut
   * short from playing half-written bytes.
   */
  async setMacroBuffer(buffer: Uint8Array): Promise<void> {
    const size = buffer.length;
    const chunks: Array<[number, number]> = [];
    for (let offset = 0; offset < size; offset += KEYMAP_BUFFER_CHUNK) {
      chunks.push([offset, Math.min(KEYMAP_BUFFER_CHUNK, size - offset)]);
    }
    for (const [offset, n] of chunks) {
      await this.send(
        ID_DYNAMIC_KEYMAP_MACRO_SET_BUFFER,
        offset >> 8,
        offset & 0xff,
        n,
        ...buffer.slice(offset, offset + n),
      );
    }
  }

  /**
   * Which switches are down right now, as "row,col" (via.c
   * id_switch_matrix_state). Vial answers only while unlocked -- it would
   * otherwise be a keylogger -- and only for matrices whose state fits one
   * report. Each row is ceil(cols/8) bytes, most significant first.
   */
  async getSwitchMatrix(rows: number, cols: number): Promise<Set<string>> {
    const r = await this.send(ID_GET_KEYBOARD_VALUE, KV_SWITCH_MATRIX_STATE);
    const bytesPerRow = Math.ceil(cols / 8);
    const pressed = new Set<string>();
    if (bytesPerRow * rows > VIAL_REPORT_SIZE - 2) return pressed;
    for (let row = 0; row < rows; row++) {
      let value = 0;
      for (let b = 0; b < bytesPerRow; b++)
        value = value * 256 + r[2 + row * bytesPerRow + b];
      for (let col = 0; col < cols; col++) {
        if (Math.floor(value / 2 ** col) % 2 === 1)
          pressed.add(`${row},${col}`);
      }
    }
    return pressed;
  }

  /**
   * Restart into the bootloader (via.c id_bootloader_jump). Vial takes this
   * only while unlocked. The keyboard answers and then leaves the bus, so a
   * missing answer is expected rather than an error.
   */
  async bootloaderJump(): Promise<void> {
    try {
      await this.send(ID_BOOTLOADER_JUMP);
    } catch {
      // gone already
    }
  }

  /** Null when the firmware has no OS-switch module. */
  async getKeebOnOs(): Promise<KeebOnOsState | null> {
    const r = await this.send(ID_GET_KEYBOARD_VALUE, KV_KEEBON_OS);
    if (r[0] === ID_UNHANDLED) return null;
    const a = r.slice(2);
    return {
      protocol: a[0],
      detectedOs: a[1],
      mode: a[2],
      activeBlock: a[3],
      blocks: [a[4], a[5], a[6], a[7]],
      layersPerBlock: a[8],
      blockCount: a[9],
      previewBlock: a[10] === 0xff ? null : a[10],
    };
  }

  async setKeebOnOs(
    mode: number,
    blocks: [number, number, number, number],
  ): Promise<void> {
    await this.send(ID_SET_KEYBOARD_VALUE, KV_KEEBON_OS, mode, ...blocks);
  }

  async setKeebOnOsPreview(block: number | null): Promise<void> {
    await this.send(
      ID_SET_KEYBOARD_VALUE,
      KV_KEEBON_OS_PREVIEW,
      block === null ? 0xff : block,
    );
  }
}
