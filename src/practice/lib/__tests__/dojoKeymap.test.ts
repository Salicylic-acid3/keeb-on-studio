import { testBoard } from "../../../keyTest/lib/boards";
import {
  createMemoryBackend,
  type SavedKeymapPayload,
  type SavedKeymapStore,
} from "../../../lib/savedKeymaps";
import type { QmkKeymapPayload } from "../../../qmk/lib/savedQmkKeymap";
import { keycodeToText } from "../../../qmk/lib/keycodes/qmkKeycode";
import { DOJO_KEYMAP_NAME, dojoRecord, saveDojoKeymap } from "../dojoKeymap";
import type { Change } from "../guide";

const memoryStores = new Map<string, SavedKeymapStore>();
const storeFor = (dbName = "zmk"): SavedKeymapStore => {
  let s = memoryStores.get(dbName);
  if (!s) {
    s = { ...createMemoryBackend(), isDurable: false };
    memoryStores.set(dbName, s);
  }
  return s;
};

describe("the dojo keymap in the remapper's keymaps", () => {
  it("keeps a ZMK keyboard's whole keymap, the guide's keys by behavior name, the rest by their text", () => {
    const board = testBoard("goforty_max_ortho")!;
    const a = board.keys.findIndex((k) => k.label.main === "A");
    const bt = board.keys.findIndex((k) => k.label.main === "BT");
    const changes: Change[] = [
      { layer: 0, pos: a, trigger: { kind: "key", code: "KeyB", mods: [] } },
      {
        layer: 2,
        pos: a,
        trigger: { kind: "key", code: "Digit1", mods: ["shift"] },
      },
    ];
    const r = dojoRecord(board, changes)!;
    expect(r.firmware).toBe("zmk");
    const p = r.payload as SavedKeymapPayload;
    expect(p.name).toBe(DOJO_KEYMAP_NAME);
    expect(p.fromDemo).toBe(true);
    expect(p.target).toEqual({
      layoutName: "GoFortyMax Ortho",
      keyCount: board.keys.length,
    });
    // Every default layer is there, not only the ones the guide reaches.
    expect(p.layers.length).toBeGreaterThanOrEqual(5);
    const name = (layer: number, pos: number) =>
      p.behaviors[p.layers[layer].bindings[pos][0]];
    expect(name(0, a)).toBe("Key Press");
    expect(p.layers[0].bindings[a][1]).toBe(0x70005); // B, with its page
    expect(name(2, a)).toBe("Key Press");
    // A Bluetooth key is not the guide's: kept by its own binding text,
    // which no keyboard resolves, so loading leaves the key alone.
    expect(name(0, bt)).toMatch(/^bt /);
    expect(r.skipped).toBe(0);
  });

  it("keeps a QMK keyboard's keymap as a .vil by matrix position", () => {
    const board = testBoard("goforty_jp")!;
    const q = board.keys.findIndex((k) => k.label.main === "Q");
    const r = dojoRecord(board, [
      { layer: 1, pos: q, trigger: { kind: "key", code: "F5", mods: [] } },
    ])!;
    expect(r.firmware).toBe("qmk");
    const p = r.payload as QmkKeymapPayload;
    expect(p.board).toBe("goforty_jp");
    expect(p.name).toBe(DOJO_KEYMAP_NAME);
    const layout = p.vil.layout as string[][][];
    expect(layout.length).toBe(12);
    // Q is matrix 0,1 on the GoForty JP.
    expect(layout[0][0][1]).toBe("KC_Q");
    expect(layout[1][0][1]).toBe("KC_F5");
    expect(keycodeToText(0x3e)).toBe("KC_F5");
  });

  it("saves one record per keyboard, replacing the earlier one", async () => {
    const board = testBoard("goforty_max_ortho")!;
    const a = board.keys.findIndex((k) => k.label.main === "A");
    await saveDojoKeymap(
      board,
      [{ layer: 0, pos: a, trigger: { kind: "key", code: "KeyB", mods: [] } }],
      storeFor,
    );
    await saveDojoKeymap(
      board,
      [{ layer: 0, pos: a, trigger: { kind: "key", code: "KeyC", mods: [] } }],
      storeFor,
    );
    const rows = await storeFor().list();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(DOJO_KEYMAP_NAME);
    expect(rows[0].layers[0].bindings[a][1]).toBe(0x70006); // C
    // Another keyboard gets its own.
    const other = testBoard("clickboard_ergotrack")!;
    await saveDojoKeymap(other, [], storeFor);
    expect(await storeFor().list()).toHaveLength(2);
  });
});
