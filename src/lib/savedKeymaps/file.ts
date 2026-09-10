/**
 * Saved keymaps as files.
 *
 * A keymap handed to someone over Discord arrives as whatever they had lying
 * around — an old export, a truncated paste, a screenshot renamed to .json, or
 * something that was never a keymap. So the reader here validates rather than
 * trusts: every field is checked before a record is offered to the store, and
 * a file that does not check out is refused with a reason rather than partly
 * imported.
 */
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SAVED_KEYMAP_SCHEMA_VERSION,
  type SavedKeymapPayload,
  type StoredBinding,
  type StoredLayer,
} from "./types";

/** Marker so a reader can tell this from any other JSON. */
export const FILE_FORMAT = "keeb-on-studio/keymap";
/** Version of the wrapper below, independent of the keymap's own schema. */
export const FILE_FORMAT_VERSION = 1;

/**
 * A cap on what the reader will even attempt, so a huge file cannot be turned
 * into a huge allocation. ErgoTrack's 79 keys over 8 layers come to a few tens
 * of kilobytes; a megabyte is far past anything legitimate.
 */
export const MAX_FILE_BYTES = 1024 * 1024;

export interface KeymapFile {
  format: typeof FILE_FORMAT;
  formatVersion: number;
  exportedAt: string;
  keymap: SavedKeymapPayload;
}

export type ParseFailure =
  | { reason: "too-large" }
  | { reason: "not-json" }
  | { reason: "not-a-keymap" }
  | { reason: "newer-format" }
  | { reason: "malformed"; field: string };

export type ParseResult =
  | { ok: true; keymap: SavedKeymapPayload }
  | ({ ok: false } & ParseFailure);

export function toFile(keymap: SavedKeymapPayload): KeymapFile {
  return {
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    keymap,
  };
}

export function serialize(keymap: SavedKeymapPayload): string {
  return JSON.stringify(toFile(keymap), null, 2);
}

/**
 * A filename that survives every filesystem: the keymap's name where it can,
 * a fallback where it cannot. Names are user text and may be entirely
 * punctuation, or Japanese, or empty.
 */
export function fileNameFor(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return `${cleaned || "keymap"}.keeb-on.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBinding(value: unknown): StoredBinding | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  const [behaviorIndex, param1, param2] = value as number[];
  if (!Number.isInteger(behaviorIndex) || behaviorIndex < 0) return null;
  return [behaviorIndex, param1, param2];
}

function parseLayer(value: unknown): StoredLayer | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== "string") return null;
  if (!Array.isArray(value.bindings)) return null;

  const bindings: StoredBinding[] = [];
  for (const raw of value.bindings) {
    const binding = parseBinding(raw);
    if (!binding) return null;
    bindings.push(binding);
  }
  return { name: value.name, bindings };
}

/** Read a file's text into a keymap, or say why it is not one. */
export function parseFile(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, reason: "too-large" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-json" };
  }

  if (!isRecord(parsed) || parsed.format !== FILE_FORMAT) {
    return { ok: false, reason: "not-a-keymap" };
  }
  if (
    typeof parsed.formatVersion !== "number" ||
    parsed.formatVersion > FILE_FORMAT_VERSION
  ) {
    return { ok: false, reason: "newer-format" };
  }

  const keymap = parsed.keymap;
  if (!isRecord(keymap)) {
    return { ok: false, reason: "malformed", field: "keymap" };
  }
  if (
    typeof keymap.schemaVersion !== "number" ||
    keymap.schemaVersion > SAVED_KEYMAP_SCHEMA_VERSION
  ) {
    return { ok: false, reason: "newer-format" };
  }
  if (typeof keymap.name !== "string") {
    return { ok: false, reason: "malformed", field: "name" };
  }
  if (typeof keymap.description !== "string") {
    return { ok: false, reason: "malformed", field: "description" };
  }
  if (
    !isRecord(keymap.target) ||
    typeof keymap.target.layoutName !== "string" ||
    typeof keymap.target.keyCount !== "number" ||
    !Number.isInteger(keymap.target.keyCount) ||
    keymap.target.keyCount < 0
  ) {
    return { ok: false, reason: "malformed", field: "target" };
  }
  if (
    !Array.isArray(keymap.behaviors) ||
    !keymap.behaviors.every((name) => typeof name === "string")
  ) {
    return { ok: false, reason: "malformed", field: "behaviors" };
  }
  if (!Array.isArray(keymap.layers)) {
    return { ok: false, reason: "malformed", field: "layers" };
  }

  const layers: StoredLayer[] = [];
  for (const raw of keymap.layers) {
    const layer = parseLayer(raw);
    if (!layer) return { ok: false, reason: "malformed", field: "layers" };
    layers.push(layer);
  }

  const behaviors = keymap.behaviors as string[];
  // An index past the table would resolve to "no such behavior" at load time
  // and quietly blank the key. Better to refuse the file.
  for (const layer of layers) {
    for (const [behaviorIndex] of layer.bindings) {
      if (behaviorIndex >= behaviors.length) {
        return { ok: false, reason: "malformed", field: "behaviors" };
      }
    }
  }

  return {
    ok: true,
    keymap: {
      schemaVersion: keymap.schemaVersion,
      // Re-apply the caps here too: the file was written somewhere else and
      // may not have honoured them.
      name: keymap.name.slice(0, NAME_MAX_LENGTH),
      description: keymap.description.slice(0, DESCRIPTION_MAX_LENGTH),
      target: {
        layoutName: keymap.target.layoutName,
        keyCount: keymap.target.keyCount,
      },
      behaviors,
      layers,
      // Where it came from is not the importer's claim to make.
      fromDemo: keymap.fromDemo === true,
    },
  };
}
