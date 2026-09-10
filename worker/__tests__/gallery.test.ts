/**
 * The gallery is a public store anyone can write to, so most of this is about
 * what it refuses and what it costs. The rest is ordering, which in KV is not
 * a query but a property of the keys -- if that breaks, the gallery silently
 * shows the oldest keymaps first and nobody notices for a month.
 */
import {
  MAX_POST_BYTES,
  POSTS_PER_AUTHOR,
  REPORTS_TO_HIDE,
  deletePost,
  getPost,
  listPosts,
  makeId,
  publish,
  reportPost,
  type GalleryStore,
} from "../gallery";
import { serialize } from "../../src/lib/savedKeymaps/file";
import {
  SAVED_KEYMAP_SCHEMA_VERSION,
  type SavedKeymapPayload,
} from "../../src/lib/savedKeymaps/types";
import { FakeKV } from "../testing/fakeKv";

const AUTHOR = "abcdefghijklmnop-1234";
const OTHER_AUTHOR = "zyxwvutsrqponmlk-9876";

function keymap(overrides: Partial<SavedKeymapPayload> = {}): string {
  return serialize({
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
    ...overrides,
  });
}

function makeStore(): { store: GalleryStore; kv: FakeKV } {
  const kv = new FakeKV();
  let tick = 0;
  let clock = 1_700_000_000_000;
  const store: GalleryStore = {
    kv,
    now: () => (clock += 1000),
    randomId: () => `id${String(tick++).padStart(6, "0")}`,
  };
  return { store, kv };
}

async function post(store: GalleryStore, text = keymap(), author = AUTHOR) {
  return publish(store, { text, author, board: "ergotrack" });
}

