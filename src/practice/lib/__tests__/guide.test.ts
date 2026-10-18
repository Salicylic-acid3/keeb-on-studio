import { testBoard } from "../../../keyTest/lib/boards";
import {
  applyChanges,
  boardWith,
  DEFAULT_ANSWERS,
  keymapOf,
  proposeLayerKeys,
  proposeOneHand,
  proposeOther,
  proposeRare,
  proposeSymbols,
  proposeThumbs,
  suggestedLayerKeys,
  thumbLayerKeys,
  triggerForChar,
} from "../guide";
import { keyboardMeta } from "../metadata";

const board = testBoard("goforty_max_ortho")!;
const meta = keyboardMeta(board);
const label = (b: typeof board, pos: number) => b.keys[pos].label.main;

describe("guide proposals on GoFortyMax Ortho", () => {
  it("round-trips the default keymap through the working keymap", () => {
    const km = keymapOf(board);
    expect(km.layers.length).toBeGreaterThanOrEqual(1);
    const back = boardWith(board, km, "us");
    board.keys.forEach((k, i) => {
      expect(back.keys[i].label.main).toBe(k.label.main);
      expect(back.keys[i].onLayers?.length ?? 0).toBe(k.onLayers?.length ?? 0);
    });
  });

  it("puts the most used symbols into the symbol slots", () => {
    const km = keymapOf(board);
    const answers = { ...DEFAULT_ANSWERS, symbols: [":", "-", "/", ";", "'"] };
    const p = proposeSymbols(board, meta, km, answers, "us");
    expect(p.changes.length).toBeGreaterThan(0);
    const after = boardWith(board, applyChanges(km, p.changes), "us");
    const first = meta.symbolSlots[0];
    // ":" is Shift+; on a US layout, shown as ":".
    expect(label(after, first)).toBe(":");
  });

  it("knows which key types a character on each OS layout", () => {
    expect(triggerForChar(":", "us")).toMatchObject({
      code: "Semicolon",
      mods: ["shift"],
    });
    expect(triggerForChar(":", "jis")).toMatchObject({
      code: "Quote",
      mods: [],
    });
    expect(triggerForChar("a", "us")).toMatchObject({ code: "KeyA" });
    expect(triggerForChar("あ", "us")).toBeNull();
  });

  it("places Space where asked and the rest by use, nearest first", () => {
    const km = keymapOf(board);
    const space = meta.thumbKeys[1].pos;
    const p = proposeThumbs(board, meta, km, {
      ...DEFAULT_ANSWERS,
      spacePos: space,
      thumbOrder: ["Enter", "Backspace", "Delete"],
    });
    const after = boardWith(board, applyChanges(km, p.changes), "us");
    expect(label(after, space)).toBe("Space");
    const labels = meta.thumbKeys.map((t) => label(after, t.pos));
    expect(labels).toEqual(expect.arrayContaining(["Space", "Enter", "BS"]));
  });

  it("gives chosen thumb keys a hold layer and keeps their tap", () => {
    const km = keymapOf(board);
    const chosen = suggestedLayerKeys(meta, km);
    expect(chosen.length).toBeGreaterThan(0);
    const p = proposeLayerKeys(meta, km, {
      ...DEFAULT_ANSWERS,
      layerKeyPos: chosen,
    });
    const after = applyChanges(km, p.changes);
    const keys = thumbLayerKeys(meta, after);
    expect(keys.map((k) => k.pos).sort()).toEqual([...chosen].sort());
    for (const k of keys) {
      const t = after.layers[0][k.pos];
      expect(t.kind === "key" && t.code).toMatch(/Space|Enter/);
    }
  });

  it("puts the cursor on the right hand's home row of the right thumb's layer", () => {
    let km = keymapOf(board);
    km = applyChanges(
      km,
      proposeLayerKeys(meta, km, {
        ...DEFAULT_ANSWERS,
        layerKeyPos: suggestedLayerKeys(meta, km),
      }).changes,
    );
    const p = proposeOneHand(board, meta, km, DEFAULT_ANSWERS, "us");
    const right = thumbLayerKeys(meta, km).find((k) => k.hand === "R")!;
    const after = boardWith(board, applyChanges(km, p.changes), "us");
    const homeLabels = meta.homeRow.R.map(
      (pos) =>
        after.keys[pos].onLayers?.find((o) => o.layer === right.layer)?.trigger,
    );
    expect(homeLabels.map((t) => t && t.kind === "key" && t.code)).toEqual([
      "ArrowLeft",
      "ArrowDown",
      "ArrowUp",
      "ArrowRight",
    ]);
  });

  it("puts a numpad and the F keys on the other layer, and rare keys after", () => {
    let km = keymapOf(board);
    km = applyChanges(
      km,
      proposeLayerKeys(meta, km, {
        ...DEFAULT_ANSWERS,
        layerKeyPos: suggestedLayerKeys(meta, km),
      }).changes,
    );
    const other = proposeOther(board, meta, km, DEFAULT_ANSWERS);
    expect(
      other.changes.some(
        (c) => c.trigger.kind === "key" && c.trigger.code === "Digit5",
      ),
    ).toBe(true);
    expect(
      other.changes.some(
        (c) => c.trigger.kind === "key" && c.trigger.code === "F5",
      ),
    ).toBe(true);
    km = applyChanges(km, other.changes);
    const rare = proposeRare(board, meta, km, DEFAULT_ANSWERS);
    expect(
      rare.changes.map((c) => c.trigger.kind === "key" && c.trigger.code),
    ).toEqual(["PrintScreen", "Insert"]);
  });
});
