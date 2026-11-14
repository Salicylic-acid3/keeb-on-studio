import type {
  BehaviorBinding,
  Keymap,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { testBoard } from "../../../keyTest/lib/boards";
import { zmkTrigger, type Trigger } from "../../../keyTest/lib/triggers";
import { keyboardBindings } from "../../../layoutEditor/lib/keyboards";
import { GOFORTY_MAX } from "../../../lib/layouts";
import { BEHAVIORS } from "../../../lib/transport/behaviors";
import type { BehaviorDefinition } from "../../../hooks/useKeymapSource";
import {
  behaviorIds,
  behaviorRole,
  bindingToTrigger,
  bindingsFor,
  boardIdForDevice,
  CODE_BY_HID,
  HID_BY_CODE,
  liveKeyboard,
  sameDance,
  triggerToBinding,
  triggerToDance,
} from "../device";
import { keymapOf, sameTrigger } from "../guide";

const behaviors = new Map<number, BehaviorDefinition>(
  BEHAVIORS.map((b) => [b.id, b as unknown as BehaviorDefinition]),
);
const ids = behaviorIds(behaviors, null);
const layerIds = [0, 1, 2, 3];
const idOf = (i: number) => layerIds[i];
const indexOf = (id: number) => {
  const i = layerIds.indexOf(id);
  return i >= 0 ? i : undefined;
};
const roundTrip = (t: Trigger) => {
  const b = triggerToBinding(t, ids, idOf);
  return b && bindingToTrigger(b, behaviors, indexOf);
};

describe("key codes and HID usages", () => {
  it("maps both ways for every code a registered keyboard uses", () => {
    expect(HID_BY_CODE.KeyA).toBe(0x04);
    expect(HID_BY_CODE.Space).toBe(0x2c);
    expect(HID_BY_CODE.NonConvert).toBe(0x8b);
    expect(HID_BY_CODE.ShiftLeft).toBe(0xe1);
    expect(CODE_BY_HID[0x50]).toBe("ArrowLeft");
    for (const [code, id] of Object.entries(HID_BY_CODE))
      expect(CODE_BY_HID[id]).toBe(code);
  });
});

describe("behaviors by role", () => {
  it("knows the demo keyboard's behaviors", () => {
    expect(behaviorRole("Key Press")).toBe("kp");
    expect(behaviorRole("Layer-Tap")).toBe("lt");
    expect(behaviorRole("Layer-Tap 280ms (balanced)")).toBe("lt");
    expect(behaviorRole("Transparent")).toBe("trans");
    expect(behaviorRole("None")).toBe("none");
    expect(behaviorRole("Bluetooth")).toBeNull();
    for (const role of ["kp", "mo", "lt", "mt", "trans", "none", "mkp"])
      expect(ids[role as keyof typeof ids]).toBeDefined();
  });

  it("prefers the behavior the keymap already uses for a role", () => {
    const withPreset = new Map(behaviors);
    withPreset.set(99, {
      id: 99,
      displayName: "Layer-Tap 150ms",
      metadata: [],
    } as unknown as BehaviorDefinition);
    const km = {
      layers: [
        {
          id: 0,
          name: "Base",
          bindings: [{ behaviorId: 99, param1: 1, param2: 0x7002c }],
        },
      ],
      availableLayers: 8,
      maxLayerNameLength: 32,
    } as unknown as Keymap;
    expect(behaviorIds(withPreset, km).lt).toBe(99);
    expect(behaviorIds(withPreset, null).lt).toBe(ids.lt);
  });
});

describe("triggers and bindings", () => {
  it("round-trips a plain key, a shifted key, a layer-tap, a mod-tap, mouse and none", () => {
    const cases: Trigger[] = [
      { kind: "key", code: "KeyA", mods: [] },
      { kind: "key", code: "Digit1", mods: ["shift"] },
      { kind: "key", code: "Space", mods: [], holdLayer: 2 },
      { kind: "key", code: "KeyF", mods: [], hold: "ShiftLeft" },
      { kind: "mouse", button: 0 },
      { kind: "mouse", button: 2 },
      { kind: "layer", layer: 3 },
      { kind: "none" },
      { kind: "none", blocked: true },
    ];
    for (const t of cases) {
      const back = roundTrip(t);
      expect(back).not.toBeNull();
      expect(sameTrigger(back!, t)).toBe(true);
    }
  });

  it("binds a tap dance to a runtime tap dance slot, and reads one back", () => {
    const td: Trigger = {
      kind: "key",
      code: "Tab",
      mods: [],
      hold: "ControlLeft",
      doubleTap: "KeyQ",
      term: 220,
    };
    // Without a slot set up for it there is nothing to bind it to.
    expect(triggerToBinding(td, ids, idOf)).toBeNull();
    expect(ids.rtd).toBeDefined();
    const dance = triggerToDance(td, ids)!;
    expect(dance.taps).toHaveLength(2);
    expect(dance.holds[0]).toMatchObject({ behaviorId: ids.kp });
    expect(dance.holds[1]).toBeNull();
    expect(dance.term).toBe(220);
    expect(triggerToBinding(td, ids, idOf, 3)).toEqual({
      behaviorId: ids.rtd,
      param1: 3,
      param2: 0,
    });
    // The slot's contents read back as the trigger.
    const dances = new Map([[3, dance]]);
    const back = bindingToTrigger(
      { behaviorId: ids.rtd!, param1: 3, param2: 0 },
      behaviors,
      indexOf,
      dances,
    );
    expect(sameTrigger(back, td)).toBe(true);
    expect(sameDance(dance, triggerToDance(td, ids)!)).toBe(true);
    // A tapping term alone: a one-tap dance with its hold.
    const short: Trigger = {
      kind: "key",
      code: "KeyA",
      mods: [],
      hold: "ControlLeft",
      term: 180,
    };
    const d2 = triggerToDance(short, ids)!;
    expect(d2.taps).toHaveLength(1);
    expect(sameDance(dance, d2)).toBe(false);
    // Without the slot contents the binding reads as something else.
    expect(
      bindingToTrigger(
        { behaviorId: ids.rtd!, param1: 9, param2: 0 },
        behaviors,
        indexOf,
      ),
    ).toEqual({ kind: "other", label: "TD 9" });
    // Volume keys travel as consumer-page usages.
    const vol = roundTrip({ kind: "key", code: "AudioVolumeUp", mods: [] });
    expect(vol).toEqual({ kind: "key", code: "AudioVolumeUp", mods: [] });
  });

  it("writes a key press as a full HID usage with its modifier flags", () => {
    const b = triggerToBinding(
      { kind: "key", code: "Digit1", mods: ["shift"] },
      ids,
      idOf,
    )!;
    expect(b.behaviorId).toBe(ids.kp);
    expect(b.param1).toBe((0x02 << 24) | (0x07 << 16) | 0x1e);
    const lt = triggerToBinding(
      { kind: "key", code: "Enter", mods: [], holdLayer: 1 },
      ids,
      idOf,
    )!;
    expect(lt).toMatchObject({
      behaviorId: ids.lt,
      param1: 1,
      param2: 0x70028,
    });
  });

  it("reads right-hand modifier flags as the same modifier and keeps layer ids apart from indexes", () => {
    const rs: BehaviorBinding = {
      behaviorId: ids.kp!,
      param1: (0x20 << 24) | 0x7001e,
      param2: 0,
    };
    expect(bindingToTrigger(rs, behaviors, indexOf)).toMatchObject({
      code: "Digit1",
      mods: ["shift"],
    });
    const lt: BehaviorBinding = {
      behaviorId: ids.lt!,
      param1: 7,
      param2: 0x7002c,
    };
    expect(
      bindingToTrigger(lt, behaviors, (id) => (id === 7 ? 2 : undefined)),
    ).toMatchObject({ code: "Space", holdLayer: 2 });
  });

  it("sets aside what the keyboard cannot take", () => {
    const { writes, unwritable } = bindingsFor(
      [
        { layer: 0, pos: 1, trigger: { kind: "key", code: "KeyB", mods: [] } },
        { layer: 9, pos: 1, trigger: { kind: "key", code: "KeyB", mods: [] } },
        { layer: 0, pos: 2, trigger: { kind: "other", label: "BT" } },
      ],
      ids,
      layerIds,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].layerId).toBe(0);
    expect(unwritable.map((u) => u.reason)).toEqual(["layer", "behavior"]);
  });
});

