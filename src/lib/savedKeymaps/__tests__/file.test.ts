/**
 * The reader takes files that arrived over Discord, so these are mostly about
 * what it does with input that is not a keymap.
 */
import {
  FILE_FORMAT,
  FILE_FORMAT_VERSION,
  MAX_FILE_BYTES,
  fileNameFor,
  parseFile,
  serialize,
  toFile,
} from "../file";
import { SAVED_KEYMAP_SCHEMA_VERSION, type SavedKeymapPayload } from "../types";

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
  fromDemo: true,
};

function withKeymap(patch: Record<string, unknown>): string {
  return JSON.stringify({
    format: FILE_FORMAT,
    formatVersion: FILE_FORMAT_VERSION,
    exportedAt: "2026-09-10T00:00:00.000Z",
    keymap: { ...KEYMAP, ...patch },
  });
}

describe("round trip", () => {
  it("reads back what it wrote", () => {
    const result = parseFile(serialize(KEYMAP));
    expect(result).toEqual({ ok: true, keymap: KEYMAP });
  });

  it("stamps the format so a reader can recognise it", () => {
    const file = toFile(KEYMAP);
    expect(file.format).toBe(FILE_FORMAT);
    expect(file.formatVersion).toBe(FILE_FORMAT_VERSION);
    expect(Date.parse(file.exportedAt)).not.toBeNaN();
  });
});

describe("filenames", () => {
  it("keeps a Japanese name", () => {
    expect(fileNameFor("温泉街配列")).toBe("温泉街配列.keeb-on.json");
  });

  it("drops characters filesystems reject", () => {
    expect(fileNameFor('a/b:c*d?e"f<g>h|i')).toBe("abcdefghi.keeb-on.json");
  });

  it("falls back when nothing usable is left", () => {
    expect(fileNameFor("///")).toBe("keymap.keeb-on.json");
    expect(fileNameFor("   ")).toBe("keymap.keeb-on.json");
  });
});

describe("refusing what is not a keymap", () => {
  it("refuses input that is not JSON", () => {
    expect(parseFile("not json at all")).toEqual({
      ok: false,
      reason: "not-json",
    });
  });

  it("refuses JSON that is some other document", () => {
    expect(parseFile(JSON.stringify({ hello: "world" }))).toEqual({
      ok: false,
      reason: "not-a-keymap",
    });
  });

  it("refuses a file from a newer app rather than guessing at it", () => {
    const newer = JSON.stringify({
      format: FILE_FORMAT,
      formatVersion: FILE_FORMAT_VERSION + 1,
      exportedAt: "",
      keymap: KEYMAP,
    });
    expect(parseFile(newer)).toEqual({ ok: false, reason: "newer-format" });

    expect(
      parseFile(withKeymap({ schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION + 1 })),
    ).toEqual({ ok: false, reason: "newer-format" });
  });

  it("refuses a file too big to be a keymap", () => {
    expect(parseFile("x".repeat(MAX_FILE_BYTES + 1))).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it.each([
    ["target", { target: { layoutName: "x" } }],
    ["target", { target: { layoutName: "x", keyCount: -1 } }],
    ["name", { name: 42 }],
    ["description", { description: null }],
    ["behaviors", { behaviors: [1, 2] }],
    ["layers", { layers: "nope" }],
    ["layers", { layers: [{ name: "Base", bindings: [[0, 0]] }] }],
    ["layers", { layers: [{ name: "Base", bindings: [["a", 0, 0]] }] }],
    ["layers", { layers: [{ bindings: [] }] }],
  ])("refuses a malformed %s", (field, patch) => {
    const result = parseFile(withKeymap(patch));
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "malformed", field });
  });

  it("refuses a binding pointing past the behavior table", () => {
    // Left alone, this would silently blank a key on load.
    const result = parseFile(
      withKeymap({ layers: [{ name: "Base", bindings: [[9, 0, 0]] }] }),
    );
    expect(result).toMatchObject({ reason: "malformed", field: "behaviors" });
  });
});

describe("not trusting the file's own claims", () => {
  it("re-applies the text caps", () => {
    const result = parseFile(
      withKeymap({ name: "n".repeat(500), description: "d".repeat(2000) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keymap.name.length).toBeLessThanOrEqual(60);
    expect(result.keymap.description.length).toBeLessThanOrEqual(280);
  });

  it("treats a non-boolean fromDemo as false", () => {
    const result = parseFile(withKeymap({ fromDemo: "yes" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keymap.fromDemo).toBe(false);
  });
});
