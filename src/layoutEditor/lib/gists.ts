/**
 * Layouts kept in the user's own GitHub Gists, the way Keyboard Layout
 * Editor keeps them: a Gist with a `<name>.kbd.json` file holding KLE data.
 * So what KLE saved opens here, and what is saved here opens in KLE.
 *
 * A Gist saved here carries a second file, the editor's own project file,
 * which keeps what KLE data cannot (matrix numbers beside legends, pivots,
 * keycap choices); it is what this editor reads when it is there.
 *
 * Signing in goes through the Worker once (worker/github.ts); after that
 * the browser talks to GitHub directly with the token it keeps.
 */
import type { CapSetup } from "./capSetup";
import { exportKle, importKle, parseKleText } from "./kle";
import type { LayoutProject } from "./model";
import {
  projectFileText,
  readCapSetupText,
  readLayoutText,
  rowsToJson,
} from "./project";

const TOKEN_KEY = "keebon-layout-editor-github-token";
const STATE_KEY = "keebon-layout-editor-github-state";
const LINK_KEY = "keebon-layout-editor-gist";
const GITHUB = "https://api.github.com";

/** The editor's own file in a Gist it saved. */
export const PROJECT_FILE = "keebon-layout.json";
const KLE_FILE = /\.kbd\.json$/i;
/** Gists asked of GitHub at a time (its most). */
export const GISTS_PER_REQUEST = 100;

export type GistError =
  | "offline"
  | "not-configured"
  | "signed-out"
  | "rate-limit"
  | "not-found"
  | "not-a-layout"
  | "unknown";

export type GistResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GistError };

/** A Gist that holds a layout, as the list shows it. */
export interface GistEntry {
  id: string;
  name: string;
  /** ISO time of the last change. */
  updatedAt: string;
  public: boolean;
  url: string;
  /** The KLE file in it, if any. */
  kleFile: string | null;
  /** Saved from this editor: it has the project file too. */
  full: boolean;
}

/** The Gist the layout on screen was opened from or saved to. */
export interface GistLink {
  id: string;
  kleFile: string | null;
}

interface RawFile {
  filename?: unknown;
  content?: unknown;
  truncated?: unknown;
  raw_url?: unknown;
}
interface RawGist {
  id?: unknown;
  description?: unknown;
  updated_at?: unknown;
  public?: unknown;
  html_url?: unknown;
  files?: Record<string, RawFile | null> | null;
}

// ----- the token and the sign-in round trip --------------------------------

export function storedToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function keepToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Not kept: signed in until the page is left.
  }
}

export function signOut(): void {
  keepToken(null);
}

/** The OAuth App's id, or why signing in is not possible here. */
export async function githubClientId(): Promise<GistResult<string>> {
  let response: Response;
  try {
    response = await fetch("/api/github/config");
  } catch {
    return { ok: false, error: "offline" };
  }
  const body = (await response.json().catch(() => null)) as {
    clientId?: unknown;
  } | null;
  return response.ok && typeof body?.clientId === "string"
    ? { ok: true, value: body.clientId }
    : { ok: false, error: "not-configured" };
}

/** GitHub's sign-in page for this app, asking only for Gists. */
export function authorizeUrl(
  clientId: string,
  state: string,
  redirect: string,
): string {
  const query = new URLSearchParams({
    client_id: clientId,
    scope: "gist",
    state,
    redirect_uri: redirect,
  });
  return `https://github.com/login/oauth/authorize?${query}`;
}

/** Leave for GitHub's sign-in page; it comes back to `redirect`. */
export function beginSignIn(clientId: string, redirect: string): void {
  const state = crypto.randomUUID().replace(/-/g, "");
  try {
    window.sessionStorage.setItem(STATE_KEY, state);
  } catch {
    // Without it the return trip cannot be checked and is refused.
  }
  window.location.assign(authorizeUrl(clientId, state, redirect));
}

