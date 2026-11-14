import data from "../../../layoutEditor/data/keyboards.json";
import { testBoard } from "../../../keyTest/lib/boards";
import type { Trigger } from "../../../keyTest/lib/triggers";
import { parseKeycode } from "../../../qmk/lib/keycodes/qmkKeycode";
import { parseKleLayout, type VialKey } from "../../../qmk/lib/vial/kle";
import type { KleRow } from "../../../qmk/lib/vial/definition";
import { sameTrigger } from "../guide";
import {
  keycodesFor,
  keycodeToTrigger,
  liveQmkKeyboard,
  triggerToKeycode,
} from "../qmkDevice";

interface QmkEntry {
  id: string;
  name: string;
  keymap: KleRow[];
  keycodes: Record<string, string>;
  layers: Array<Record<string, string>>;
}
const entry = (data as { qmk: QmkEntry[] }).qmk.find(
  (q) => q.id === "goforty_jp",
)!;

/** The keyboard's keys and keymap as Vial would hand them over. */
function vialOf(e: QmkEntry): { keys: VialKey[]; keymap: number[][][] } {
  const keys = parseKleLayout(e.keymap);
  const rows = Math.max(...keys.map((k) => k.row)) + 1;
  const cols = Math.max(...keys.map((k) => k.col)) + 1;
  const layer = (codes: Record<string, string>) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from(
        { length: cols },
        (_, c) => parseKeycode(codes[`${r},${c}`] ?? "KC_NO") ?? 0,
      ),
    );
  return { keys, keymap: [layer(e.keycodes), ...e.layers.map(layer)] };
}