describe("the connected keyboard as a board", () => {
  it("names the registered board of a device", () => {
    expect(boardIdForDevice("goforty-max")).toBe("goforty_max_ortho");
    expect(boardIdForDevice("ErgoTrack")).toBe("clickboard_ergotrack");
    expect(boardIdForDevice("something")).toBeNull();
  });

  it("rebuilds GoFortyMax from its layout and a keymap of its default bindings", () => {
    const def = keyboardBindings("goforty_max_ortho")!;
    const textLayers = [def.bindings, ...def.layers];
    const layerIds = textLayers.map((_, i) => i);
    const keymap = {
      layers: textLayers.map((texts, i) => ({
        id: i,
        name: `L${i}`,
        bindings: texts.map(
          (text) =>
            triggerToBinding(zmkTrigger(text), ids, (x) => layerIds[x]) ?? {
              behaviorId: ids.trans!,
              param1: 0,
              param2: 0,
            },
        ),
      })),
      availableLayers: 8,
      maxLayerNameLength: 32,
    } as unknown as Keymap;
    const live = liveKeyboard(
      "goforty_max_ortho",
      "GoFortyMax",
      GOFORTY_MAX,
      keymap,
      behaviors,
      "us",
    );
    const staticBoard = testBoard("goforty_max_ortho")!;
    expect(live.board.keys).toHaveLength(staticBoard.keys.length);
    expect(live.layerIds).toEqual(layerIds);
    live.board.keys.forEach((k, i) => {
      const s = staticBoard.keys[i];
      expect(Math.abs(k.cx - s.cx)).toBeLessThan(0.01);
      expect(Math.abs(k.cy - s.cy)).toBeLessThan(0.01);
      // Every key the default keymap sends comes back the same.
      if (s.trigger.kind === "key" || s.trigger.kind === "mouse")
        expect(sameTrigger(k.trigger, s.trigger)).toBe(true);
    });
    // The working keymap has every layer, in order.
    expect(live.keymap.layers).toHaveLength(textLayers.length);
    const fromStatic = keymapOf(staticBoard);
    fromStatic.layers.forEach((layer, l) =>
      layer.forEach((t, pos) => {
        if (t.kind === "key")
          expect(sameTrigger(live.keymap.layers[l][pos], t)).toBe(true);
      }),
    );
  });

  it("works in the OS's block of layers, numbering them from its base", () => {
    const def = keyboardBindings("goforty_max_ortho")!;
    const textLayers = [def.bindings, ...def.layers];
    // Three OS blocks of four: the keymap three times over.
    const blocks = [0, 1, 2].flatMap(() =>
      [0, 1, 2, 3].map(
        (i) => textLayers[i] ?? textLayers[0].map(() => "trans"),
      ),
    );
    const keymap = {
      layers: blocks.map((texts, i) => ({
        id: i,
        name: `L${i}`,
        bindings: texts.map((text) => {
          const t = zmkTrigger(text);
          // Layer numbers inside a block point into that block.
          const shifted =
            t.kind === "key" && t.holdLayer !== undefined
              ? { ...t, holdLayer: t.holdLayer + Math.floor(i / 4) * 4 }
              : t;
          return (
            triggerToBinding(shifted, ids, (x) => x) ?? {
              behaviorId: ids.trans!,
              param1: 0,
              param2: 0,
            }
          );
        }),
      })),
      availableLayers: 12,
      maxLayerNameLength: 32,
    } as unknown as Keymap;
    const live = liveKeyboard(
      "goforty_max_ortho",
      "GoFortyMax",
      GOFORTY_MAX,
      keymap,
      behaviors,
      "us",
      { start: 4, size: 4 },
    );
    expect(live.keymap.layers).toHaveLength(4);
    expect(live.keymap.maxLayers).toBe(4);
    expect(live.layerIds).toEqual([4, 5, 6, 7]);
    // A layer-tap into the block reads as a block-relative layer...
    const lt = live.keymap.layers[0].find(
      (t) => t.kind === "key" && t.holdLayer !== undefined,
    )!;
    expect(lt.kind === "key" && lt.holdLayer).toBeLessThan(4);
    // ...and is written back with the device's layer id.
    const { writes } = bindingsFor(
      [
        {
          layer: 1,
          pos: 0,
          trigger: { kind: "key", code: "Space", mods: [], holdLayer: 2 },
        },
      ],
      ids,
      live.layerIds,
    );
    expect(writes[0].layerId).toBe(5);
    expect(writes[0].binding.param1).toBe(6);
  });
});
