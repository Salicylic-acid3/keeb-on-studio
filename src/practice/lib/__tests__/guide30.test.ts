/**
 * The 30% guide's recipe on the two BeThirty shapes: the author's keymap
 * lands where the article puts it on the Ortho, and the QAZ, with no key
 * right of L and no centre thumb, gets the same keymap less those keys.
 */
import { labelOf, testBoard } from "../../../keyTest/lib/boards";
import type { Trigger } from "../../../keyTest/lib/triggers";
import {
  applyChanges,
  DEFAULT_ANSWERS,
  guideSteps,
  keymapOf,
  type WorkingKeymap,
} from "../guide";
import {
  anchorsOf,
  bottomRoles,
  groups30,
  layersShown30,
  propose30,
  STEPS_30,
} from "../guide30";
import { keyboardMeta } from "../metadata";

function run(id: string, answers = DEFAULT_ANSWERS, maxLayers?: number) {
  const board = testBoard(id)!;
  const meta = keyboardMeta(board);
  let km: WorkingKeymap = {
    ...keymapOf(board),
    ...(maxLayers !== undefined ? { maxLayers } : {}),
  };
  const notes: string[] = [];
  for (const step of STEPS_30) {
    const p = propose30(step, board, meta, km, answers, "us");
    if (p.note) notes.push(`${step}:${p.note}`);
    km = applyChanges(km, p.changes);
  }
  const a = anchorsOf(board, meta);
  const at = (layer: number, code: string): Trigger | undefined => {
    const pos = a.byCode(code);
    return pos === null ? undefined : km.layers[layer]?.[pos];
  };
  return { board, meta, km, at, a, notes };
}