describe("QMK keycodes and triggers", () => {
  it("round-trips the triggers the guide writes", () => {
    const cases: Trigger[] = [
      { kind: "key", code: "KeyA", mods: [] },
      { kind: "key", code: "Digit1", mods: ["shift"] },
      { kind: "key", code: "Space", mods: [], holdLayer: 2 },
      { kind: "key", code: "KeyF", mods: [], hold: "ShiftLeft" },
      { kind: "key", code: "Convert", mods: [] },
      { kind: "key", code: "Lang1", mods: [] },
      { kind: "mouse", button: 0 },
      { kind: "mouse", button: 2 },
      { kind: "layer", layer: 3 },
      { kind: "none" },
      { kind: "none", blocked: true },
    ];
    for (const t of cases) {
      const code = triggerToKeycode(t);
      expect(code).not.toBeNull();
      expect(sameTrigger(keycodeToTrigger(code!), t)).toBe(true);
    }
    expect(
      triggerToKeycode({ kind: "key", code: "Space", mods: [], holdLayer: 16 }),
    ).toBeNull();
    expect(triggerToKeycode({ kind: "other", label: "BT" })).toBeNull();
    expect(
      triggerToKeycode({ kind: "key", code: "Digit1", mods: ["shift"] }),
    ).toBe(0x021e);
  });

  it("rebuilds GoForty JP from Vial's keys and keymap", () => {
    const { keys, keymap } = vialOf(entry);
    const live = liveQmkKeyboard("goforty_jp", entry.name, keys, keymap, "jis");
    // Without an OS-switch module the guide works in the whole keymap,
    // whose layer count the firmware fixes (a 30% guide needs five).
    expect(live.layerCount).toBe(keymap.length);
    expect(live.matrix).toHaveLength(keys.length);
    const staticBoard = testBoard("goforty_jp")!;
    // Every live key that sends a key sits where the registered board has
    // the same key, with the same trigger.
    let matched = 0;
    for (const k of live.board.keys) {
      const s = staticBoard.keys.find(
        (x) => Math.abs(x.cx - k.cx) < 0.05 && Math.abs(x.cy - k.cy) < 0.05,
      );
      if (!s || k.trigger.kind !== "key") continue;
      expect(sameTrigger(k.trigger, s.trigger)).toBe(true);
      matched++;
    }
    expect(matched).toBeGreaterThan(30);
    // Layers reached from the base layer come through on the keys.
    expect(live.board.keys.some((k) => (k.onLayers?.length ?? 0) > 0)).toBe(
      true,
    );
  });

  it("stages keycodes by matrix position and sets aside layers the keyboard lacks", () => {
    const { keys, keymap } = vialOf(entry);
    const live = liveQmkKeyboard("goforty_jp", entry.name, keys, keymap, "jis");
    const { writes, unwritable } = keycodesFor(
      [
        { layer: 1, pos: 0, trigger: { kind: "key", code: "KeyB", mods: [] } },
        { layer: 99, pos: 0, trigger: { kind: "key", code: "KeyB", mods: [] } },
        { layer: 0, pos: 1, trigger: { kind: "other", label: "X" } },
      ],
      live,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      row: keys[0].row,
      col: keys[0].col,
      code: 0x05,
    });
    expect(unwritable.map((u) => u.reason)).toEqual(["layer", "keycode"]);
  });

  it("reads and writes a tap dance: Tab on tap, Ctrl on hold, Q on two taps", () => {
    const { keys, keymap } = vialOf(entry);
    const empty = {
      onTap: 0,
      onHold: 0,
      onDoubleTap: 0,
      onTapHold: 0,
      tappingTerm: 200,
    };
    const tapDances = [
      {
        onTap: 0x2b,
        onHold: 0xe0,
        onDoubleTap: 0x14,
        onTapHold: 0,
        tappingTerm: 220,
      },
      empty,
      empty,
    ];
    const td: Trigger = {
      kind: "key",
      code: "Tab",
      mods: [],
      hold: "ControlLeft",
      doubleTap: "KeyQ",
      term: 220,
    };
    // TD(0) on the first key reads back as the trigger.
    const withTd = keymap.map((l) => l.map((r) => [...r]));
    withTd[0][keys[0].row][keys[0].col] = 0x5700;
    const live = liveQmkKeyboard(
      "goforty_jp",
      entry.name,
      keys,
      withTd,
      "jis",
      undefined,
      tapDances,
    );
    expect(sameTrigger(live.keymap.layers[0][0], td)).toBe(true);
    // Writing it again reuses entry 0; a new one (A with a short term) takes the first empty entry.
    const { writes, tapDanceWrites, unwritable } = keycodesFor(
      [
        { layer: 0, pos: 0, trigger: td },
        {
          layer: 0,
          pos: 1,
          trigger: {
            kind: "key",
            code: "KeyA",
            mods: [],
            hold: "ControlLeft",
            term: 180,
          },
        },
      ],
      live,
      tapDances,
    );
    expect(unwritable).toEqual([]);
    expect(writes.map((w) => w.code)).toEqual([0x5700, 0x5701]);
    expect(tapDanceWrites).toEqual([
      {
        index: 1,
        entry: {
          onTap: 0x04,
          onHold: 0xe0,
          onDoubleTap: 0,
          onTapHold: 0,
          tappingTerm: 180,
        },
      },
    ]);
    // With every entry taken, the key cannot be written.
    const full = keycodesFor(
      [
        {
          layer: 0,
          pos: 2,
          trigger: { kind: "key", code: "KeyS", mods: [], term: 150 },
        },
      ],
      live,
      tapDances.map((e, i) => (i === 0 ? e : { ...e, onTap: 0x05 })),
    );
    expect(full.unwritable.map((u) => u.reason)).toEqual(["tapdance"]);
    // A tap dance needs an entry: no plain keycode stands for it.
    expect(triggerToKeycode(td)).toBeNull();
    // Volume keys are QMK's own basic keycodes.
    expect(
      triggerToKeycode({ kind: "key", code: "AudioVolumeUp", mods: [] }),
    ).toBe(0xa9);
    expect(keycodeToTrigger(0xa9)).toEqual({
      kind: "key",
      code: "AudioVolumeUp",
      mods: [],
    });
  });

  it("stages into the OS's block of layers", () => {
    const { keys, keymap } = vialOf(entry);
    const live = liveQmkKeyboard(
      "goforty_jp",
      entry.name,
      keys,
      keymap,
      "jis",
      {
        start: 4,
        size: 4,
      },
    );
    expect(live.layerCount).toBe(4);
    expect(live.keymap.maxLayers).toBe(4);
    const { writes } = keycodesFor(
      [
        {
          layer: 1,
          pos: 0,
          trigger: { kind: "key", code: "Space", mods: [], holdLayer: 2 },
        },
      ],
      live,
    );
    expect(writes[0].layer).toBe(5);
    expect(keycodeToTrigger(writes[0].code)).toMatchObject({ holdLayer: 6 });
  });
});
