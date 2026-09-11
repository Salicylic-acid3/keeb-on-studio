/**
 * The public keymap gallery, on top of a single KV namespace.
 *
 * KV is a key-value store with no queries, so the shape of the keys has to do
 * the work a query would. Two things follow from that, and they explain most
 * of what looks odd below.
 *
 * **Newest first comes from the key.** KV lists keys in ascending
 * lexicographic order. A post's id therefore begins with its creation time
 * *inverted* and zero-padded, so ascending order is reverse-chronological and
 * paging is KV's own cursor. Putting the time in the id rather than in a
 * second index key also means one key per post: a post is addressable by id
 * alone, so report and delete need no lookup table.
 *
 * **The list page reads no values.** Everything a gallery card shows lives in
 * the key's metadata, which `list()` returns for free. Fetching a page of
 * twenty posts is one KV operation, not twenty-one. The metadata allowance is
 * 1024 bytes, which is why the card's blurb is a truncation of the description
 * rather than the description.
 *
 * The free tier allows 1,000 writes a day, so writes are counted here: two per
 * publish (the post, and the author's index), one per report, and one more
 * only on the report that crosses the hide threshold. Reads are effectively
 * unlimited by comparison, so anything that can be a read is one.
 */
import { parseFile } from "../src/lib/savedKeymaps/file";
import type { SavedKeymapPayload } from "../src/lib/savedKeymaps/types";
import { isKnownDeviceName } from "../src/lib/supportedDevices";

/** Posts one author may have at a time. */
export const POSTS_PER_AUTHOR = 10;

/** Reports that hide a post until the maintainer looks at it. */
export const REPORTS_TO_HIDE = 3;

/**
 * The biggest post accepted.
 *
 * A real keymap is a few kilobytes; the file reader's own cap is a megabyte,
 * which is right for a file someone chose to open and far too generous for a
 * public store anyone can write to.
 */
export const MAX_POST_BYTES = 128 * 1024;

/** Cards per page. */
export const PAGE_SIZE = 24;

const POST_PREFIX = "post:";
const AUTHOR_PREFIX = "author:";
const REPORT_PREFIX = "report:";

/**
 * Width of the inverted timestamp in an id. Milliseconds since the epoch fit
 * in 13 digits until the year 2286; 14 leaves the padding stable past that,
 * which matters because changing it later would reorder every existing post.
 */
const TIME_DIGITS = 14;
const TIME_CEILING = 10 ** TIME_DIGITS;

/** What a gallery card shows. Lives in KV metadata, so it must stay small. */
export interface PostCard {
  /** Keymap name, as the author wrote it. */
  name: string;
  /** Opening of the description, enough to tell two keymaps apart. */
  blurb: string;
  /** Physical layout the keymap was made for. */
  layout: string;
  /** Supported keyboard name (`ergotrack`, `goforty-max`). */
  board: string;
  layers: number;
  keys: number;
  /** Milliseconds since the epoch. */
  at: number;
  /** Set once reports pass the threshold; such posts are not listed. */
  hidden?: true;
}

export interface PostBody {
  /** The keymap, in the same wrapper a `.json` export uses. */
  file: unknown;
  /** Hash of the author's local token. Never the token itself. */
  author: string;
  board: string;
  at: number;
}

export interface PostSummary extends PostCard {
  id: string;
}

export type PublishFailure =
  | { reason: "too-large" }
  | { reason: "not-a-keymap" }
  | { reason: "unsupported-board" }
  | { reason: "quota" }
  | { reason: "invalid-author" };

export type PublishResult =
  | { ok: true; id: string; card: PostCard }
  | ({ ok: false } & PublishFailure);

const BLURB_LENGTH = 80;

/** An id that sorts newest-first and carries its own creation time. */
export function makeId(at: number, random: string): string {
  const inverted = TIME_CEILING - 1 - at;
  return `${String(inverted).padStart(TIME_DIGITS, "0")}-${random}`;
}

