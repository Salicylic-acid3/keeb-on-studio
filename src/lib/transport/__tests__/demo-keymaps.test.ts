import type { PhysicalLayout } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import * as layoutModule from "../../layouts";
import { BEHAVIORS } from "../behaviors";
import { bindingParamsValid } from "../bindingParams";
import { Keyboard } from "../demo";
import {
  defaultKeymapFor,
  demoKeymapBehaviors,
  demoKeymapNames,
  fingerprint,
} from "../demo-keymaps";

const KEYBOARD_PAGE = 0x07 << 16;
const id = (displayName: string) =>
  BEHAVIORS.find((b) => b.displayName === displayName)!.id;

// Every layout layouts.ts exports, so a keyboard added there is checked
// without anyone remembering to list it here.
const layouts = Object.values(layoutModule).filter(
  (value): value is PhysicalLayout =>
    typeof value === "object" && value !== null && "keys" in value,
);

describe("default keymaps of the demo keyboards", () => {
  test("every behavior a default keymap uses exists in the demo", () => {
    const known = new Set(BEHAVIORS.map((b) => b.displayName));
    expect(demoKeymapNames().length).toBeGreaterThan(0);
    for (const name of demoKeymapNames()) {
      for (const behavior of demoKeymapBehaviors(name)) {
        expect([name, behavior, known.has(behavior)]).toEqual([
          name,
          behavior,
          true,
        ]);
      }
    }
  });

  test.each(layouts.map((layout) => [layout.name, layout] as const))(
    "%s: a default keymap on file, one binding per key, all of them valid",
    (name, layout) => {
      expect(demoKeymapNames()).toContain(name);
      const keymap = defaultKeymapFor(layout, BEHAVIORS);
      expect(keymap.layers.length).toBeGreaterThan(0);
      keymap.layers.forEach((layer, index) => {
        expect(layer.id).toBe(index);
        expect(layer.bindings).toHaveLength(layout.keys.length);
        layer.bindings.forEach((binding, position) => {
          const behavior = BEHAVIORS.find((b) => b.id === binding.behaviorId);
          // The demo refuses a binding its own validation rejects, so its
          // starting keymap has to be one it would accept.
          expect([
            name,
            index,
            position,
            bindingParamsValid(
              behavior?.metadata,
              binding.param1,
              binding.param2,
            ),
          ]).toEqual([name, index, position, true]);
        });
      });
    },
  );

  test("ClickBoard ErgoTrack starts as its firmware does", () => {
    const keymap = defaultKeymapFor(layoutModule.ERGOTRACK, BEHAVIORS);
    expect(keymap.layers.map((l) => l.name)).toEqual([
      "Base",
      "Alt Base",
      "Drag",
    ]);
    expect(keymap.availableLayers).toBe(13);
    const base = keymap.layers[0].bindings;
    // Esc, then the number row; Q under the 1.
    expect(base[0]).toEqual({
      behaviorId: id("Key Press"),
      param1: KEYBOARD_PAGE | 0x29,
      param2: 0,
    });
    expect(base[15].param1).toBe(KEYBOARD_PAGE | 0x14); // Q
    // The switches under the trackpads are the drag click, not a letter.
    expect(base[6].behaviorId).toBe(id("Left Click (Drag)"));
    // &zip_dyn_scale ZDS_XY ZDS_DEC: cursor, slower.
    expect(base[61]).toEqual({
      behaviorId: id("Pointer Speed Adjust"),
      param1: 0,
      param2: 2,
    });
    // &kp LG(LBKT): the modifier travels in the top byte of the usage.
    expect(base[79].param1).toBe(((0x08 << 24) | KEYBOARD_PAGE | 0x2f) >>> 0);
    // Alt Base is transparent so that turning it on changes nothing.
    expect(
      keymap.layers[1].bindings.every(
        (b) => b.behaviorId === id("Transparent"),
      ),
    ).toBe(true);
  });

  test("GoFortyMax Ortho starts as its firmware does", () => {
    const keymap = defaultKeymapFor(layoutModule.GOFORTY_MAX, BEHAVIORS);
    expect(keymap.layers).toHaveLength(5);
    // Its keymap reserves no extra layer, so none can be added.
    expect(keymap.availableLayers).toBe(0);
    const base = keymap.layers[0].bindings;
    // &bt BT_PRV, &bt BT_NXT, Tab, Q ...
    expect(base[0]).toEqual({
      behaviorId: id("Bluetooth"),
      param1: 2,
      param2: 0,
    });
    expect(base[1].param1).toBe(1);
    expect(base[3].param1).toBe(KEYBOARD_PAGE | 0x14); // Q
    // &lt_mid 3 RET
    expect(base[45]).toEqual({
      behaviorId: id("Layer-Tap 200ms"),
      param1: 3,
      param2: KEYBOARD_PAGE | 0x28,
    });
  });

  test("a layout without a keymap on file still gets one binding per key", () => {
    const keymap = defaultKeymapFor(
      { name: "Not a keyboard", keys: new Array(12) },
      BEHAVIORS,
    );
    expect(keymap.layers[0].bindings).toHaveLength(12);
    expect(keymap.layers[0].bindings[0].param1).toBe(KEYBOARD_PAGE | 0x04);
  });

  test("the permissive-hold presets can be picked in the demo", () => {
    expect(id("Mod-Tap 180ms (Permissive)")).toBeDefined();
    expect(id("Layer-Tap 180ms (Permissive)")).toBeDefined();
  });
});

