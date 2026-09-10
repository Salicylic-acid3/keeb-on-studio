/**
 * The Worker in front of Keeb-On! Studio.
 *
 * Everything except `/api/*` is the built app, served straight from the assets
 * binding. The API is the keymap gallery and nothing else.
 *
 * There is deliberately no CORS header anywhere here. The gallery is used by
 * the page it ships with, which is the same origin, so allowing other origins
 * would only widen who can write to it. Write requests additionally have to
 * carry a same-origin `Origin`, which costs nothing and turns a drive-by form
 * post into a 403.
 */
import {
  deletePost,
  getPost,
  listPosts,
  publish,
  reportPost,
  MAX_POST_BYTES,
  POSTS_PER_AUTHOR,
  type GalleryStore,
} from "./gallery";

export interface Env {
  ASSETS: Fetcher;
  GALLERY: KVNamespace;
  /**
   * Deletes anything, so that a reported keymap can actually be taken down.
   * Set with `wrangler secret put GALLERY_MAINTAINER_TOKEN`; when it is unset
   * no request is ever treated as the maintainer.
   */
  GALLERY_MAINTAINER_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The gallery changes when someone posts; a cached list would show a
      // keymap that has been reported and hidden.
      "cache-control": "no-store",
    },
  });
}

/** True when the request came from the page this Worker itself serves. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // A same-origin fetch may omit Origin entirely; a cross-site one may not.
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function isMaintainer(request: Request, env: Env): boolean {
  const expected = env.GALLERY_MAINTAINER_TOKEN;
  if (!expected) return false;
  const offered = request.headers.get("authorization");
  if (!offered?.startsWith("Bearer ")) return false;
  const given = offered.slice("Bearer ".length);
  // Length first, then a constant-time compare, so the check does not leak the
  // token one character at a time through timing.
  if (given.length !== expected.length) return false;
  let differences = 0;
  for (let i = 0; i < given.length; i++) {
    differences |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return differences === 0;
}

function storeFor(env: Env): GalleryStore {
  return {
    kv: env.GALLERY,
    now: () => Date.now(),
    randomId: () =>
      [...crypto.getRandomValues(new Uint8Array(8))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  };
}

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (!env.GALLERY) {
    // Deployed without the namespace bound. Say so rather than throwing a 500
    // that looks like the gallery is broken for everyone.
    return json({ error: "gallery-not-configured" }, 503);
  }

  const store = storeFor(env);
  const path = url.pathname.replace(/^\/api\/gallery\/?/, "");
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "") {
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const page = await listPosts(store, cursor);
    return json(page);
  }

  if (method === "GET" && path) {
    const post = await getPost(store, path);
    if (!post) return json({ error: "not-found" }, 404);
    return json(post);
  }

  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  if (method === "POST" && path === "") {
    const raw = await request.text();
    if (raw.length > MAX_POST_BYTES) {
      return json({ error: "too-large" }, 413);
    }
    let envelope: { keymap?: unknown; author?: unknown; board?: unknown };
    try {
      envelope = JSON.parse(raw);
    } catch {
      return json({ error: "not-a-keymap" }, 400);
    }
    const result = await publish(store, {
      // The keymap travels as text so it reaches the reader byte for byte --
      // the same bytes a file would have, checked the same way.
      text: JSON.stringify(envelope.keymap ?? null),
      author: envelope.author,
      board: envelope.board,
    });
    if (!result.ok) {
      // The quota is the one refusal where the number is the explanation, so
      // it is the only one that carries it.
      return result.reason === "quota"
        ? json({ error: result.reason, limit: POSTS_PER_AUTHOR }, 409)
        : json({ error: result.reason }, 400);
    }
    return json({ id: result.id, card: result.card }, 201);
  }

  if (method === "POST" && path.endsWith("/report")) {
    const id = path.slice(0, -"/report".length);
    const body = (await request.json().catch(() => ({}))) as {
      author?: unknown;
    };
    const outcome = await reportPost(store, id, body.author);
    if (outcome === "invalid") return json({ error: "invalid" }, 400);
    if (outcome === "unknown") return json({ error: "not-found" }, 404);
    return json({ outcome });
  }

  if (method === "DELETE" && path) {
    const body = (await request.json().catch(() => ({}))) as {
      author?: unknown;
    };
    const outcome = await deletePost(
      store,
      path,
      body.author,
      isMaintainer(request, env),
    );
    if (outcome === "invalid") return json({ error: "invalid" }, 400);
    if (outcome === "unknown") return json({ error: "not-found" }, 404);
    if (outcome === "not-yours") return json({ error: "not-yours" }, 403);
    return json({ outcome });
  }

  return json({ error: "not-found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/gallery")) {
      return handleApi(request, env, url);
    }
    // Everything else is the app. `run_worker_first` in wrangler.toml keeps
    // this Worker off the path of ordinary asset requests entirely; this is
    // the fallback for anything that still arrives here.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