export function idLooksValid(id: string): boolean {
  return new RegExp(`^\\d{${TIME_DIGITS}}-[a-z0-9]{8,32}$`).test(id);
}

/**
 * The author's token never reaches storage.
 *
 * It is a random string a browser keeps in order to manage its own posts, so
 * it is a credential; storing it would mean a leak of the store is a leak of
 * everyone's ability to delete everyone's posts. A hash is enough to compare
 * one against a stored post.
 */
export async function hashAuthor(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`keeb-on-studio/gallery/${token}`),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function authorTokenLooksValid(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(token);
}

function cardFor(
  keymap: SavedKeymapPayload,
  board: string,
  at: number,
): PostCard {
  return {
    name: keymap.name,
    blurb: keymap.description.slice(0, BLURB_LENGTH),
    layout: keymap.target.layoutName,
    board,
    layers: keymap.layers.length,
    keys: keymap.target.keyCount,
    at,
  };
}

/**
 * The slice of KV this module uses.
 *
 * Declared here rather than taken from the Workers runtime types so the
 * gallery's logic can be exercised without a Workers runtime at all -- and so
 * the surface it actually depends on is visible in one place rather than
 * inferred from call sites. A real `KVNamespace` satisfies it structurally.
 */
export interface GalleryKV {
  get(key: string): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown>;
  getWithMetadata<Metadata>(
    key: string,
    options: { type: "json" },
  ): Promise<{ value: unknown; metadata: Metadata | null }>;
  put(
    key: string,
    value: string,
    options?: { metadata?: unknown },
  ): Promise<void>;
  list<Metadata>(options: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string; metadata?: Metadata }>;
    list_complete: boolean;
    cursor?: string;
  }>;
  delete(key: string): Promise<void>;
}

export interface GalleryStore {
  kv: GalleryKV;
  now: () => number;
  randomId: () => string;
}

/** Publish a keymap. The body is whatever the client sent; nothing is trusted. */
export async function publish(
  store: GalleryStore,
  input: { text: string; author: unknown; board: unknown },
): Promise<PublishResult> {
  if (input.text.length > MAX_POST_BYTES)
    return { ok: false, reason: "too-large" };
  if (!authorTokenLooksValid(input.author)) {
    return { ok: false, reason: "invalid-author" };
  }
  if (typeof input.board !== "string" || !isKnownDeviceName(input.board)) {
    // Not a security boundary -- the name is self-reported and forgeable, the
    // same as it is over the wire from a keyboard. It keeps the gallery to the
    // keyboards this app is for without identifying anyone's device.
    return { ok: false, reason: "unsupported-board" };
  }

  // The same reader a file and a link go through. One validator, three doors:
  // a post cannot carry anything an opened file could not.
  const parsed = parseFile(input.text);
  if (!parsed.ok) return { ok: false, reason: "not-a-keymap" };

  const author = await hashAuthor(input.author);
  const owned = await listAuthorPosts(store, author);
  if (owned.length >= POSTS_PER_AUTHOR) return { ok: false, reason: "quota" };

  const at = store.now();
  const id = makeId(at, store.randomId());
  const card = cardFor(parsed.keymap, input.board, at);
  const body: PostBody = {
    file: JSON.parse(input.text),
    author,
    board: input.board,
    at,
  };

  await store.kv.put(POST_PREFIX + id, JSON.stringify(body), {
    metadata: card,
  });
  await store.kv.put(`${AUTHOR_PREFIX}${author}:${id}`, "");

  return { ok: true, id, card };
}

async function listAuthorPosts(
  store: GalleryStore,
  author: string,
): Promise<string[]> {
  const listed = await store.kv.list({
    prefix: `${AUTHOR_PREFIX}${author}:`,
    limit: POSTS_PER_AUTHOR + 1,
  });
  return listed.keys.map((key) => key.name.split(":")[2]);
}

export interface Page {
  posts: PostSummary[];
  cursor: string | null;
}

