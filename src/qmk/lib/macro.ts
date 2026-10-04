/**
 * Vial dynamic macros: the bytes in the keyboard's macro buffer and the
 * steps the editor shows (the same five kinds as the ZMK side's macros).
 *
 * The buffer holds every macro back to back, each ended by a 0 byte
 * (quantum/dynamic_keymap.c dynamic_keymap_macro_send). Inside a macro,
 * plain bytes are text typed as-is; byte 1 starts an action:
 *   1 1 kc        tap a basic keycode         (SS_TAP_CODE)
 *   1 2 kc / 1 3  press / release a basic one (SS_DOWN_CODE / SS_UP_CODE)
 *   1 4 lo hi     wait (lo-1) + (hi-1)*255 ms (SS_DELAY_CODE)
 *   1 5 kc16      tap / 6 press / 7 release any 16-bit keycode (Vial)
 * No byte inside a macro may be 0, so a 16-bit keycode whose low byte is 0
 * travels as 0xFF00 | high byte, the way the firmware decodes it.
 */

export type MacroStep =
  | { action: "tap" | "down" | "up"; keycode: number }
  | { action: "delay"; ms: number }
  | { action: "string"; text: string };

const PREFIX = 1;
const TAP = 1;
const DOWN = 2;
const UP = 3;
const DELAY = 4;
const EXT: Record<"tap" | "down" | "up", number> = { tap: 5, down: 6, up: 7 };
const BASIC: Record<"tap" | "down" | "up", number> = {
  tap: TAP,
  down: DOWN,
  up: UP,
};
const ACTION_BY_CODE: Record<number, "tap" | "down" | "up"> = {
  1: "tap",
  2: "down",
  3: "up",
  5: "tap",
  6: "down",
  7: "up",
};

export class MacroEncodeError extends Error {}

/** Split the whole buffer into one byte string per macro. */
export function splitMacroBuffer(
  buffer: Uint8Array,
  count: number,
): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < buffer.length && out.length < count; i++) {
    if (buffer[i] === 0) {
      out.push(buffer.slice(start, i));
      start = i + 1;
    }
  }
  while (out.length < count) out.push(new Uint8Array());
  return out;
}

export function decodeMacro(bytes: Uint8Array): MacroStep[] {
  const steps: MacroStep[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b !== PREFIX) {
      let text = "";
      while (i < bytes.length && bytes[i] !== PREFIX)
        text += String.fromCharCode(bytes[i++]);
      steps.push({ action: "string", text });
      continue;
    }
    const code = bytes[i + 1];
    if (code === DELAY) {
      steps.push({
        action: "delay",
        ms: bytes[i + 2] - 1 + (bytes[i + 3] - 1) * 255,
      });
      i += 4;
    } else if (code >= 5 && code <= 7) {
      let kc = bytes[i + 2] | (bytes[i + 3] << 8);
      if (kc > 0xff00) kc = (kc & 0xff) << 8;
      steps.push({ action: ACTION_BY_CODE[code], keycode: kc });
      i += 4;
    } else if (code >= 1 && code <= 3) {
      steps.push({ action: ACTION_BY_CODE[code], keycode: bytes[i + 2] });
      i += 3;
    } else {
      break; // unknown: stop rather than misread the rest
    }
  }
  return steps;
}

/** Characters the firmware can type from a macro string (printable ASCII). */
export function isTypeable(text: string): boolean {
  return /^[\x20-\x7e\n\t]*$/.test(text);
}

export function encodeMacro(steps: MacroStep[]): number[] {
  const out: number[] = [];
  for (const s of steps) {
    if (s.action === "string") {
      if (!isTypeable(s.text))
        throw new MacroEncodeError(
          "Only letters, numbers and symbols on a US keyboard can be typed",
        );
      for (const ch of s.text) out.push(ch.charCodeAt(0));
    } else if (s.action === "delay") {
      const ms = Math.max(0, Math.min(254 * 255 + 254, Math.round(s.ms)));
      out.push(PREFIX, DELAY, (ms % 255) + 1, Math.floor(ms / 255) + 1);
    } else if (s.keycode === 0) {
      continue; // an unset key does nothing
    } else if (s.keycode <= 0xff) {
      out.push(PREFIX, BASIC[s.action], s.keycode);
    } else {
      const v =
        (s.keycode & 0xff) === 0 ? 0xff00 | (s.keycode >> 8) : s.keycode;
      out.push(PREFIX, EXT[s.action], v & 0xff, v >> 8);
    }
  }
  return out;
}

/** All macros into one buffer of `size` bytes (each ended by 0). */
export function packMacroBuffer(
  macros: MacroStep[][],
  size: number,
): Uint8Array {
  const bytes = macros.flatMap((m) => [...encodeMacro(m), 0]);
  if (bytes.length > size)
    throw new MacroEncodeError(
      "The macros do not fit in the keyboard's macro memory",
    );
  const out = new Uint8Array(size);
  out.set(bytes);
  return out;
}

/** Bytes the macros use, separators included. */
export function macroBytesUsed(macros: MacroStep[][]): number {
  return macros.reduce((n, m) => {
    try {
      return n + encodeMacro(m).length + 1;
    } catch {
      return n + 1;
    }
  }, 0);
}
