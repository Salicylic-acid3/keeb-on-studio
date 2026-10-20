import {
  ANSI_ID,
  JIS_ID,
  isTestable,
  testBoard,
  testBoardEntries,
} from "../boards";
import {
  heldKeys,
  indexBoard,
  initialState,
  keyDown,
  keyUp,
  mouseDown,
  mouseUp,
  releaseAll,
  resolve,
} from "../matcher";
import { qmkTrigger, zmkTrigger } from "../triggers";

describe("triggers", () => {
  it("reads QMK keycodes", () => {
    expect(qmkTrigger("KC_A")).toEqual({ kind: "key", code: "KeyA", mods: [] });
    expect(qmkTrigger("KC_INT1")).toMatchObject({ code: "IntlRo" });
    expect(qmkTrigger("LT(1, KC_SPC)")).toMatchObject({
      kind: "key",
      code: "Space",
    });
    expect(qmkTrigger("SFT_T(KC_DOT)")).toEqual({
      kind: "key",
      code: "Period",
      mods: [],
      hold: "ShiftLeft",
    });
    expect(qmkTrigger("MT(MOD_RCTL, KC_ENT)")).toMatchObject({
      code: "Enter",
      hold: "ControlRight",
    });
    expect(qmkTrigger("LSFT(KC_1)")).toEqual({
      kind: "key",
      code: "Digit1",
      mods: ["shift"],
    });
    expect(qmkTrigger("MO(1)")).toEqual({ kind: "layer", layer: 1 });
    expect(qmkTrigger("LT(2, KC_SPC)")).toMatchObject({ holdLayer: 2 });
    expect(qmkTrigger("KC_BTN2")).toEqual({ kind: "mouse", button: 2 });
    expect(qmkTrigger("_______")).toEqual({ kind: "none" });
    expect(qmkTrigger("QK_BOOT").kind).toBe("other");
  });

  it("reads ZMK bindings", () => {
    expect(zmkTrigger("kp N1")).toMatchObject({ code: "Digit1" });
    expect(zmkTrigger("kp LG(LBKT)")).toEqual({
      kind: "key",
      code: "BracketLeft",
      mods: ["meta"],
    });
    expect(zmkTrigger("lt_mid 2 SPACE")).toMatchObject({ code: "Space" });
    expect(zmkTrigger("mt_mid LGUI LANG2")).toEqual({
      kind: "key",
      code: "Lang2",
      mods: [],
      hold: "MetaLeft",
    });
    expect(zmkTrigger("mt_mid LEFT_WIN INT_MUHENKAN")).toMatchObject({
      code: "NonConvert",
      hold: "MetaLeft",
    });
    expect(zmkTrigger("mkp RCLK")).toEqual({ kind: "mouse", button: 2 });
    expect(zmkTrigger("drag_lclk")).toEqual({ kind: "mouse", button: 0 });
    expect(zmkTrigger("mo 1")).toEqual({ kind: "layer", layer: 1 });
    expect(zmkTrigger("lt_mid 2 SPACE")).toMatchObject({ holdLayer: 2 });
    expect(zmkTrigger("bt BT_NXT").kind).toBe("other");
    expect(zmkTrigger("none")).toEqual({ kind: "none", blocked: true });
    expect(zmkTrigger("trans")).toEqual({ kind: "none" });
  });
});

describe("boards", () => {
  it("offers both standard keyboards and every bundled one", () => {
    const entries = testBoardEntries();
    expect(entries[0].id).toBe(ANSI_ID);
    expect(entries[1].id).toBe(JIS_ID);
    expect(entries.some((e) => e.group === "zmk")).toBe(true);
    expect(entries.some((e) => e.group === "qmk")).toBe(true);
  });

  it("draws 104 ANSI keys and 109 JIS keys, each its own code", () => {
    const ansi = testBoard(ANSI_ID)!;
    const jis = testBoard(JIS_ID)!;
    expect(ansi.keys).toHaveLength(104);
    expect(jis.keys).toHaveLength(109);
    for (const board of [ansi, jis]) {
      const codes = board.keys.map((k) =>
        k.trigger.kind === "key" ? k.trigger.code : "",
      );
      expect(new Set(codes).size).toBe(codes.length);
    }
    const enter = jis.keys.find(
      (k) => k.trigger.kind === "key" && k.trigger.code === "Enter",
    )!;
    expect(enter.second).toBeDefined();
  });

  it("gives every bundled keyboard testable keys", () => {
    for (const entry of testBoardEntries()) {
      const board = testBoard(entry.id);
      expect(board).not.toBeNull();
      const testable = board!.keys.filter((k) => isTestable(k));
      // Every keyboard has at least most of its keys testable.
      expect(testable.length).toBeGreaterThan(board!.keys.length / 2);
    }
  });
});

