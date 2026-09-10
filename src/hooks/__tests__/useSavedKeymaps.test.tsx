/**
 * Loading a saved keymap onto a keyboard that is not shaped like the one it
 * was made on. That is the normal case for a shared keymap -- the person
 * opening it has a keyboard at its defaults -- so these cover what happens to
 * the parts that do not fit.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSavedKeymaps } from "../useSavedKeymaps";
import type { BehaviorDefinition, Layer } from "../useKeymap";
import type { SavedKeymap } from "../../lib/savedKeymaps";

const KEY_COUNT = 3;

function layer(id: number, name: string): Layer {
  return {
    id,
    name,
    bindings: Array.from({ length: KEY_COUNT }, () => ({
      behaviorId: 1,
      param1: 0,
      param2: 0,
    })),
  } as Layer;
}

const BEHAVIORS = new Map<number, BehaviorDefinition>([
  [1, { id: 1, displayName: "Transparent", metadata: [] }],
  [2, { id: 2, displayName: "Key Press", metadata: [] }],
]);

/** A record with more layers than the keyboard has, and one behavior it lacks. */
function record(layerCount: number): SavedKeymap {
  return {
    id: 1,
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
    name: "温泉街配列",
    description: "",
    target: { layoutName: "ClickBoard ErgoTrack", keyCount: KEY_COUNT },
    behaviors: ["Key Press", "drag_lclk"],
    layers: Array.from({ length: layerCount }, (_unused, index) => ({
      name: `Layer ${index}`,
      bindings: [
        [0, 4, 0],
        // Only this keyboard's owner has drag_lclk; it is a macro defined in
        // their own keymap.
        [1, 0, 0],
        [0, 5, 0],
      ] as Array<[number, number, number]>,
    })),
    fromDemo: false,
  };
}

function setup({
  layerCount = 1,
  freeSlots = 0,
}: { layerCount?: number; freeSlots?: number } = {}) {
  const layers = Array.from({ length: layerCount }, (_unused, index) =>
    layer(index, `Layer ${index}`),
  );
  const written: Array<{ layerId: number; keyPosition: number }> = [];
  let remaining = freeSlots;
  let nextId = layers.length;

  const addLayer = jest.fn(async () => {
    if (remaining <= 0) return null;
    remaining--;
    const created = layer(nextId, `Layer ${nextId}`);
    // The device appends here; the hook must not assume that, but this is the
    // ordinary case.
    const index = nextId;
    nextId++;
    return { index, layer: created };
  });

  const setBinding = jest.fn(async (layerId: number, keyPosition: number) => {
    written.push({ layerId, keyPosition });
    return true;
  });

  const hook = renderHook(() =>
    useSavedKeymaps({
      layers,
      behaviors: BEHAVIORS,
      connected: { layoutName: "ClickBoard ErgoTrack", keyCount: KEY_COUNT },
      isDemo: false,
      setBinding,
      addLayer,
    }),
  );

  return { hook, addLayer, setBinding, written };
}

describe("loading onto a keyboard with fewer layers", () => {
  it("leaves the extra layers alone by default", async () => {
    const { hook, addLayer } = setup({ layerCount: 1 });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    let outcome!: Awaited<ReturnType<typeof hook.result.current.load>>;
    await act(async () => {
      outcome = await hook.result.current.load(record(3));
    });

    // Changing how many layers a keyboard has is not a side effect of loading.
    expect(addLayer).not.toHaveBeenCalled();
    expect(outcome.skippedLayers).toBe(2);
    expect(outcome.addedLayers).toBe(0);
  });

  it("creates them when asked, and then fills them", async () => {
    const { hook, addLayer, written } = setup({ layerCount: 1, freeSlots: 2 });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    let outcome!: Awaited<ReturnType<typeof hook.result.current.load>>;
    await act(async () => {
      outcome = await hook.result.current.load(record(3), {
        addMissingLayers: true,
      });
    });

    expect(addLayer).toHaveBeenCalledTimes(2);
    expect(outcome.addedLayers).toBe(2);
    expect(outcome.skippedLayers).toBe(0);
    // Two of the three keys resolve; every layer gets both of them.
    expect(written).toHaveLength(6);
    expect(new Set(written.map((w) => w.layerId))).toEqual(new Set([0, 1, 2]));
  });

  it("stops asking when the keyboard runs out of slots", async () => {
    const { hook, addLayer } = setup({ layerCount: 1, freeSlots: 1 });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    let outcome!: Awaited<ReturnType<typeof hook.result.current.load>>;
    await act(async () => {
      outcome = await hook.result.current.load(record(4), {
        addMissingLayers: true,
      });
    });

    // Asked three times' worth, got one, and did not keep hammering a device
    // that has already said no.
    expect(addLayer).toHaveBeenCalledTimes(2);
    expect(outcome.addedLayers).toBe(1);
    expect(outcome.skippedLayers).toBe(2);
  });
});

describe("a behavior this keyboard does not have", () => {
  it("leaves that key alone and says which behavior it was", async () => {
    const { hook, written } = setup({ layerCount: 1 });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    let outcome!: Awaited<ReturnType<typeof hook.result.current.load>>;
    await act(async () => {
      outcome = await hook.result.current.load(record(1));
    });

    expect(outcome.unresolved).toEqual([
      { layerIndex: 0, keyPosition: 1, behaviorName: "drag_lclk" },
    ]);
    // The other two keys still land, and on their own positions: position 1 is
    // skipped rather than closed up.
    expect(written.map((w) => w.keyPosition)).toEqual([0, 2]);
  });
});
