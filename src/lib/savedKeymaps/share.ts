/**
 * Saved keymaps as links.
 *
 * A keymap in a URL is the same document `file.ts` writes, deflated and spelled
 * in base64url. That is deliberate: there is one wire format and therefore one
 * validator, so a link cannot smuggle in anything a file could not. Sharing
 * needs no server and leaves no copy anywhere -- the keymap travels inside the
 * `#` fragment, which browsers never send upstream.
 *
 * A real ErgoTrack keymap (79 keys over 8 layers) comes to roughly 1.5-1.8k
 * characters of link. Most of a keymap is `&trans` and repeated key presses, so
 * deflate does well on it; the pathological case -- every key on every layer
 * bound to something different -- is several times that, which is why there is
 * a ceiling below.
 */
import { MAX_FILE_BYTES, parseFile, toFile, type ParseFailure } from "./file";
import type { SavedKeymapPayload } from "./types";

/** The key the code travels under, so other things can join it in the fragment later. */
export const SHARE_HASH_KEY = "k";

/**
 * The longest link this will produce or read.
 *
 * Browsers hold far more than this, but a link is meant to be pasted into
 * Discord (2,000 characters a message) or a forum post, and past a point a
 * "share" that cannot be shared is worse than an honest refusal.
 */
export const MAX_SHARE_CODE_CHARS = 16_000;

/**
 * A ceiling on what a code is allowed to inflate to. Deflate expands by around
 * a thousand to one on the right input, so without this a two-kilobyte link
 * could ask for a gigabyte of memory. Matches the file reader's own cap.
 */
export const MAX_DECOMPRESSED_BYTES = MAX_FILE_BYTES;

export type ShareFailure =
  | ParseFailure
  /** Not base64url, not a deflate stream, or bigger than it claims to be. */
  | { reason: "not-a-share-code" };

export type ShareParseResult =
  | { ok: true; keymap: SavedKeymapPayload }
  | ({ ok: false } & ShareFailure);

/** True when this browser can compress at all; every browser that can talk to a keyboard can. */
export function isShareSupported(): boolean {
  return (
    typeof CompressionStream === "function" &&
    typeof DecompressionStream === "function"
  );
}

/**
 * Bytes backed by a plain `ArrayBuffer`. Spelling it out keeps the compression
 * streams happy: their input type excludes `SharedArrayBuffer`, which the bare
 * `Uint8Array` alias allows.
 */
type Bytes = Uint8Array<ArrayBuffer>;

// `String.fromCharCode(...bytes)` on a long array overflows the argument stack,
// so it goes a window at a time.
const CHARS_PER_PASS = 0x8000;

function toBase64Url(bytes: Bytes): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHARS_PER_PASS) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHARS_PER_PASS));
  }
  // Padding is dropped: `=` is legal in a fragment but gets escaped by enough
  // chat clients to be worth avoiding, and `atob` does not need it back.
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

// Typed as the compression streams' own input type (`BufferSource`) rather
// than `Uint8Array`, so `pipeThrough` lines up without a cast.
function streamOf(bytes: Bytes): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/**
 * Drain a stream, giving up the moment it goes past `maxBytes`.
 *
 * The cap is checked while reading rather than after, because "after" means the
 * allocation already happened -- which is the thing being defended against.
 */
async function collect(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Bytes | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    // A corrupt or truncated deflate stream surfaces here.
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Compress a keymap into the text that travels in a link. */
export async function toShareCode(keymap: SavedKeymapPayload): Promise<string> {
  // The same wrapper the file gets, minus the indentation -- so a code and a
  // file are the same document and go through the same reader.
  const text = JSON.stringify(toFile(keymap));
  const deflated = await collect(
    streamOf(new TextEncoder().encode(text)).pipeThrough(
      new CompressionStream("deflate-raw"),
    ),
    MAX_DECOMPRESSED_BYTES,
  );
  if (!deflated) throw new Error("Keymap could not be compressed");
  return toBase64Url(deflated);
}

/** Read a code back, or say why it is not one. */
export async function parseShareCode(code: string): Promise<ShareParseResult> {
  if (code.length > MAX_SHARE_CODE_CHARS) {
    return { ok: false, reason: "too-large" };
  }
  const bytes = fromBase64Url(code);
  if (!bytes) return { ok: false, reason: "not-a-share-code" };

  const inflated = await collect(
    streamOf(bytes).pipeThrough(new DecompressionStream("deflate-raw")),
    MAX_DECOMPRESSED_BYTES,
  );
  if (!inflated) return { ok: false, reason: "not-a-share-code" };

  // From here it is exactly a file: same wrapper, same checks, same refusals.
  return parseFile(new TextDecoder().decode(inflated));
}

/**
 * The link to hand someone.
 *
 * The keymap goes after the `#` rather than in a query string, so it never
 * reaches a server, never lands in an access log, and never leaves the browser
 * of whoever opens it.
 */
export function shareUrlFor(code: string, base: string): string {
  const url = new URL(base);
  url.hash = `${SHARE_HASH_KEY}=${code}`;
  return url.toString();
}

/** Pull a code out of a `#k=...` fragment, if there is one. */
export function shareCodeFromHash(hash: string): string | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body) return null;
  const code = new URLSearchParams(body).get(SHARE_HASH_KEY);
  return code && code.length > 0 ? code : null;
}
