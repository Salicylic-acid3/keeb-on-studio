/**
 * The gallery, from the browser's side.
 *
 * Every response is treated as untrusted, exactly like a file or a link: a
 * fetched keymap goes through the same `parseFile` before anything is done
 * with it. The gallery being ours does not make its contents ours -- the
 * keymaps in it were written by other people.
 *
 * There is no account here. A browser keeps a random token so it can manage
 * the posts it made, and that token is all the server knows about an author;
 * it never sees a keyboard's identity, and it stores only a hash of the token
 * rather than the token itself.
 */
import { parseFile, type SavedKeymapPayload } from "../savedKeymaps";

const API = "/api/gallery";
const TOKEN_KEY = "keeb-on-studio-gallery-author";
const MINE_KEY = "keeb-on-studio-gallery-mine";

/** What a gallery card shows, as the Worker sends it. */
export interface GalleryCard {
  id: string;
  name: string;
  blurb: string;
  layout: string;
  board: string;
  layers: number;
  keys: number;
  at: number;
}

export interface GalleryPage {
  posts: GalleryCard[];
  cursor: string | null;
}

export type GalleryError =
  | "offline"
  | "not-configured"
  | "too-large"
  | "not-a-keymap"
  | "unsupported-board"
  | "quota"
  | "not-yours"
  | "not-found"
  | "forbidden"
  | "unknown";

export type GalleryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GalleryError; limit?: number };

/**
 * This browser's author token, minted on first use.
 *
 * Deliberately per-browser and disposable. It is not an identity -- someone
 * who clears their site data loses the ability to delete their own posts,
 * which is the honest cost of having no accounts, and is why deleting is not
 * the only way a bad post can go (see reporting).
 */
export function authorToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const minted = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(TOKEN_KEY, minted);
    return minted;
  } catch {
    // Private browsing, or storage refused outright. A token that lasts only
    // as long as the page still lets someone publish; it just cannot come
    // back to manage the post later.
    return crypto.randomUUID().replace(/-/g, "");
  }
}

/**
 * Ids this browser published.
 *
 * Kept locally because the server has no notion of "my posts" it could be
 * asked for -- an author is a hashed token, and listing by it would mean
 * sending the token on every read. The consequence is honest and worth
 * knowing: clear your site data and your posts stay up, reachable only by
 * reporting them.
 */
export function myPostIds(): Set<string> {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function rememberPosts(ids: Set<string>): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...ids]));
  } catch {
    // Nowhere to keep it. Publishing still works; managing it later does not.
  }
}

export function rememberPost(id: string): Set<string> {
  const ids = myPostIds();
  ids.add(id);
  rememberPosts(ids);
  return ids;
}

export function forgetPost(id: string): Set<string> {
  const ids = myPostIds();
  ids.delete(id);
  rememberPosts(ids);
  return ids;
}

function errorFrom(status: number, body: unknown): GalleryError {
  const named =
    typeof body === "object" && body !== null && "error" in body
      ? String((body as { error: unknown }).error)
      : "";
  switch (named) {
    case "gallery-not-configured":
      return "not-configured";
    case "too-large":
    case "not-a-keymap":
    case "unsupported-board":
    case "quota":
    case "not-yours":
    case "not-found":
    case "forbidden":
      return named;
    default:
      return status === 404 ? "not-found" : "unknown";
  }
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<GalleryResult<T>> {
  let response: Response;
  try {
    response = await fetch(API + path, init);
  } catch {
    // No network, or the request never left. Distinguished from a refusal so
    // the UI can say "could not reach" rather than blaming the keymap.
    return { ok: false, error: "offline" };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const limit =
      typeof body === "object" && body !== null && "limit" in body
        ? Number((body as { limit: unknown }).limit)
        : undefined;
    return { ok: false, error: errorFrom(response.status, body), limit };
  }
  return { ok: true, value: body as T };
}

export function listGallery(
  cursor?: string,
): Promise<GalleryResult<GalleryPage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call<GalleryPage>(query);
}

/**
 * One post's keymap, checked before it is handed back.
 *
 * The gallery could serve anything; running it through the same reader a file
 * goes through means a post cannot do something a file could not.
 */
export async function fetchGalleryKeymap(
  id: string,
): Promise<GalleryResult<SavedKeymapPayload>> {
  const result = await call<{ file: unknown }>(`/${encodeURIComponent(id)}`);
  if (!result.ok) return result;
  const parsed = parseFile(JSON.stringify(result.value.file));
  if (!parsed.ok) return { ok: false, error: "not-a-keymap" };
  return { ok: true, value: parsed.keymap };
}

export function publishToGallery(
  keymap: SavedKeymapPayload,
  board: string,
): Promise<GalleryResult<{ id: string }>> {
  return call<{ id: string }>("", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      keymap: {
        format: "keeb-on-studio/keymap",
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        keymap,
      },
      author: authorToken(),
      board,
    }),
  });
}

export function reportGalleryPost(
  id: string,
): Promise<GalleryResult<{ outcome: string }>> {
  return call<{ outcome: string }>(`/${encodeURIComponent(id)}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ author: authorToken() }),
  });
}

export function deleteGalleryPost(
  id: string,
): Promise<GalleryResult<{ outcome: string }>> {
  return call<{ outcome: string }>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ author: authorToken() }),
  });
}
