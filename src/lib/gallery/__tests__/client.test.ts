/**
 * The client's job is to distrust the server it talks to. The gallery is ours,
 * but the keymaps in it were written by strangers, so a fetched post has to
 * clear the same bar a file dropped on the page does.
 */
import {
  authorToken,
  fetchGalleryKeymap,
  forgetPost,
  myPostIds,
  publishToGallery,
  rememberPost,
} from "../client";
import { serialize } from "../../savedKeymaps/file";
import {
  SAVED_KEYMAP_SCHEMA_VERSION,
  type SavedKeymapPayload,
} from "../../savedKeymaps/types";

const KEYMAP: SavedKeymapPayload = {
  schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION,
  name: "温泉街配列",
  description: "親指まわりを詰めた版",
  target: { layoutName: "ClickBoard ErgoTrack", keyCount: 2 },
  behaviors: ["Key Press", "Transparent"],
  layers: [
    {
      name: "Base",
      bindings: [
        [0, 4, 0],
        [1, 0, 0],
      ],
    },
  ],
  fromDemo: false,
};

function respond(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/**
 * jsdom has no `fetch`, so there is nothing to spy on -- it is installed here
 * instead. Each test says what the gallery answers with.
 */
function mockFetch(
  answer: Response | Error,
): jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]> {
  const mock = jest.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  }) as unknown as jest.Mock<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >;
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  localStorage.clear();
});

describe("the author token", () => {
  it("is minted once and then reused", () => {
    const first = authorToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(authorToken()).toBe(first);
  });

  it("is replaced when what is stored is not one", () => {
    localStorage.setItem("keeb-on-studio-gallery-author", "!!! not a token");
    expect(authorToken()).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it("never travels in a URL", async () => {
    const fetchSpy = mockFetch(respond({ id: "x" }, 201));
    await publishToGallery(KEYMAP, "ergotrack");
    const [url, init] = fetchSpy.mock.calls[0];
    // A token in a query string ends up in logs, in Referer, and in anything
    // that copies a URL. It goes in the body.
    expect(String(url)).not.toContain(authorToken());
    expect(String((init as RequestInit).body)).toContain(authorToken());
  });
});

describe("this browser's own posts", () => {
  it("remembers and forgets them", () => {
    expect([...myPostIds()]).toEqual([]);
    rememberPost("aaa");
    rememberPost("bbb");
    expect([...myPostIds()].sort()).toEqual(["aaa", "bbb"]);
    forgetPost("aaa");
    expect([...myPostIds()]).toEqual(["bbb"]);
  });

  it("shrugs off junk in storage rather than throwing", () => {
    localStorage.setItem("keeb-on-studio-gallery-mine", "{not json");
    expect([...myPostIds()]).toEqual([]);
    localStorage.setItem("keeb-on-studio-gallery-mine", '{"a":1}');
    expect([...myPostIds()]).toEqual([]);
  });
});

describe("reading a post back", () => {
  it("accepts a keymap that checks out", async () => {
    mockFetch(respond({ file: JSON.parse(serialize(KEYMAP)) }));
    const result = await fetchGalleryKeymap("98210955520838-abcdefgh");
    expect(result).toEqual({ ok: true, value: KEYMAP });
  });

  it("refuses one that does not, however it got into the gallery", async () => {
    // The server validates on the way in. This is the second lock: a post
    // written before a schema change, or by something other than this app,
    // must not become an exception to the reader.
    mockFetch(respond({ file: { hello: "world" } }));
    await expect(
      fetchGalleryKeymap("98210955520838-abcdefgh"),
    ).resolves.toEqual({ ok: false, error: "not-a-keymap" });
  });

  it("reports a refusal by what it means, not by its status code", async () => {
    mockFetch(respond({ error: "quota", limit: 10 }, 409));
    await expect(publishToGallery(KEYMAP, "ergotrack")).resolves.toEqual({
      ok: false,
      error: "quota",
      limit: 10,
    });
  });

  it("tells a dead network apart from a refusal", async () => {
    mockFetch(new Error("nope"));
    await expect(
      fetchGalleryKeymap("98210955520838-abcdefgh"),
    ).resolves.toEqual({ ok: false, error: "offline" });
  });

  it("says so when the gallery is not set up on the server", async () => {
    mockFetch(respond({ error: "gallery-not-configured" }, 503));
    await expect(publishToGallery(KEYMAP, "ergotrack")).resolves.toEqual({
      ok: false,
      error: "not-configured",
      limit: undefined,
    });
  });
});

describe("publishing", () => {
  it("sends the keymap in the same wrapper a file uses", async () => {
    const fetchSpy = mockFetch(respond({ id: "x" }, 201));
    await publishToGallery(KEYMAP, "ergotrack");
    const body = JSON.parse(
      String((fetchSpy.mock.calls[0][1] as RequestInit).body),
    );
    expect(body.keymap.format).toBe("keeb-on-studio/keymap");
    expect(body.keymap.keymap).toEqual(KEYMAP);
    expect(body.board).toBe("ergotrack");
  });
});