describe("matcher", () => {
  const board = testBoard(ANSI_ID)!;
  const index = indexBoard(board);
  const idOf = (code: string) =>
    board.keys.find((k) => k.trigger.kind === "key" && k.trigger.code === code)!
      .id;
  const down = (code: string, time: number, mods: string[] = []) => ({
    code,
    key: code,
    mods: mods as never,
    repeat: false,
    time,
  });

  it("lights a key while held and counts it once it is let go", () => {
    let s = keyDown(initialState(), index, down("KeyA", 0));
    expect(heldKeys(s).has(idOf("KeyA"))).toBe(true);
    s = keyUp(s, index, { code: "KeyA", time: 80 });
    expect(heldKeys(s).size).toBe(0);
    expect(s.counts[idOf("KeyA")]).toBe(1);
  });

  it("ignores auto-repeat", () => {
    let s = keyDown(initialState(), index, down("KeyA", 0));
    s = keyDown(s, index, { ...down("KeyA", 500), repeat: true });
    expect(s.counts[idOf("KeyA")]).toBe(1);
  });

  it("flags a key that comes down again too soon", () => {
    let s = keyDown(initialState(), index, down("KeyB", 0));
    s = keyUp(s, index, { code: "KeyB", time: 60 });
    s = keyDown(s, index, down("KeyB", 75));
    expect(s.chatter[idOf("KeyB")]).toBe(1);
    s = keyUp(s, index, { code: "KeyB", time: 140 });
    s = keyDown(s, index, down("KeyB", 400));
    expect(s.chatter[idOf("KeyB")]).toBe(1);
  });

  it("counts a key whose key-down never arrives (Print Screen)", () => {
    const s = keyUp(initialState(), index, { code: "PrintScreen", time: 0 });
    expect(s.counts[idOf("PrintScreen")]).toBe(1);
    expect(heldKeys(s).has(idOf("PrintScreen"))).toBe(true);
  });

  it("flashes Caps Lock instead of holding it", () => {
    const s = keyDown(initialState(), index, down("CapsLock", 0));
    expect(s.pressed["key:CapsLock"]).toBeUndefined();
    expect(s.flash[idOf("CapsLock")]).toBeDefined();
    expect(s.counts[idOf("CapsLock")]).toBe(1);
  });

  it("collects codes this keyboard does not have", () => {
    const s = keyDown(initialState(), index, down("IntlYen", 0));
    expect(s.unmapped).toEqual({ IntlYen: 1 });
    expect(s.log[0].keyIds).toEqual([]);
  });

  it("lets go of everything but the modifiers when asked", () => {
    let s = keyDown(initialState(), index, down("MetaLeft", 0));
    s = keyDown(s, index, down("KeyC", 10, ["meta"]));
    s = releaseAll(s, { keepModifiers: true });
    expect(Object.keys(s.pressed)).toEqual(["key:MetaLeft"]);
  });

  it("presses mouse buttons", () => {
    const zmk = testBoard("clickboard_ergotrack")!;
    const zIndex = indexBoard(zmk);
    let s = mouseDown(initialState(), zIndex, { button: 0, time: 0 });
    expect(heldKeys(s).size).toBeGreaterThan(0);
    s = mouseUp(s, { button: 0, time: 50 });
    expect(heldKeys(s).size).toBe(0);
  });

  it("gives a key sent with a modifier the modifier's press", () => {
    const zmk =
      testBoard("goforty_max_ortho") ?? testBoard("clickboard_ergotrack")!;
    const zIndex = indexBoard(zmk);
    const modded = zmk.keys.find(
      (k) => k.trigger.kind === "key" && k.trigger.mods.includes("meta"),
    );
    if (!modded) return;
    const meta = resolve(zIndex, "MetaLeft", []).ids;
    let s = keyDown(initialState(), zIndex, down("MetaLeft", 0));
    s = keyDown(s, zIndex, down("BracketLeft", 5, ["meta"]));
    expect(heldKeys(s).has(modded.id)).toBe(true);
    for (const id of meta) expect(s.counts[id]).toBeUndefined();
    s = keyUp(s, zIndex, { code: "BracketLeft", time: 50 });
    s = keyUp(s, zIndex, { code: "MetaLeft", time: 52 });
    expect(heldKeys(s).size).toBe(0);
  });

  it("prefers a plain key over a mod-tap's hold", () => {
    for (const entry of testBoardEntries()) {
      const b = testBoard(entry.id)!;
      const plain = b.keys.filter(
        (k) =>
          k.trigger.kind === "key" &&
          k.trigger.code === "MetaLeft" &&
          k.trigger.mods.length === 0,
      );
      if (!plain.length) continue;
      const { ids } = resolve(indexBoard(b), "MetaLeft", []);
      expect(ids.sort()).toEqual(plain.map((k) => k.id).sort());
    }
  });

  it("lights a key sent through a layer, and the layer key with it", () => {
    // InSixty JP: Fn (MO(1)) + 1 sends F1 on layer 1.
    const b = testBoard("insixty_jp")!;
    const i = indexBoard(b);
    const fn = b.keys.filter((k) => k.trigger.kind === "layer");
    expect(fn.length).toBeGreaterThan(0);
    expect(i.testable).toEqual(expect.arrayContaining(fn.map((k) => k.id)));
    const { ids, layerIds } = resolve(i, "F1", []);
    expect(ids.length).toBeGreaterThan(0);
    expect(layerIds).toEqual(fn.map((k) => k.id));
    let s = keyDown(initialState(), i, down("F1", 0));
    const held = heldKeys(s);
    for (const id of [...ids, ...layerIds]) expect(held.has(id)).toBe(true);
    expect(s.counts[layerIds[0]]).toBe(1);
    s = keyUp(s, i, { code: "F1", time: 50 });
    s = keyDown(s, i, down("F2", 100));
    // The layer key is counted once, however many keys it shifts.
    expect(s.counts[layerIds[0]]).toBe(1);
  });

  it("does not count a layer key nothing is reachable through", () => {
    // GoForty US's Fn layer is all transparent in the shipped firmware.
    const b = testBoard("goforty_us")!;
    const i = indexBoard(b);
    const fn = b.keys.filter((k) => k.trigger.kind === "layer");
    for (const k of fn) expect(i.testable).not.toContain(k.id);
  });
});
