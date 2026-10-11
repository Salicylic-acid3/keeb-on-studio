/**
 * Signing in with GitHub, for the layout editor's "save to my Gists".
 *
 * GitHub hands a web page a one-time code, and only trades it for a token
 * when the request also carries the app's client secret -- which a page
 * cannot hold. This is the one step that needs a server: the Worker adds
 * the secret and passes the token back. Everything after that (listing,
 * reading and writing Gists) goes straight from the browser to GitHub, and
 * the token is never stored here.
 *
 * It needs a GitHub OAuth App (see worker/README.md); until its id and
 * secret are set, the editor says saving to Gists is not set up.
 */
export interface GithubEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; error: "not-configured" | "bad-code" | "unreachable" };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Trade the one-time code GitHub gave the page for an access token. */
export async function exchangeCode(
  env: GithubEnv,
  code: unknown,
  fetcher: Fetch,
): Promise<TokenResult> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
    return { ok: false, error: "not-configured" };
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(code))
    return { ok: false, error: "bad-code" };
  let response: Response;
  try {
    response = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
  } catch {
    return { ok: false, error: "unreachable" };
  }
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
  } | null;
  return typeof body?.access_token === "string" && body.access_token
    ? { ok: true, token: body.access_token }
    : { ok: false, error: "bad-code" };
}
