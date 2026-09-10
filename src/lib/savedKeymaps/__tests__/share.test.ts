/**
 * A shared link is a string a stranger controls, arriving through the address
 * bar. So most of this is about what the reader does with strings that are not
 * keymaps -- including ones built specifically to be expensive to read.
 */
import { FILE_FORMAT, FILE_FORMAT_VERSION, MAX_FILE_BYTES } from "../file";
import {
  MAX_SHARE_CODE_CHARS,
  SHARE_HASH_KEY,
  isShareSupported,
  parseShareCode,
  shareCodeFromHash,
  shareUrlFor,
  toShareCode,
} from "../share";
import { SAVED_KEYMAP_SCHEMA_VERSION, type SavedKeymapPayload } from "../types";

const KEYMAP: SavedKeymapPayload = {
  schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION,
  name: "温泉街配列",
  description: "親指まわりを詰めた版",
  target: { layoutName: "ClickBoard ErgoTrack", keyCount: 3 },
  behaviors: ["Key Press", "Transparent"],
  layers: [
    {
      name: "Base",
      bindings: [
        [0, 4, 0],
        [1, 0, 0],
        [0, 5, 0],
      ],
    },
  ],
  fromDemo: false,
};

/** A keymap the size of a real one: 79 keys over 8 layers. */
function ergotrackSized(): SavedKeymapPayload {
  return {
    ...KEYMAP,
    target: { layoutName: "ClickBoard ErgoTrack", keyCount: 79 },
    behaviors: [
      "Key Press",
      "Transparent",
      "None",
      "Mod-Tap 200ms",
      "Layer-Tap 200ms",
      "Momentary Layer",
    ],
    layers: Array.from({ length: 8 }, (_unused, layerIndex) => ({
      name: `Layer ${layerIndex}`,
      bindings: Array.from({ length: 79 }, (_key, keyIndex) =>
        layerIndex === 0
          ? ([0, 0x70000 + 4 + (keyIndex % 60), 0] as [number, number, number])
          : ([1, 0, 0] as [number, number, number]),
      ),
    })),
  };
}

describe("round trip", () => {
  it("is supported wherever the tests run", () => {
    expect(isShareSupported()).toBe(true);
  });

  it("reads back exactly what it wrote, Japanese text and all", async () => {
    const code = await toShareCode(KEYMAP);
    await expect(parseShareCode(code)).resolves.toEqual({
      ok: true,
      keymap: KEYMAP,
    });
  });

  it("produces a code that survives a URL untouched", async () => {
    const code = await toShareCode(KEYMAP);
    // base64url only: nothing here needs percent-encoding, so the link a chat
    // client mangles is a link that was already broken.
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(code)).toBe(code);
  });

  it("keeps a real-sized keymap short enough to paste into a chat message", async () => {
    const url = shareUrlFor(
      await toShareCode(ergotrackSized()),
      "https://keeb-on.studio/keymap",
    );
    // Discord's message limit is 2,000 characters. A link nobody can send is
    // not a share feature, so this is a guard, not a curiosity.
    expect(url.length).toBeLessThan(2000);
  });
});

describe("the fragment", () => {
  it("puts the keymap after the # so it never reaches a server", () => {
    const url = new URL(shareUrlFor("abc", "https://keeb-on.studio/keymap"));
    expect(url.hash).toBe(`#${SHARE_HASH_KEY}=abc`);
    expect(url.search).toBe("");
  });

  it("finds a code in a fragment, with or without the #", () => {
    expect(shareCodeFromHash("#k=abc")).toBe("abc");
    expect(shareCodeFromHash("k=abc")).toBe("abc");
  });

  it("ignores a fragment that carries something else", () => {
    expect(shareCodeFromHash("")).toBeNull();
    expect(shareCodeFromHash("#")).toBeNull();
    expect(shareCodeFromHash("#section-2")).toBeNull();
    expect(shareCodeFromHash("#other=abc")).toBeNull();
    expect(shareCodeFromHash("#k=")).toBeNull();
  });

  it("survives a round trip through the address bar", async () => {
    const url = new URL(
      shareUrlFor(await toShareCode(KEYMAP), "https://keeb-on.studio/keymap"),
    );
    const code = shareCodeFromHash(url.hash);
    expect(code).not.toBeNull();
    await expect(parseShareCode(code!)).resolves.toMatchObject({ ok: true });
  });
});

describe("refusing what is not a shared keymap", () => {
  it.each([
    ["empty", ""],
    ["not base64url", "hello world!"],
    ["base64url that is not deflate", "aGVsbG8gd29ybGQ"],
    ["truncated", "eJyrVkrLz1eyUkpKLAYA"],
  ])("refuses %s", async (_label, code) => {
    await expect(parseShareCode(code)).resolves.toEqual({
      ok: false,
      reason: "not-a-share-code",
    });
  });

  it("refuses a link longer than anyone could send", async () => {
    await expect(
      parseShareCode("A".repeat(MAX_SHARE_CODE_CHARS + 1)),
    ).resolves.toEqual({ ok: false, reason: "too-large" });
  });

  it("hands a well-formed code that is not a keymap to the same refusals as a file", async () => {
    const notAKeymap = await encode(JSON.stringify({ hello: "world" }));
    await expect(parseShareCode(notAKeymap)).resolves.toEqual({
      ok: false,
      reason: "not-a-keymap",
    });

    const newer = await encode(
      JSON.stringify({
        format: FILE_FORMAT,
        formatVersion: FILE_FORMAT_VERSION + 1,
        exportedAt: "",
        keymap: KEYMAP,
      }),
    );
    await expect(parseShareCode(newer)).resolves.toEqual({
      ok: false,
      reason: "newer-format",
    });

    const damaged = await encode(
      JSON.stringify({
        format: FILE_FORMAT,
        formatVersion: FILE_FORMAT_VERSION,
        exportedAt: "",
        keymap: { ...KEYMAP, layers: "nope" },
      }),
    );
    await expect(parseShareCode(damaged)).resolves.toMatchObject({
      ok: false,
      reason: "malformed",
      field: "layers",
    });
  });

  it("refuses a small code that inflates to something enormous", async () => {
    // A zip bomb: a few hundred bytes of link asking for far more memory than
    // any keymap needs. The reader has to stop while inflating, not after.
    const bomb = await encode(" ".repeat(MAX_FILE_BYTES * 4));
    // Short enough to be accepted as a link, so it really does reach the
    // inflater -- the cap on the way in cannot be what saves us here.
    expect(bomb.length).toBeLessThan(MAX_SHARE_CODE_CHARS);
    expect(bomb.length * 100).toBeLessThan(MAX_FILE_BYTES * 4);
    await expect(parseShareCode(bomb)).resolves.toEqual({
      ok: false,
      reason: "not-a-share-code",
    });
  });
});

/** Build a code from arbitrary text, the way a hostile sender would. */
async function encode(text: string): Promise<string> {
  const input = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("deflate-raw"));

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
