/**
 * The point of this format is that a keymap laid out in demo mode can be
 * loaded onto a real keyboard later. These cover the two things that would
 * quietly break that: behaviors being matched by the wrong thing, and key
 * positions shifting.
 */
import {
  SAVED_KEYMAP_SCHEMA_VERSION,
  compatibilityOf,
  isLoadable,
  resolveForDevice,
  toPayload,
  unresolvedBehaviorNames,
  NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "../types";

const DEMO_BEHAVIOR_NAMES = new Map([
  [10, "Key Press"],
  [35, "Transparent"],
  [29, "Layer-Tap"],
]);

/** The same behaviors on a real board, under different local ids. */
const DEVICE_IDS = new Map([
  ["Key Press", 0x4a2f],
  ["Transparent", 0x9013],
  ["Layer-Tap", 0x77c1],
]);

function demoPayload() {
  return toPayload({
    name: "My layout",
    description: "made before the keyboard arrived",
    target: { layoutName: "ClickBoard ErgoTrack", keyCount: 4 },
    fromDemo: true,
    layers: [
      {
        name: "Base",
        bindings: [
          { behaviorId: 10, param1: 0x04, param2: 0 },
          { behaviorId: 10, param1: 0x05, param2: 0 },
          { behaviorId: 29, param1: 1, param2: 0x2c },
          { behaviorId: 35, param1: 0, param2: 0 },
        ],
      },
    ],
    behaviorName: (id) => DEMO_BEHAVIOR_NAMES.get(id) ?? "",
  });
}

describe("saved keymap format", () => {
  it("stores behaviors by name, not by the device's own ids", () => {
    const payload = demoPayload();
    // Demo ids (10/29/35) must not appear; the table holds names instead.
    expect(payload.behaviors).toEqual([
      "Key Press",
      "Layer-Tap",
      "Transparent",
    ]);
    expect(payload.layers[0].bindings.map(([index]) => index)).toEqual([
      0, 0, 1, 2,
    ]);
  });

  it("loads onto a keyboard that numbers the same behaviors differently", () => {
    const { layers, unresolved } = resolveForDevice(demoPayload(), DEVICE_IDS);

    expect(unresolved).toEqual([]);
    expect(layers[0].bindings).toEqual([
      { behaviorId: 0x4a2f, param1: 0x04, param2: 0 },
      { behaviorId: 0x4a2f, param1: 0x05, param2: 0 },
      { behaviorId: 0x77c1, param1: 1, param2: 0x2c },
      { behaviorId: 0x9013, param1: 0, param2: 0 },
    ]);
  });

  it("holds a key's position when the target lacks its behavior", () => {
    // A binding's index IS its key position. Dropping one would shift every
    // key after it -- so the gap is a null, and the caller is told about it.
    const withoutLayerTap = new Map(DEVICE_IDS);
    withoutLayerTap.delete("Layer-Tap");

    const { layers, unresolved } = resolveForDevice(
      demoPayload(),
      withoutLayerTap,
    );

    expect(layers[0].bindings).toHaveLength(4);
    expect(layers[0].bindings[2]).toBeNull();
    expect(layers[0].bindings[3]).toEqual({
      behaviorId: 0x9013,
      param1: 0,
      param2: 0,
    });
    expect(unresolved).toEqual([
      { layerIndex: 0, keyPosition: 2, behaviorName: "Layer-Tap" },
    ]);
  });

  it("treats a behavior the device never described as unresolvable", () => {
    const payload = toPayload({
      name: "x",
      description: "",
      target: { layoutName: "X", keyCount: 1 },
      fromDemo: false,
      layers: [
        { name: "Base", bindings: [{ behaviorId: 999, param1: 0, param2: 0 }] },
      ],
      behaviorName: () => "",
    });

    const { layers, unresolved } = resolveForDevice(payload, DEVICE_IDS);
    expect(layers[0].bindings).toEqual([null]);
    expect(unresolved).toHaveLength(1);
  });

  it("caps the free text", () => {
    const payload = toPayload({
      name: "n".repeat(NAME_MAX_LENGTH + 50),
      description: "d".repeat(DESCRIPTION_MAX_LENGTH + 50),
      target: { layoutName: "X", keyCount: 0 },
      fromDemo: false,
      layers: [],
      behaviorName: () => "",
    });
    expect(payload.name).toHaveLength(NAME_MAX_LENGTH);
    expect(payload.description).toHaveLength(DESCRIPTION_MAX_LENGTH);
  });
});

describe("naming what could not be loaded", () => {
  it("names each missing behavior once, in the order met", () => {
    expect(
      unresolvedBehaviorNames([
        { layerIndex: 0, keyPosition: 4, behaviorName: "drag_lclk" },
        { layerIndex: 0, keyPosition: 9, behaviorName: "dual_pad" },
        { layerIndex: 1, keyPosition: 4, behaviorName: "drag_lclk" },
      ]),
    ).toEqual(["drag_lclk", "dual_pad"]);
  });

  it("leaves out behaviors the device never named", () => {
    // The count still covers these; there is simply no name to show, and a
    // blank in a sentence reads as a bug.
    expect(
      unresolvedBehaviorNames([
        { layerIndex: 0, keyPosition: 0, behaviorName: "" },
        { layerIndex: 0, keyPosition: 1, behaviorName: "   " },
        { layerIndex: 0, keyPosition: 2, behaviorName: "drag_lclk" },
      ]),
    ).toEqual(["drag_lclk"]);
  });

  it("has nothing to say when everything resolved", () => {
    expect(unresolvedBehaviorNames([])).toEqual([]);
  });
});

describe("compatibility", () => {
  const saved = {
    schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION,
    target: { layoutName: "ClickBoard ErgoTrack", keyCount: 79 },
  };

  it("matches the keyboard it was made for", () => {
    const result = compatibilityOf(saved, {
      layoutName: "ClickBoard ErgoTrack",
      keyCount: 79,
    });
    expect(result).toEqual({ kind: "match" });
    expect(isLoadable(result)).toBe(true);
  });

  it("refuses a keyboard with a different number of keys", () => {
    const result = compatibilityOf(saved, {
      layoutName: "GoFortyMax Ortho",
      keyCount: 53,
    });
    expect(result).toEqual({ kind: "key-count", savedFor: 79, connected: 53 });
    expect(isLoadable(result)).toBe(false);
  });

  it("allows a same-sized keyboard but says the name differs", () => {
    const result = compatibilityOf(saved, {
      layoutName: "Something Else",
      keyCount: 79,
    });
    expect(result).toEqual({
      kind: "different-layout",
      savedFor: "ClickBoard ErgoTrack",
      connected: "Something Else",
    });
    expect(isLoadable(result)).toBe(true);
  });

  it("refuses a record written by a newer app", () => {
    const result = compatibilityOf(
      { ...saved, schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION + 1 },
      { layoutName: "ClickBoard ErgoTrack", keyCount: 79 },
    );
    expect(result).toEqual({ kind: "schema" });
    expect(isLoadable(result)).toBe(false);
  });

  it("is loadable with nothing connected, so demo mode can still save and open", () => {
    expect(compatibilityOf(saved, null)).toEqual({ kind: "match" });
  });
});
