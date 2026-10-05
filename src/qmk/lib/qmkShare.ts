/**
 * QMK keymaps as links. See savedQmkKeymap.ts for the format.
 */
import {
  MAX_QMK_FILE_BYTES,
  parseQmkKeymapFile,
  toQmkKeymapFile,
  type QmkKeymapPayload,
  type QmkParseResult,
} from "./savedQmkKeymap";

// ---- Links -----------------------------------------------------------------
// The same arrangement as the ZMK side's links (lib/savedKeymaps/share.ts):
// the file, deflated, base64url, in the # fragment (never sent to a server).
// Its own key, so the two sides never read each other's links.

export const QMK_SHARE_HASH_KEY = "q";
export const MAX_QMK_SHARE_CHARS = 16_000;

type Bytes = Uint8Array<ArrayBuffer>;

function toBase64Url(bytes: Bytes): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(code: string): Bytes | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function pipe(
  bytes: Bytes,
  transform: CompressionStream | DecompressionStream,
  max: number,
) {
  const stream = new ReadableStream<BufferSource>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  }).pipeThrough(transform);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function toQmkShareCode(
  keymap: QmkKeymapPayload,
): Promise<string> {
  const text = JSON.stringify(toQmkKeymapFile(keymap));
  const deflated = await pipe(
    new TextEncoder().encode(text),
    new CompressionStream("deflate-raw"),
    MAX_QMK_FILE_BYTES,
  );
  if (!deflated) throw new Error("Keymap could not be compressed");
  return toBase64Url(deflated);
}

export async function parseQmkShareCode(
  code: string,
): Promise<QmkParseResult | { ok: false; reason: "not-a-share-code" }> {
  if (code.length > MAX_QMK_SHARE_CHARS)
    return { ok: false, reason: "too-large" };
  const bytes = fromBase64Url(code);
  if (!bytes) return { ok: false, reason: "not-a-share-code" };
  const inflated = await pipe(
    bytes,
    new DecompressionStream("deflate-raw"),
    MAX_QMK_FILE_BYTES,
  );
  if (!inflated) return { ok: false, reason: "not-a-share-code" };
  return parseQmkKeymapFile(new TextDecoder().decode(inflated));
}

export function qmkShareCodeFromHash(hash: string): string | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body) return null;
  const code = new URLSearchParams(body).get(QMK_SHARE_HASH_KEY);
  return code || null;
}

export function qmkShareUrlFor(code: string, base: string): string {
  const url = new URL(base);
  url.hash = `${QMK_SHARE_HASH_KEY}=${code}`;
  return url.toString();
}
