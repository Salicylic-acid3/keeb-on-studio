/**
 * QMK keymaps kept in "My keymaps", shared as links and posted to the
 * gallery: the same three doors as the ZMK side (lib/savedKeymaps), with one
 * validator behind all of them -- and the Worker uses it too, so a post
 * cannot carry anything a file could not.
 *
 * The keymap itself is a Vial .vil document (lib/vil.ts), so one exported
 * from here opens in Vial. Around it sit the name, description and keyboard:
 *
 *   { "format": "keeb-on-studio/qmk-keymap", "formatVersion": 1,
 *     "name", "description", "board", "fromDemo"?, "vil": { ...Vial .vil... } }
 *
 * A bare .vil (what Vial saves) is accepted too, named after the file.
 */
import { QMK_FIRMWARE } from "../../lib/firmwareDownloads";

export const QMK_KEYMAP_FORMAT = "keeb-on-studio/qmk-keymap";
const FORMAT_VERSION = 1;

/** A file someone opened; the gallery's own cap is far lower (MAX_POST_BYTES). */
export const MAX_QMK_FILE_BYTES = 1024 * 1024;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1000;
const MAX_LAYERS = 32;
const MAX_ROWS = 32;
const MAX_COLS = 32;
const MAX_ENTRIES = 256;

export interface QmkKeymapPayload {
  name: string;
  description: string;
  /** The keyboard folder / vial.json name, e.g. goforty_jp. */
  board: string;
  fromDemo?: boolean;
  /**
   * The Vial keyboard uid, as decimal digits. Kept beside `vil` rather than
   * in it: it is a 64-bit number, which JSON.parse would round.
   */
  uid?: string;
  /** A Vial .vil document (its own "uid" set to 0; see `uid`). */
  vil: Record<string, unknown>;
}

/** The .vil text, with the uid's digits put back exactly. */
export function vilText(keymap: Pick<QmkKeymapPayload, "vil" | "uid">): string {
  const text = JSON.stringify({ ...keymap.vil, uid: 0 });
  return keymap.uid ? text.replace('"uid":0', `"uid":${keymap.uid}`) : text;
}

const uidDigits = (text: string) => /"uid"\s*:\s*(\d{1,20})/.exec(text)?.[1];

export type QmkParseFailure =
  | { reason: "too-large" }
  | { reason: "not-json" }
  | { reason: "not-a-keymap" }
  | { reason: "unsupported-board" };

export type QmkParseResult =
  | { ok: true; keymap: QmkKeymapPayload }
  | ({ ok: false } & QmkParseFailure);

const KNOWN_BOARDS = new Set(QMK_FIRMWARE.map((f) => f.asset));

export function isKnownQmkBoard(board: unknown): board is string {
  return typeof board === "string" && KNOWN_BOARDS.has(board);
}

export function qmkBoardName(board: string): string {
  return QMK_FIRMWARE.find((f) => f.asset === board)?.name ?? board;
}

const isKeycode = (v: unknown) =>
  (typeof v === "string" && v.length <= 64) ||
  (typeof v === "number" && Number.isInteger(v));