describe("fingerprint", () => {
  test("same content, same number; different content, a different one", () => {
    expect(fingerprint([1, 2, 3])).toBe(fingerprint([1, 2, 3]));
    expect(fingerprint([1, 2, 3])).not.toBe(fingerprint([1, 2, 4]));
    expect(fingerprint("x")).toBeGreaterThanOrEqual(0);
    expect(fingerprint("x")).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("demo keyboard: one keymap per keyboard", () => {
  // The fast-keymap handler is private; the tests reach it the way the
  // custom-subsystem dispatcher does.
  type Fast = {
    handleFastKeymap: (request: Record<string, unknown>) => {
      snapshot?: {
        behaviorsFp: number;
        keymapFp: number;
        physicalLayoutFp: number;
        availableLayers: number;
        layers: Array<{
          id: number;
          fp: number;
          defaultFp: number;
          editedCount: number;
        }>;
      };
      getEditedLayer?: {
        id: number;
        bindings: Array<{ position: number; binding: unknown }>;
      };
      getDefaultLayer?: { bindings: unknown[] };
    };
  };
  const fast = (kb: Keyboard) => kb as unknown as Fast;
  const keymapOf = (kb: Keyboard) =>
    kb.process({ requestId: 1, keymap: { getKeymap: true } }).requestResponse!
      .keymap!.getKeymap!;
  const select = (kb: Keyboard, layoutIndex: number) =>
    kb.process({
      requestId: 1,
      keymap: { setActivePhysicalLayout: layoutIndex },
    }).requestResponse!.keymap!.setActivePhysicalLayout!;
  const unsaved = (kb: Keyboard) =>
    kb.process({ requestId: 1, keymap: { checkUnsavedChanges: true } })
      .requestResponse!.keymap!.checkUnsavedChanges;
  const A = KEYBOARD_PAGE | 0x04;
  const setKey = (kb: Keyboard, layerId: number, keyPosition: number) =>
    kb.process({
      requestId: 1,
      keymap: {
        setLayerBinding: {
          layerId,
          keyPosition,
          binding: { behaviorId: id("Key Press"), param1: A, param2: 0 },
        },
      },
    }).requestResponse!.keymap!.setLayerBinding;

  test("starts as ClickBoard ErgoTrack, with its keymap", () => {
    const keymap = keymapOf(new Keyboard());
    expect(keymap.layers.map((l) => l.name)).toEqual([
      "Base",
      "Alt Base",
      "Drag",
    ]);
    expect(keymap.layers[0].bindings).toHaveLength(81);
  });

  test("switching the layout brings that keyboard's keymap", () => {
    const kb = new Keyboard();
    const result = select(kb, 1);
    expect(result.ok?.layers).toHaveLength(5);
    expect(result.ok?.layers[0].bindings).toHaveLength(53);
    expect(result.ok?.layers[0].bindings[0].behaviorId).toBe(id("Bluetooth"));
    expect(keymapOf(kb).layers).toHaveLength(5);
  });

  test("each keyboard keeps its own edits and its own unsaved state", () => {
    const kb = new Keyboard();
    select(kb, 1);
    expect(setKey(kb, 0, 0)).toBe(0);
    expect(unsaved(kb)).toBe(true);

    // Back on ErgoTrack: nothing was edited there.
    select(kb, 0);
    expect(unsaved(kb)).toBe(false);
    expect(keymapOf(kb).layers[0].bindings[0].param1).toBe(
      KEYBOARD_PAGE | 0x29,
    );

    // And GoFortyMax is as it was left.
    select(kb, 1);
    expect(unsaved(kb)).toBe(true);
    expect(keymapOf(kb).layers[0].bindings[0]).toEqual({
      behaviorId: id("Key Press"),
      param1: A,
      param2: 0,
    });

    // Discard brings back GoFortyMax's default, on GoFortyMax.
    kb.process({ requestId: 1, keymap: { discardChanges: true } });
    expect(keymapOf(kb).layers).toHaveLength(5);
    expect(keymapOf(kb).layers[0].bindings[0].behaviorId).toBe(id("Bluetooth"));
  });

  test("a layout index that does not exist is refused", () => {
    const kb = new Keyboard();
    expect(select(kb, 99).err).toBeDefined();
    expect(keymapOf(kb).layers[0].bindings).toHaveLength(81);
  });

  test("a keyboard whose keymap reserves no layer cannot add one", () => {
    const kb = new Keyboard();
    const add = () =>
      kb.process({ requestId: 1, keymap: { addLayer: {} } }).requestResponse!
        .keymap!.addLayer!;
    expect(add().ok).toBeDefined(); // ErgoTrack reserves thirteen
    expect(
      fast(kb).handleFastKeymap({ getSnapshot: {} }).snapshot!.availableLayers,
    ).toBe(12);
    select(kb, 1);
    expect(add().err).toBeDefined(); // GoFortyMax reserves none
  });

  test("fingerprints follow the content, so the web's cache cannot go stale", () => {
    const kb = new Keyboard();
    const snapshot = () =>
      fast(kb).handleFastKeymap({ getSnapshot: {} }).snapshot!;
    const ergotrack = snapshot();
    // Untouched: every layer is its default.
    for (const layer of ergotrack.layers) {
      expect(layer.fp).toBe(layer.defaultFp);
      expect(layer.editedCount).toBe(0);
    }

    select(kb, 1);
    const gofortymax = snapshot();
    expect(gofortymax.keymapFp).not.toBe(ergotrack.keymapFp);
    expect(gofortymax.physicalLayoutFp).not.toBe(ergotrack.physicalLayoutFp);
    expect(gofortymax.layers[0].fp).not.toBe(ergotrack.layers[0].fp);
    // The behaviors are the same list on both.
    expect(gofortymax.behaviorsFp).toBe(ergotrack.behaviorsFp);

    // An edit changes the layer's fingerprint and nothing about its default,
    // and get_edited_layer says which key it was.
    setKey(kb, 0, 5);
    const edited = snapshot();
    expect(edited.layers[0].fp).not.toBe(gofortymax.layers[0].fp);
    expect(edited.layers[0].defaultFp).toBe(gofortymax.layers[0].defaultFp);
    expect(edited.layers[0].editedCount).toBe(1);
    const diff = fast(kb).handleFastKeymap({
      getEditedLayer: { layerId: 0 },
    }).getEditedLayer!;
    expect(diff.bindings).toEqual([
      {
        position: 5,
        binding: { behaviorId: id("Key Press"), param1: A, param2: 0 },
      },
    ]);
    // The default itself is still GoFortyMax's.
    const stock = fast(kb).handleFastKeymap({
      getDefaultLayer: { layerId: 0 },
    }).getDefaultLayer!;
    expect(stock.bindings).toHaveLength(53);
    expect(stock.bindings[5]).not.toEqual(diff.bindings[0].binding);
  });
});
