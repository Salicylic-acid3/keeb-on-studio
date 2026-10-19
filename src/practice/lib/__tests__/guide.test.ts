import { testBoard } from "../../../keyTest/lib/boards";
import type { Trigger } from "../../../keyTest/lib/triggers";
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
  placeContent,
  proposeThumbs,
  suggestedLayerKeys,
  symbolColumns,
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
    const rec = recommendThumbs(board, meta);
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
      { ...DEFAULT_ANSWERS, cursorShape: "row", cursorAround: "nav" },
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
    const rare = proposeRare(board, meta, km, {
      ...DEFAULT_ANSWERS,
      rare: ["PrintScreen", "Insert"],
    });
    expect(
      rare.changes.map((c) => c.trigger.kind === "key" && c.trigger.code),
    ).toEqual(["PrintScreen", "Insert"]);
  });

  it("leaves Delete out of the recommended row on a five-thumb keyboard", () => {
    const b = testBoard("goforty_jp")!;
    const m = keyboardMeta(b);
    const rec = recommendThumbs(b, m);
    const taps = Object.values(rec).map((a) => a.tap);
    expect(taps).toContain("Backspace");
    expect(taps).toContain("Enter");
    expect(taps).not.toContain("Delete");
  });

  it("lays the symbol grid from the hand's outer edge: ! on Q, # on A, \" left of A", () => {
    const km = keymapOf(board);
    const left =
      thumbLayerKeys(meta, km).find((k) => k.hand === "L") ??
      thumbLayerKeys(meta, km)[0];
    const layer = left.layer;
    const changes = placeContent(
      board,
      meta,
      layer,
      "L",
      "symbols",
      DEFAULT_ANSWERS,
      "us",
    );
    const after = boardWith(board, applyChanges(km, changes), "us");
    const on = (pos: number) =>
      after.keys[pos].onLayers?.find((o) => o.layer === layer)?.trigger;
    const byLabel = (l: string) =>
      board.keys.findIndex((k) => k.label.main === l);
    expect(symbolColumns(board, meta, "L")).toHaveLength(6);
    expect(on(byLabel("A"))).toMatchObject({ code: "Digit3", mods: ["shift"] });
    expect(on(byLabel("Q"))).toMatchObject({ code: "Digit1", mods: ["shift"] });
    expect(on(byLabel("T"))).toMatchObject({
      code: "Backquote",
      mods: ["shift"],
    });
    expect(on(byLabel("G"))).toMatchObject({ code: "Digit2", mods: ["shift"] });
    expect(on(byLabel("B"))).toMatchObject({
      code: "Backslash",
      mods: ["shift"],
    });
    // The modifier column: " left of A, ' left of Z, nothing above it.
    expect(on(byLabel("Ctrl"))).toMatchObject({
      code: "Quote",
      mods: ["shift"],
    });
    expect(on(byLabel("Shift"))).toMatchObject({ code: "Quote", mods: [] });
    expect(on(byLabel("Tab"))).toBeUndefined();
    expect(changes.length).toBe(17);
  });

  it("drops the grid's outer column on a hand with five columns", () => {
    const b = testBoard("bethirty_ortho")!;
    const m = keyboardMeta(b);
    const cols = symbolColumns(b, m, "L");
    expect(cols.length).toBeLessThanOrEqual(5);
    const changes = placeContent(
      b,
      m,
      1,
      "L",
      "symbols",
      DEFAULT_ANSWERS,
      "us",
    );
    const q = b.keys.findIndex((k) => k.label.main === "Q");
    const a = b.keys.findIndex((k) => k.label.main === "A");
    const at = (pos: number) => changes.find((c) => c.pos === pos)?.trigger;
    expect(at(q)).toMatchObject({ code: "Digit1", mods: ["shift"] });
    expect(at(a)).toMatchObject({ code: "Digit3", mods: ["shift"] });
  });

  it("keeps the middle of seven thumb keys as it is", () => {
    const b = testBoard("clickboard_ortho")!;
    const m = keyboardMeta(b);
    const row = thumbsLeftToRight(b, m);
    expect(row).toHaveLength(7);
    const rec = recommendThumbs(b, m);
    expect(row.map((th) => rec[String(th.pos)].tap)).toEqual([
      "NonConvert",
      "Space",
      "Backspace",
      "keep",
      "Delete",
      "Enter",
      "Convert",
    ]);
  });

  it("suggests no occasional keys unless picked, and puts picked ones away from the home row", () => {
    let km = keymapOf(board);
    km = applyChanges(
      km,
      proposeLayerKeys(meta, km, {
        ...DEFAULT_ANSWERS,
        layerKeyPos: suggestedLayerKeys(meta, km),
      }).changes,
    );
    expect(proposeRare(board, meta, km, DEFAULT_ANSWERS).changes).toEqual([]);
    const p = proposeRare(board, meta, km, {
      ...DEFAULT_ANSWERS,
      rare: ["PrintScreen"],
    });
    expect(p.changes).toHaveLength(1);
    const pos = p.changes[0].pos;
    const home = meta.homeRow.L[0];
    expect(
      Math.hypot(
        board.keys[pos].cx - board.keys[home].cx,
        board.keys[pos].cy - board.keys[home].cy,
      ),
    ).toBeGreaterThan(3);
  });

  it("lays the numpad with 0 under the index finger and * - + on the little finger's column", () => {
    const byLabel = (l: string) =>
      board.keys.findIndex((k) => k.label.main === l);
    const at = (changes: ReturnType<typeof placeContent>, l: string) =>
      changes.find((c) => c.pos === byLabel(l))?.trigger;
    const right = placeContent(
      board,
      meta,
      2,
      "R",
      "digits",
      DEFAULT_ANSWERS,
      "us",
    );
    expect(at(right, "N")).toMatchObject({ code: "Digit0" });
    expect(at(right, "J")).toMatchObject({ code: "Digit4" });
    expect(at(right, "M")).toMatchObject({ code: "Digit1" });
    expect(at(right, "U")).toMatchObject({ code: "Digit7" });
    expect(at(right, "P")).toMatchObject({ code: "Digit8", mods: ["shift"] });
    const left = placeContent(
      board,
      meta,
      2,
      "L",
      "digits",
      DEFAULT_ANSWERS,
      "us",
    );
    expect(at(left, "B")).toMatchObject({ code: "Digit0" });
    expect(at(left, "X")).toMatchObject({ code: "Digit1" });
    expect(at(left, "S")).toMatchObject({ code: "Digit4" });
    expect(at(left, "W")).toMatchObject({ code: "Digit7" });
    expect(at(left, "Q")).toMatchObject({ code: "Digit8", mods: ["shift"] });
    expect(at(left, "A")).toMatchObject({ code: "Minus", mods: [] });
    expect(at(left, "Z")).toMatchObject({ code: "Equal", mods: ["shift"] });
  });

  it("blocks the keys around the cursor keys even on an empty layer, and shows them as None", () => {
    let km = keymapOf(board);
    km = applyChanges(
      km,
      proposeLayerKeys(meta, km, {
        ...DEFAULT_ANSWERS,
        layerKeyPos: suggestedLayerKeys(meta, km),
      }).changes,
    );
    const p = proposeOneHand(
      board,
      meta,
      km,
      { ...DEFAULT_ANSWERS, cursorAround: "none" },
      "us",
    );
    const blocked = p.changes.filter(
      (c) => c.trigger.kind === "none" && c.trigger.blocked,
    );
    expect(blocked.length).toBeGreaterThan(0);
    const after = boardWith(board, applyChanges(km, p.changes), "us");
    const one = after.keys[blocked[0].pos];
    expect(one.onLayers?.some((o) => o.trigger.kind === "none")).toBe(true);
  });

  it("gives a layer to one kind of content per side", () => {
    let km = keymapOf(board);
    km = applyChanges(
      km,
      proposeLayerKeys(meta, km, {
        ...DEFAULT_ANSWERS,
        layerKeyPos: suggestedLayerKeys(meta, km),
      }).changes,
    );
    const right = thumbLayerKeys(meta, km).find((k) => k.hand === "R")!;
    const p = proposeOneHand(
      board,
      meta,
      km,
      {
        ...DEFAULT_ANSWERS,
        oneHand: { cursor: right.layer, digits: right.layer },
      },
      "us",
    );
    expect(
      p.changes.some(
        (c) => c.trigger.kind === "key" && c.trigger.code === "ArrowLeft",
      ),
    ).toBe(true);
    expect(
      p.changes.some(
        (c) => c.trigger.kind === "key" && /^Digit/.test(c.trigger.code),
      ),
    ).toBe(false);
  });

  it("hands out empty layers first and stops at the keymap's layer limit", () => {
    // A block of four: base and three more, all empty and unreached.
    // No layer key on the base yet, so every hold needs a layer.
    const base = keymapOf(board).layers[0].map((t): Trigger => {
      if (t.kind !== "key" || t.holdLayer === undefined) return t;
      const { holdLayer: _h, ...rest } = t;
      void _h;
      return rest;
    });
    const empty = () => base.map((): Trigger => ({ kind: "none" }));
    const km = { layers: [base, empty(), empty(), empty()], maxLayers: 4 };
    const thumbs = thumbsLeftToRight(board, meta);
    const answers = {
      ...DEFAULT_ANSWERS,
      thumbs: Object.fromEntries(
        thumbs.map((th, i) => [
          String(th.pos),
          {
            tap: ["Space", "Enter", "Backspace", "Delete"][i % 4],
            hold: "layer" as const,
          },
        ]),
      ),
    };
    const p = proposeThumbs(board, meta, km, answers);
    const holds = p.changes
      .map((c) => (c.trigger.kind === "key" ? c.trigger.holdLayer : undefined))
      .filter((l): l is number => l !== undefined);
    // Three layers to give out, in the block, none beyond it.
    expect(holds.sort()).toEqual([1, 2, 3]);
    expect(p.note).toBe("layers-full");
  });
});
