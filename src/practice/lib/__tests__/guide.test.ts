import { testBoard } from "../../../keyTest/lib/boards";
import {
  applyChanges,
  orderedSymbolSlots,
  proposeDuplicates,
  recommendThumbs,
  reviewKeys,
  thumbsLeftToRight,
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
    const first = orderedSymbolSlots(board, meta)[0];
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

  it("orders the symbol slots from the home row outward and keeps brackets together", () => {
    const slots = orderedSymbolSlots(board, meta);
    // The key beside L comes first.
    const l = board.keys.findIndex((k) => k.label.main === "L");
    const besideL = board.keys.findIndex(
      (k, i) =>
        i !== l &&
        Math.abs(k.cy - board.keys[l].cy) < 0.3 &&
        k.cx > board.keys[l].cx &&
        k.cx - board.keys[l].cx < 1.2,
    );
    expect(slots[0]).toBe(besideL);
    // Brackets side by side, on a keyboard that has neighbouring slots.
    const b = testBoard("insixty_en")!;
    const m = keyboardMeta(b);
    const km = keymapOf(b);
    const p = proposeSymbols(
      b,
      m,
      km,
      { ...DEFAULT_ANSWERS, symbols: ["[", "]", "-", ":", ";"] },
      "us",
    );
    const after = boardWith(b, applyChanges(km, p.changes), "us");
    const placed = (ch: string) =>
      p.changes.find((c) => after.keys[c.pos].label.main === ch)!.pos;
    const open = placed("[");
    const close = placed("]");
    expect(open).toBeGreaterThanOrEqual(0);
    expect(Math.abs(after.keys[open].cy - after.keys[close].cy)).toBeLessThan(
      0.3,
    );
    expect(after.keys[close].cx).toBeGreaterThan(after.keys[open].cx);
  });

  it("reviews CapsLock and a modifier doubled by a replacement", () => {
    const b = testBoard("goforty_jp")!;
    const km = keymapOf(b);
    const before = reviewKeys(km, DEFAULT_ANSWERS, "jis");
    const caps = before.find((r) => r.reason === "capslock");
    expect(caps).toBeDefined();
    const answers = {
      ...DEFAULT_ANSWERS,
      replace: { [String(caps!.pos)]: "ControlLeft" },
    };
    const after = reviewKeys(km, answers, "jis");
    // The CapsLock (now a Ctrl) and the corner Ctrl both come up.
    expect(after.filter((r) => r.reason === "doubled").length).toBe(1);
    expect(after.filter((r) => r.reason === "capslock").length).toBe(1);
    const p = proposeDuplicates(km, answers);
    expect(p.changes).toHaveLength(1);
  });

  it("recommends the thumb row from Space outward and applies taps with holds", () => {
    const km = keymapOf(board);
    const space = thumbsLeftToRight(board, meta)[1].pos;
    const rec = recommendThumbs(board, meta, km, space);
    expect(rec[String(space)]).toEqual({ tap: "Space", hold: "layer" });
    const p = proposeThumbs(board, meta, km, {
      ...DEFAULT_ANSWERS,
      thumbs: rec,
    });
    const after = applyChanges(km, p.changes);
    const taps = thumbsLeftToRight(board, meta).map((th) => {
      const t = after.layers[0][th.pos];
      return t.kind === "key"
        ? `${t.code}${t.hold ? "/" + t.hold : ""}${t.holdLayer !== undefined ? "/L" : ""}`
        : "?";
    });
    expect(taps).toEqual([
      "NonConvert/MetaLeft",
      "Space/L",
      "Backspace",
      "Delete",
      "Enter/L",
      "Convert/AltLeft",
    ]);
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
    // The row shape; the inverted T is the default.
    const p = proposeOneHand(
      board,
      meta,
      km,
      { ...DEFAULT_ANSWERS, cursorShape: "row", navKeys: true },
      "us",
    );
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
    // By default the numbers go on the other thumb's layer; the F keys
    // only once given a layer.
    const keys = thumbLayerKeys(meta, km);
    const layerOf = (hand: "L" | "R") =>
      keys.find((k) => k.hand === hand)!.layer;
    const other = proposeOther(
      board,
      meta,
      km,
      { ...DEFAULT_ANSWERS, otherHand: { fkeys: layerOf("R") } },
      "us",
    );
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