/** The code GitHub sent back, if this page load is the return trip. */
export function returnedCode(
  search: string,
  expectedState: string | null,
): string | null {
  const query = new URLSearchParams(search);
  const code = query.get("code");
  const state = query.get("state");
  if (!code || !state || !expectedState || state !== expectedState) return null;
  return code;
}

/** Finish signing in on the return trip. Null when this is not one. */
export async function finishSignIn(
  search: string,
): Promise<GistResult<string> | null> {
  let expected: string | null = null;
  try {
    expected = window.sessionStorage.getItem(STATE_KEY);
    window.sessionStorage.removeItem(STATE_KEY);
  } catch {
    // As beginSignIn.
  }
  const code = returnedCode(search, expected);
  if (!code) return null;
  let response: Response;
  try {
    response = await fetch("/api/github/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  const body = (await response.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  if (!response.ok || typeof body?.token !== "string")
    return {
      ok: false,
      error: response.status === 503 ? "not-configured" : "unknown",
    };
  keepToken(body.token);
  return { ok: true, value: body.token };
}

// ----- talking to GitHub ----------------------------------------------------

async function github<T>(
  path: string,
  init?: RequestInit,
): Promise<GistResult<T>> {
  const token = storedToken();
  if (!token) return { ok: false, error: "signed-out" };
  let response: Response;
  try {
    response = await fetch(path.startsWith("http") ? path : GITHUB + path, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
      },
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  if (response.status === 401) {
    // The token was revoked or has expired: signed out, in effect.
    keepToken(null);
    return { ok: false, error: "signed-out" };
  }
  if (response.status === 403 || response.status === 429)
    return { ok: false, error: "rate-limit" };
  if (response.status === 404) return { ok: false, error: "not-found" };
  if (!response.ok) return { ok: false, error: "unknown" };
  return { ok: true, value: (await response.json().catch(() => null)) as T };
}

/** The signed-in account's name. */
export async function githubUser(): Promise<GistResult<string>> {
  const result = await github<{ login?: unknown }>("/user");
  if (!result.ok) return result;
  return typeof result.value?.login === "string"
    ? { ok: true, value: result.value.login }
    : { ok: false, error: "unknown" };
}

/** The Gists among `raw` that hold a layout, as list entries. */
export function gistEntries(raw: unknown): GistEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: GistEntry[] = [];
  for (const gist of raw as RawGist[]) {
    if (!gist || typeof gist.id !== "string") continue;
    const names = Object.keys(gist.files ?? {});
    const kleFile = names.find((n) => KLE_FILE.test(n)) ?? null;
    const full = names.includes(PROJECT_FILE);
    if (!kleFile && !full) continue;
    const described =
      typeof gist.description === "string" ? gist.description.trim() : "";
    entries.push({
      id: gist.id,
      name: described || (kleFile ?? PROJECT_FILE).replace(KLE_FILE, ""),
      updatedAt: typeof gist.updated_at === "string" ? gist.updated_at : "",
      public: gist.public === true,
      url: typeof gist.html_url === "string" ? gist.html_url : "",
      kleFile,
      full,
    });
  }
  return entries;
}

/**
 * One request's worth of the account's Gists (newest first), keeping those
 * with a layout. `more` is false once GitHub has no further Gists.
 */
export async function listGists(
  request: number,
): Promise<GistResult<{ entries: GistEntry[]; more: boolean }>> {
  const result = await github<unknown[]>(
    `/gists?per_page=${GISTS_PER_REQUEST}&page=${request}`,
  );
  if (!result.ok) return result;
  const raw = Array.isArray(result.value) ? result.value : [];
  return {
    ok: true,
    value: {
      entries: gistEntries(raw),
      more: raw.length === GISTS_PER_REQUEST,
    },
  };
}

export interface OpenedGist {
  project: LayoutProject;
  caps: CapSetup | null;
  link: GistLink;
}

async function fileText(file: RawFile): Promise<string | null> {
  if (file.truncated === true && typeof file.raw_url === "string") {
    try {
      const response = await fetch(file.raw_url);
      return response.ok ? await response.text() : null;
    } catch {
      return null;
    }
  }
  return typeof file.content === "string" ? file.content : null;
}

/** The layout in a Gist's files: the project file if there, else KLE data. */
export function layoutFromFiles(
  files: Record<string, string>,
  fallbackName: string,
): {
  project: LayoutProject;
  caps: CapSetup | null;
  kleFile: string | null;
} | null {
  const kleFile = Object.keys(files).find((n) => KLE_FILE.test(n)) ?? null;
  const own = files[PROJECT_FILE];
  try {
    if (own !== undefined) {
      return {
        project: readLayoutText(own),
        caps: readCapSetupText(own),
        kleFile,
      };
    }
    if (kleFile) {
      const project = importKle(parseKleText(files[kleFile]));
      return {
        project: project.name ? project : { ...project, name: fallbackName },
        caps: null,
        kleFile,
      };
    }
  } catch {
    // Not layout data after all.
  }
  return null;
}

export async function openGist(id: string): Promise<GistResult<OpenedGist>> {
  const result = await github<RawGist>(`/gists/${encodeURIComponent(id)}`);
  if (!result.ok) return result;
  const texts: Record<string, string> = {};
  for (const [name, file] of Object.entries(result.value?.files ?? {})) {
    if (!file || (name !== PROJECT_FILE && !KLE_FILE.test(name))) continue;
    const text = await fileText(file);
    if (text !== null) texts[name] = text;
  }
  const described =
    typeof result.value?.description === "string"
      ? result.value.description.trim()
      : "";
  const layout = layoutFromFiles(texts, described);
  if (!layout || layout.project.keys.length === 0)
    return { ok: false, error: "not-a-layout" };
  return {
    ok: true,
    value: {
      project: layout.project,
      caps: layout.caps,
      link: { id, kleFile: layout.kleFile },
    },
  };
}

function kleFileName(name: string): string {
  const safe = (name.trim() || "layout").replace(/[\\/:*?"<>|\s]+/g, "-");
  return `${safe}.kbd.json`;
}

/**
 * What to send GitHub to save a layout: the KLE file under the layout's
 * name (the old one removed if the name changed) and the project file.
 */
export function gistPayload(
  project: LayoutProject,
  caps: CapSetup,
  previousKleFile: string | null,
): { description: string; files: Record<string, { content: string } | null> } {
  const kleFile = kleFileName(project.name);
  const files: Record<string, { content: string } | null> = {
    [kleFile]: { content: rowsToJson(exportKle(project, "legend")) },
    [PROJECT_FILE]: { content: projectFileText(project, caps) },
  };
  if (previousKleFile && previousKleFile !== kleFile)
    files[previousKleFile] = null;
  return { description: project.name.trim() || "layout", files };
}

/** Save as a new Gist, or over the one given. */
export async function saveGist(
  project: LayoutProject,
  caps: CapSetup,
  options: { over: GistLink | null; public: boolean },
): Promise<GistResult<GistLink>> {
  const payload = gistPayload(project, caps, options.over?.kleFile ?? null);
  const result = options.over
    ? await github<RawGist>(`/gists/${encodeURIComponent(options.over.id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    : await github<RawGist>("/gists", {
        method: "POST",
        body: JSON.stringify({ ...payload, public: options.public }),
      });
  if (!result.ok) return result;
  if (typeof result.value?.id !== "string")
    return { ok: false, error: "unknown" };
  return {
    ok: true,
    value: { id: result.value.id, kleFile: kleFileName(project.name) },
  };
}

// ----- which Gist the layout on screen belongs to ---------------------------

export function storedGistLink(): GistLink | null {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(LINK_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const { id, kleFile } = value as { id?: unknown; kleFile?: unknown };
    return typeof id === "string"
      ? { id, kleFile: typeof kleFile === "string" ? kleFile : null }
      : null;
  } catch {
    return null;
  }
}

export function storeGistLink(link: GistLink | null): void {
  try {
    if (link) window.localStorage.setItem(LINK_KEY, JSON.stringify(link));
    else window.localStorage.removeItem(LINK_KEY);
  } catch {
    // Not kept: the next save makes a new Gist.
  }
}