/** Shape and size checks on a .vil document; nothing in it is trusted. */
export function vilLooksValid(vil: unknown): vil is Record<string, unknown> {
  if (!vil || typeof vil !== "object" || Array.isArray(vil)) return false;
  const v = vil as Record<string, unknown>;
  const layout = v.layout;
  if (
    !Array.isArray(layout) ||
    layout.length === 0 ||
    layout.length > MAX_LAYERS
  )
    return false;
  for (const layer of layout) {
    if (!Array.isArray(layer) || layer.length > MAX_ROWS) return false;
    for (const row of layer) {
      if (!Array.isArray(row) || row.length > MAX_COLS || !row.every(isKeycode))
        return false;
    }
  }
  for (const key of ["macro", "tap_dance", "combo", "key_override"]) {
    const list = v[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length > MAX_ENTRIES) return false;
  }
  if (
    Array.isArray(v.tap_dance) &&
    !v.tap_dance.every((t) => Array.isArray(t) && t.length <= 5)
  )
    return false;
  if (
    Array.isArray(v.combo) &&
    !v.combo.every(
      (c) => Array.isArray(c) && c.length <= 5 && c.every(isKeycode),
    )
  )
    return false;
  if (
    Array.isArray(v.key_override) &&
    !v.key_override.every(
      (o) => o && typeof o === "object" && !Array.isArray(o),
    )
  )
    return false;
  if (Array.isArray(v.macro)) {
    for (const m of v.macro) {
      if (!Array.isArray(m) || m.length > MAX_ENTRIES) return false;
      for (const a of m) {
        if (!Array.isArray(a) || typeof a[0] !== "string" || a.length > 64)
          return false;
        if (a[0] === "text" && (typeof a[1] !== "string" || a[1].length > 1024))
          return false;
      }
    }
  }
  if (v.settings !== undefined) {
    if (
      !v.settings ||
      typeof v.settings !== "object" ||
      Array.isArray(v.settings)
    )
      return false;
    const entries = Object.entries(v.settings as Record<string, unknown>);
    if (
      entries.length > 64 ||
      !entries.every(([k, x]) => /^\d+$/.test(k) && typeof x === "number")
    )
      return false;
  }
  return true;
}

function clean(text: unknown, max: number): string {
  return typeof text === "string" ? text.trim().slice(0, max) : "";
}

/**
 * Read a file, link or post. `fallbackName` names a bare .vil (the file
 * name); `board` is the keyboard it is being opened on, used for a bare .vil
 * that does not say.
 */
export function parseQmkKeymapFile(
  text: string,
  options: { fallbackName?: string; board?: string } = {},
): QmkParseResult {
  if (text.length > MAX_QMK_FILE_BYTES)
    return { ok: false, reason: "too-large" };
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    return { ok: false, reason: "not-a-keymap" };
  const d = doc as Record<string, unknown>;

  if (d.format === QMK_KEYMAP_FORMAT) {
    if (
      typeof d.formatVersion !== "number" ||
      d.formatVersion > FORMAT_VERSION
    ) {
      return { ok: false, reason: "not-a-keymap" };
    }
    if (!vilLooksValid(d.vil)) return { ok: false, reason: "not-a-keymap" };
    if (!isKnownQmkBoard(d.board))
      return { ok: false, reason: "unsupported-board" };
    const name = clean(d.name, MAX_NAME);
    if (!name) return { ok: false, reason: "not-a-keymap" };
    return {
      ok: true,
      keymap: {
        name,
        description: clean(d.description, MAX_DESCRIPTION),
        board: d.board,
        fromDemo: d.fromDemo === true || undefined,
        uid:
          typeof d.uid === "string" && /^\d{1,20}$/.test(d.uid)
            ? d.uid
            : undefined,
        vil: { ...d.vil, uid: 0 },
      },
    };
  }

  // A bare .vil, as Vial saves it.
  if (vilLooksValid(d)) {
    if (!isKnownQmkBoard(options.board))
      return { ok: false, reason: "unsupported-board" };
    return {
      ok: true,
      keymap: {
        name: clean(options.fallbackName, MAX_NAME) || "Vial keymap",
        description: "",
        board: options.board,
        uid: uidDigits(text),
        vil: { ...d, uid: 0 },
      },
    };
  }
  return { ok: false, reason: "not-a-keymap" };
}

export function toQmkKeymapFile(
  keymap: QmkKeymapPayload,
): Record<string, unknown> {
  return {
    format: QMK_KEYMAP_FORMAT,
    formatVersion: FORMAT_VERSION,
    name: keymap.name,
    description: keymap.description,
    board: keymap.board,
    ...(keymap.fromDemo ? { fromDemo: true } : {}),
    ...(keymap.uid ? { uid: keymap.uid } : {}),
    vil: keymap.vil,
  };
}