describe("publishing", () => {
  it("accepts a keymap from a supported keyboard", async () => {
    const { store } = makeStore();
    const result = await post(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card).toMatchObject({
      name: "温泉街配列",
      layout: "ClickBoard ErgoTrack",
      board: "ergotrack",
      layers: 1,
      keys: 2,
    });
  });

  it("refuses a keyboard this app is not for", async () => {
    const { store } = makeStore();
    await expect(
      publish(store, {
        text: keymap(),
        author: AUTHOR,
        board: "some-other-keyboard",
      }),
    ).resolves.toEqual({ ok: false, reason: "unsupported-board" });
  });

  it("puts a post through the same reader a file goes through", async () => {
    const { store } = makeStore();
    // Well-formed JSON, not a keymap. If this ever gets in, the gallery has a
    // second, weaker validator -- which is the thing the design avoids.
    await expect(
      publish(store, {
        text: JSON.stringify({ hello: "world" }),
        author: AUTHOR,
        board: "ergotrack",
      }),
    ).resolves.toEqual({ ok: false, reason: "not-a-keymap" });
  });

  it("refuses a post too big to be a keymap", async () => {
    const { store } = makeStore();
    await expect(
      publish(store, {
        text: "x".repeat(MAX_POST_BYTES + 1),
        author: AUTHOR,
        board: "ergotrack",
      }),
    ).resolves.toEqual({ ok: false, reason: "too-large" });
  });

  it.each([
    { what: "empty", author: "" },
    { what: "too short to be random", author: "short" },
    { what: "not a string at all", author: 42 },
  ])("refuses an author token that is $what", async ({ author }) => {
    const { store } = makeStore();
    await expect(
      publish(store, { text: keymap(), author, board: "ergotrack" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-author" });
  });

  it("stops one author at their quota", async () => {
    const { store } = makeStore();
    for (let i = 0; i < POSTS_PER_AUTHOR; i++) {
      expect((await post(store)).ok).toBe(true);
    }
    await expect(post(store)).resolves.toEqual({ ok: false, reason: "quota" });
    // Somebody else's quota is their own.
    expect((await post(store, keymap(), OTHER_AUTHOR)).ok).toBe(true);
  });

  it("never stores the author's token", async () => {
    const { store, kv } = makeStore();
    const result = await post(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = await kv.get(`post:${result.id}`);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(AUTHOR);
  });

  it("costs two writes", async () => {
    // Two per publish against 1,000 a day. Worth a test: an extra index would
    // halve the ceiling without anyone noticing until the day it is hit.
    const { store, kv } = makeStore();
    await post(store);
    expect(kv.writeCount()).toBe(2);
  });
});

describe("listing", () => {
  it("returns the newest first", async () => {
    const { store } = makeStore();
    await post(store, keymap({ name: "first" }));
    await post(store, keymap({ name: "second" }));
    await post(store, keymap({ name: "third" }));

    const page = await listPosts(store);
    expect(page.posts.map((p) => p.name)).toEqual(["third", "second", "first"]);
  });

  it("reads no values, only the metadata list() already returned", async () => {
    const { store, kv } = makeStore();
    for (let i = 0; i < 5; i++) await post(store, keymap({ name: `k${i}` }));

    kv.operations.length = 0;
    const page = await listPosts(store);
    expect(page.posts).toHaveLength(5);
    // One list, no gets. This is the whole reason the card lives in metadata.
    expect(kv.operations.map((o) => o.op)).toEqual(["list"]);
  });

  it("orders correctly across the second boundary of the id", () => {
    // The id is an inverted, zero-padded time. Two posts a millisecond apart
    // must still sort the right way round, and padding is what guarantees it.
    const older = makeId(1_700_000_000_000, "aaaaaaaa");
    const newer = makeId(1_700_000_000_001, "aaaaaaaa");
    expect(newer < older).toBe(true);
    expect(older).toHaveLength(newer.length);
  });
});

describe("reporting", () => {
  it("hides a post once enough different people report it", async () => {
    const { store } = makeStore();
    const result = await post(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (let i = 0; i < REPORTS_TO_HIDE; i++) {
      const outcome = await reportPost(
        store,
        result.id,
        `reporter-${i}-abcdefgh`,
      );
      expect(outcome).toBe("recorded");
    }

    expect((await listPosts(store)).posts).toHaveLength(0);
  });

  it("counts one person once, however many times they press it", async () => {
    const { store } = makeStore();
    const result = await post(store);
    if (!result.ok) return;

    expect(await reportPost(store, result.id, OTHER_AUTHOR)).toBe("recorded");
    expect(await reportPost(store, result.id, OTHER_AUTHOR)).toBe("already");
    expect(await reportPost(store, result.id, OTHER_AUTHOR)).toBe("already");

    // One determined person is not "enough people".
    expect((await listPosts(store)).posts).toHaveLength(1);
  });

  it("keeps a hidden post reachable by its own link", async () => {
    const { store } = makeStore();
    const result = await post(store);
    if (!result.ok) return;
    for (let i = 0; i < REPORTS_TO_HIDE; i++) {
      await reportPost(store, result.id, `reporter-${i}-abcdefgh`);
    }
    // Hidden means off the list, not deleted: a link someone is mid-way
    // through discussing should not break before the maintainer has looked.
    expect(await getPost(store, result.id)).not.toBeNull();
  });

  it("refuses a report against an id that is not one", async () => {
    const { store } = makeStore();
    expect(await reportPost(store, "../../etc/passwd", AUTHOR)).toBe("invalid");
    expect(await reportPost(store, "post:whatever", AUTHOR)).toBe("invalid");
  });
});

describe("deleting", () => {
  it("lets an author remove their own post, and frees their quota", async () => {
    const { store } = makeStore();
    const result = await post(store);
    if (!result.ok) return;

    expect(await deletePost(store, result.id, AUTHOR, false)).toBe("deleted");
    expect(await getPost(store, result.id)).toBeNull();
    expect((await listPosts(store)).posts).toHaveLength(0);
    // The author index went with it, or the quota would leak.
    expect((await post(store)).ok).toBe(true);
  });

  it("refuses somebody else's post", async () => {
    const { store } = makeStore();
    const result = await post(store);
    if (!result.ok) return;
    expect(await deletePost(store, result.id, OTHER_AUTHOR, false)).toBe(
      "not-yours",
    );
    expect(await getPost(store, result.id)).not.toBeNull();
  });

  it("lets the maintainer remove anything, which is what report-and-remove means", async () => {
    const { store } = makeStore();
    const result = await post(store);
    if (!result.ok) return;
    expect(await deletePost(store, result.id, undefined, true)).toBe("deleted");
    expect(await getPost(store, result.id)).toBeNull();
  });

  it("says so when there is nothing there", async () => {
    const { store } = makeStore();
    const absent = makeId(1_700_000_000_000, "aaaaaaaa");
    expect(await deletePost(store, absent, AUTHOR, false)).toBe("unknown");
  });
});

describe("fetching one", () => {
  it("gives back exactly the file that was published", async () => {
    const { store } = makeStore();
    const text = keymap();
    const result = await post(store, text);
    if (!result.ok) return;

    const found = await getPost(store, result.id);
    expect(found).not.toBeNull();
    // Byte-for-byte the same document, so the client reads it with the same
    // parser it uses for a file on disk.
    expect(found!.file).toEqual(JSON.parse(text));
  });

  it("refuses an id that is not one rather than reaching for a key", async () => {
    const { store, kv } = makeStore();
    kv.operations.length = 0;
    expect(await getPost(store, "../secrets")).toBeNull();
    expect(kv.operations).toHaveLength(0);
  });
});
