import { exchangeCode } from "../github";

const ENV = { GITHUB_CLIENT_ID: "id123", GITHUB_CLIENT_SECRET: "secret456" };
// Only what exchangeCode reads of a Response (the test environment has none).
const answer = (body: unknown) => async () =>
  ({ json: async () => body }) as unknown as Response;

describe("signing in with GitHub", () => {
  it("says so when the OAuth app is not set up", async () => {
    const fetcher = jest.fn();
    expect(await exchangeCode({}, "abcdefgh1234", fetcher)).toEqual({
      ok: false,
      error: "not-configured",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses what cannot be a code without asking GitHub", async () => {
    const fetcher = jest.fn();
    for (const code of [undefined, 12, "", "a b", "x".repeat(200)]) {
      expect(await exchangeCode(ENV, code, fetcher)).toEqual({
        ok: false,
        error: "bad-code",
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the code with the app's secret and returns the token", async () => {
    const fetcher = jest.fn(answer({ access_token: "gho_token" }));
    expect(await exchangeCode(ENV, "abcdefgh1234", fetcher)).toEqual({
      ok: true,
      token: "gho_token",
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: "id123",
      client_secret: "secret456",
      code: "abcdefgh1234",
    });
  });

  it("reports a code GitHub turned down, and GitHub being out of reach", async () => {
    expect(
      await exchangeCode(
        ENV,
        "abcdefgh1234",
        answer({ error: "bad_verification_code" }),
      ),
    ).toEqual({ ok: false, error: "bad-code" });
    expect(
      await exchangeCode(ENV, "abcdefgh1234", async () => {
        throw new Error("down");
      }),
    ).toEqual({ ok: false, error: "unreachable" });
  });
});
