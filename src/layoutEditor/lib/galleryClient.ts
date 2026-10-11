/**
 * The layout editor's shelf of the public gallery (see worker/gallery.ts):
 * list, open, publish, report and delete layouts. A layout travels as the
 * editor's own project file, keycap choices included, so opening one gives
 * exactly what its author saw.
 */
import {
  authorToken,
  type GalleryError,
  type GalleryResult,
} from "../../lib/gallery/client";
import { readCapSetup, type CapSetup } from "./capSetup";
import type { LayoutProject } from "./model";
import { projectFileText } from "./project";
import { PROJECT_FORMAT, isProject } from "./projectShape";

const API = "/api/gallery/layouts";
const MINE_KEY = "keeb-on-studio-gallery-my-layouts";

export interface LayoutCard {
  id: string;
  name: string;
  /** The opening of the description. */
  blurb: string;
  /** Ids of the keycap sets on it, comma-separated; "" for none. */
  layout: string;
  keys: number;
  /** Milliseconds since the epoch. */
  at: number;
}

export interface LayoutPage {
  posts: LayoutCard[];
  cursor: string | null;
}

export interface GalleryLayout {
  project: LayoutProject;
  caps: CapSetup | null;
  description: string;
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
    case "quota":
    case "not-yours":
    case "not-found":
    case "forbidden":
      return named;
    default:
      // The Worker always names its errors: a bare 404 or 405 is a server
      // without the gallery (the dev server, a static host).
      if (!named && (status === 404 || status === 405)) return "not-configured";
      return "unknown";
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
  // An answer that is not the gallery's (a host that serves the app's page
  // for every path) is no gallery either.
  if (body === null) return { ok: false, error: "not-configured" };
  return { ok: true, value: body as T };
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function listLayouts(
  cursor?: string,
): Promise<GalleryResult<LayoutPage>> {
  return call<LayoutPage>(
    cursor ? `?cursor=${encodeURIComponent(cursor)}` : "",
  );
}

/** What the gallery sent for a layout, as the editor can open it. */
export function readGalleryLayout(value: unknown): GalleryLayout | null {
  if (!value || typeof value !== "object") return null;
  const { file, description } = value as {
    file?: unknown;
    description?: unknown;
  };
  if (!file || typeof file !== "object") return null;
  const wrapper = file as {
    format?: unknown;
    project?: unknown;
    caps?: unknown;
  };
  if (wrapper.format !== PROJECT_FORMAT || !isProject(wrapper.project))
    return null;
  return {
    project: wrapper.project,
    caps: readCapSetup(wrapper.caps),
    description: typeof description === "string" ? description : "",
  };
}

export async function fetchLayout(
  id: string,
): Promise<GalleryResult<GalleryLayout>> {
  const result = await call<unknown>(`/${encodeURIComponent(id)}`);
  if (!result.ok) return result;
  const layout = readGalleryLayout(result.value);
  return layout
    ? { ok: true, value: layout }
    : { ok: false, error: "not-a-keymap" };
}

export async function publishLayout(
  project: LayoutProject,
  caps: CapSetup,
  description: string,
): Promise<GalleryResult<{ id: string }>> {
  const result = await call<{ id: string }>(
    "",
    post({
      layout: JSON.parse(projectFileText(project, caps)),
      description,
      author: authorToken(),
    }),
  );
  if (result.ok) rememberLayout(result.value.id);
  return result;
}

export function reportLayout(
  id: string,
): Promise<GalleryResult<{ outcome: string }>> {
  return call(
    `/${encodeURIComponent(id)}/report`,
    post({ author: authorToken() }),
  );
}

export async function deleteLayout(
  id: string,
): Promise<GalleryResult<{ outcome: string }>> {
  const result = await call<{ outcome: string }>(`/${encodeURIComponent(id)}`, {
    ...post({ author: authorToken() }),
    method: "DELETE",
  });
  if (result.ok) forgetLayout(id);
  return result;
}

/** The layouts this browser published, so it can offer to delete them. */
export function myLayoutIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function keep(ids: Set<string>): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...ids]));
  } catch {
    // Nowhere to keep it: publishing still works, deleting later does not.
  }
}

function rememberLayout(id: string): void {
  keep(myLayoutIds().add(id));
}

function forgetLayout(id: string): void {
  const ids = myLayoutIds();
  ids.delete(id);
  keep(ids);
}

/** The address that opens a published layout in the editor. */
export function layoutLink(id: string): string {
  return `https://keeb-on.studio/layout?g=${encodeURIComponent(id)}`;
}

/** The id in such an address, if the page was opened with one. */
export function linkedLayoutId(search: string): string | null {
  const id = new URLSearchParams(search).get("g");
  return id && /^\d{14}-[a-z0-9]{8,32}$/.test(id) ? id : null;
}