describe("the 30% guide", () => {
  it("has its own steps, with the practice ones only on a keyboard", () => {
    expect(guideSteps(true, "30").map((s) => s.id)).toEqual([
      "intro",
      "thumbs30",
      "alpha30",
      "practice-base",
      "layer1",
      "layer2",
      "practice-layers",
      "extra30",
      "terms30",
      "practice-all",
    ]);
    expect(guideSteps(false, "30").some((s) => s.practice)).toBe(false);
    expect(guideSteps(true, "40")[1].id).toBe("symbols");
  });

  it("lays the author's keymap on the BeThirty Ortho", () => {
    const { km, at, a, notes } = run("bethirty_ortho");
    expect(notes).toEqual(["terms30:nothing"]);
    expect(km.layers).toHaveLength(5);
    // The bottom row: Enter / L2, Backspace, Space / L1 in the middle.
    const r = bottomRoles(a);
    expect(km.layers[0][r.enter!]).toEqual({
      kind: "key",
      code: "Enter",
      mods: [],
      holdLayer: 2,
    });
    expect(km.layers[0][r.centre!]).toMatchObject({ code: "Backspace" });
    expect(km.layers[0][r.space!]).toMatchObject({
      code: "Space",
      holdLayer: 1,
    });
    expect(km.layers[0][r.right[2]!]).toMatchObject({
      code: "IntlRo",
      holdLayer: 3,
    });
    // Letters with a hold; Tab on the Q key with Q on a double tap.
    expect(at(0, "KeyQ")).toEqual({
      kind: "key",
      code: "Tab",
      mods: [],
      hold: "ControlLeft",
      doubleTap: "KeyQ",
      term: 220,
    });
    expect(at(0, "KeyA")).toMatchObject({ hold: "ControlLeft", term: 180 });
    expect(at(0, "KeyZ")).toMatchObject({ code: "KeyZ", hold: "ShiftLeft" });
    expect(at(0, "Semicolon")).toMatchObject({
      code: "Minus",
      hold: "ControlRight",
    });
    expect(at(0, "ArrowUp")).toMatchObject({
      code: "Slash",
      hold: "ShiftRight",
    });
    // Layer 1: the cursor under the right hand, J being ←, and None around.
    expect(at(1, "KeyJ")).toMatchObject({ code: "ArrowLeft" });
    expect(at(1, "KeyI")).toMatchObject({ code: "ArrowUp" });
    expect(at(1, "KeyU")).toEqual({ kind: "none", blocked: true });
    expect(at(1, "KeyS")).toMatchObject({ code: "F2" });
    expect(at(1, "KeyB")).toMatchObject({ code: "F10" });
    expect(at(1, "KeyQ")).toMatchObject({ code: "Escape" });
    expect(km.layers[1][r.left[0]!]).toMatchObject({ code: "F6" });
    expect(km.layers[1][r.centre!]).toMatchObject({ code: "Delete" });
    expect(km.layers[1][r.enter!]).toMatchObject({
      code: "Enter",
      holdLayer: 4,
    });
    // Layer 2: the symbol grid in five columns, ! " ' at the bottom left.
    const sym = (code: string) => labelOf(at(2, code)!, "us").main;
    expect(["KeyW", "KeyE", "KeyR", "KeyT"].map(sym)).toEqual([
      "?",
      "[",
      "]",
      "~",
    ]);
    expect(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"].map(sym)).toEqual([
      "#",
      "$",
      "(",
      ")",
      "@",
    ]);
    expect(["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"].map(sym)).toEqual([
      "%",
      "&",
      ";",
      ":",
      "|",
    ]);
    expect(r.left.map((p) => labelOf(km.layers[2][p!], "us").main)).toEqual([
      "!",
      '"',
      "'",
    ]);
    expect(at(2, "KeyN")).toMatchObject({ code: "Digit0" });
    expect(at(2, "KeyU")).toMatchObject({ code: "Digit7" });
    expect(at(2, "Semicolon")).toMatchObject({ code: "NumpadSubtract" });
    expect(km.layers[2][r.right[2]!]).toMatchObject({ code: "NumLock" });
    // Layers 3 and 4.
    expect(at(3, "KeyT")).toMatchObject({ code: "PrintScreen" });
    expect(at(3, "KeyG")).toMatchObject({ code: "AudioVolumeUp" });
    expect(at(3, "KeyW")).toMatchObject({ code: "Tab" });
    expect(at(3, "KeyK")).toEqual({ kind: "none", blocked: true });
    expect(at(4, "KeyC")).toEqual({
      kind: "key",
      code: "KeyC",
      mods: ["ctrl"],
    });
    expect(at(4, "KeyT")).toMatchObject({ mods: ["ctrl", "shift"] });
  });

  it("fits the QAZ: no key right of L, no centre thumb, Delete beside Space", () => {
    const { km, at, a, notes } = run("bethirty_qaz");
    expect(notes).toEqual(["terms30:nothing"]);
    const r = bottomRoles(a);
    expect(r.centre).toBeNull();
    expect(a.bottom).toHaveLength(8);
    expect(km.layers[0][r.enter!]).toMatchObject({
      code: "Enter",
      holdLayer: 2,
    });
    expect(km.layers[0][r.space!]).toMatchObject({
      code: "Space",
      holdLayer: 1,
    });
    // No Backspace on the base layer; Delete right of Space on layers 1 and 2.
    expect(
      km.layers[0].some((t) => t.kind === "key" && t.code === "Backspace"),
    ).toBe(false);
    expect(km.layers[1][r.right[0]!]).toMatchObject({ code: "Delete" });
    expect(km.layers[2][r.right[0]!]).toMatchObject({ code: "Delete" });
    expect(km.layers[2][r.right[1]!]).toMatchObject({ code: "NumpadDecimal" });
    expect(km.layers[2][r.right[2]!]).toMatchObject({ code: "NumpadEnter" });
    // L holds Ctrl and the period Shift in place of the missing column.
    expect(at(0, "KeyL")).toMatchObject({ code: "KeyL", hold: "ControlRight" });
    expect(at(0, "Period")).toMatchObject({
      code: "Period",
      hold: "ShiftRight",
    });
    expect(at(1, "KeyL")).toMatchObject({ code: "ArrowRight" });
    expect(at(2, "KeyL")).toMatchObject({ code: "Digit6" });
  });

  it("leaves a group out when it is turned off, and keeps the rest", () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      thirty: { off: ["layer1:fkeys"], terms: { tab: 220, a: 180 } },
    };
    const { at } = run("bethirty_ortho", answers);
    expect(at(1, "KeyS")).toEqual({ kind: "none" });
    expect(at(1, "KeyJ")).toMatchObject({ code: "ArrowLeft" });
  });

  it("writes the tapping terms as changes to the two keys", () => {
    const board = testBoard("bethirty_ortho")!;
    const meta = keyboardMeta(board);
    let km = keymapOf(board);
    for (const step of ["thumbs30", "alpha30"] as const)
      km = applyChanges(
        km,
        propose30(step, board, meta, km, DEFAULT_ANSWERS, "us").changes,
      );
    const answers = {
      ...DEFAULT_ANSWERS,
      thirty: { off: [], terms: { tab: 250, a: 180 } },
    };
    const p = propose30("terms30", board, meta, km, answers, "us");
    expect(p.changes).toHaveLength(1);
    expect(p.changes[0].trigger).toMatchObject({ code: "Tab", term: 250 });
  });

  it("says when a layer does not fit the keyboard's limit", () => {
    const { km, notes, a } = run("bethirty_ortho", DEFAULT_ANSWERS, 4);
    expect(notes).toContain("layer1:layers-full");
    expect(notes).toContain("extra30:layers-full");
    expect(km.layers).toHaveLength(4);
    const r = bottomRoles(a);
    expect(km.layers[1][r.enter!]).toEqual({ kind: "none" });
    expect(km.layers[0][r.right[2]!]).toMatchObject({
      code: "IntlRo",
      holdLayer: 3,
    });
  });

  it("draws the layer a step fills, with the keys held for it", () => {
    const board = testBoard("bethirty_ortho")!;
    const meta = keyboardMeta(board);
    const a = anchorsOf(board, meta);
    const r = bottomRoles(a);
    expect(layersShown30("layer1", board, meta)).toEqual([
      { layer: 1, held: [r.space] },
    ]);
    expect(layersShown30("extra30", board, meta)).toEqual([
      { layer: 3, held: [r.right[2]] },
      { layer: 4, held: [r.enter, r.space] },
    ]);
    const groups = groups30(
      "layer2",
      board,
      meta,
      keymapOf(board),
      DEFAULT_ANSWERS,
      "jis",
    );
    expect(groups.map((g) => g.id)).toEqual([
      "layer2:symbols",
      "layer2:numpad",
      "layer2:edit",
    ]);
    // On JIS the symbols are the JIS keys: @ is its own key, ~ is Shift+^.
    const sym = groups[0].changes.find((c) => c.pos === a.byCode("KeyG"))!;
    expect(sym.trigger).toEqual({ kind: "key", code: "BracketLeft", mods: [] });
  });
});