/** A page of the gallery, newest first. */
export async function listPosts(
  store: GalleryStore,
  cursor?: string,
): Promise<Page> {
  const listed = await store.kv.list<PostCard>({
    prefix: POST_PREFIX,
    limit: PAGE_SIZE,
    cursor,
  });

  const posts: PostSummary[] = [];
  for (const key of listed.keys) {
    const card = key.metadata;
    // A key with no metadata predates this shape or was written by hand;
    // either way there is nothing to draw a card from, so it is not listed.
    if (!card || card.hidden) continue;
    posts.push({ ...card, id: key.name.slice(POST_PREFIX.length) });
  }

  return {
    posts,
    // A cursor only means anything while there is more to read; null is the
    // client's signal that it has reached the end.
    cursor: listed.list_complete ? null : (listed.cursor ?? null),
  };
}

/** One post's keymap, as the file it would have been. */
export async function getPost(
  store: GalleryStore,
  id: string,
): Promise<{ file: unknown; card: PostCard } | null> {
  if (!idLooksValid(id)) return null;
  const found = await store.kv.getWithMetadata<PostCard>(POST_PREFIX + id, {
    type: "json",
  });
  const body = found.value as PostBody | null;
  if (!body || !found.metadata) return null;
  // A hidden post stays fetchable by direct id so an existing link does not
  // break mid-conversation; it is only kept off the list.
  return { file: body.file, card: found.metadata };
}

export type ReportOutcome = "recorded" | "already" | "unknown" | "invalid";

/**
 * Record a report, and hide the post once enough people have made one.
 *
 * Reports are keyed by reporter so one browser cannot report the same post
 * repeatedly -- otherwise "enough people" would mean "one determined person".
 */
export async function reportPost(
  store: GalleryStore,
  id: string,
  token: unknown,
): Promise<ReportOutcome> {
  if (!idLooksValid(id)) return "invalid";
  if (!authorTokenLooksValid(token)) return "invalid";

  const found = await store.kv.getWithMetadata<PostCard>(POST_PREFIX + id, {
    type: "json",
  });
  if (!found.value || !found.metadata) return "unknown";
  if (found.metadata.hidden) return "already";

  const reporter = await hashAuthor(token);
  const reportKey = `${REPORT_PREFIX}${id}:${reporter}`;
  if ((await store.kv.get(reportKey)) !== null) return "already";
  await store.kv.put(reportKey, "");

  const reports = await store.kv.list({
    prefix: `${REPORT_PREFIX}${id}:`,
    limit: REPORTS_TO_HIDE,
  });
  if (reports.keys.length >= REPORTS_TO_HIDE) {
    await store.kv.put(POST_PREFIX + id, JSON.stringify(found.value), {
      metadata: { ...found.metadata, hidden: true },
    });
  }

  return "recorded";
}

export type DeleteOutcome = "deleted" | "not-yours" | "unknown" | "invalid";

/**
 * Delete a post.
 *
 * `token` deletes only that author's own posts; `isMaintainer` deletes
 * anything, which is what makes "report it and it goes" true.
 */
export async function deletePost(
  store: GalleryStore,
  id: string,
  token: unknown,
  isMaintainer: boolean,
): Promise<DeleteOutcome> {
  if (!idLooksValid(id)) return "invalid";

  const body = (await store.kv.get(
    POST_PREFIX + id,
    "json",
  )) as PostBody | null;
  if (!body) return "unknown";

  if (!isMaintainer) {
    if (!authorTokenLooksValid(token)) return "invalid";
    if ((await hashAuthor(token)) !== body.author) return "not-yours";
  }

  await store.kv.delete(POST_PREFIX + id);
  await store.kv.delete(`${AUTHOR_PREFIX}${body.author}:${id}`);
  // Reports for a post that no longer exists are litter, but deleting them
  // costs a write each and KV expires nothing on its own -- so they are left,
  // and a re-used id is impossible because the id carries its creation time.
  return "deleted";
}
