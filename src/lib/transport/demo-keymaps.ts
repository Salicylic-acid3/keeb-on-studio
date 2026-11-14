/**
 * The keymap each demo keyboard starts with: its firmware's default keymap.
 *
 * The demo stands in for the keyboards this app supports, one per physical
 * layout. It used to give all of them the same keymap -- the keycode list in
 * order, A, B, C ... along the first row -- which showed where the keys are
 * and nothing about the keyboard: no thumb keys, no layer-taps, no Bluetooth
 * key, and the trackpad buttons were letters. A person trying the app before
 * the keyboard arrives should see the keymap they will get.
 *
 * demoKeymaps.json is written by scripts/generateDemoKeymaps.py from each
 * keyboard's .keymap, run through the C preprocessor with the firmware's own
 * dt-bindings, so the numbers are the ones the keyboard reports. It names
 * behaviors by display name, which is how the Studio protocol identifies
 * them; they are matched to the demo's behavior ids here.
 */
import generated from "./demoKeymaps.json";
import {
  HID_USAGE_PAGE_KEYBOARD,
  KEYBOARD_KEYCODES,
  createHidUsage,
} from "../keycodes";

export interface DemoBinding {
  behaviorId: number;
  param1: number;
  param2: number;
}

export interface DemoLayer {
  id: number;
  name: string;
  bindings: DemoBinding[];
}

export interface DemoKeymap {
  layers: DemoLayer[];
  /** How many more layers can be added: the keymap's `status = "reserved"`
   * nodes. A keymap without any cannot grow, on the keyboard or here. */
  availableLayers: number;
  maxLayerNameLength: number;
}

interface GeneratedKeyboard {
  source: string;
  reservedLayers: number;
  behaviors: string[];
  layers: Array<{ name: string; bindings: number[][] }>;
}

const KEYBOARDS = generated.keyboards as Record<string, GeneratedKeyboard>;

const MAX_LAYER_NAME_LENGTH = 32;

/** The layout names demoKeymaps.json has a default keymap for. */
export function demoKeymapNames(): string[] {
  return Object.keys(KEYBOARDS);
}

/** Display names of the behaviors a keyboard's default keymap uses. */
export function demoKeymapBehaviors(layoutName: string): string[] {
  return KEYBOARDS[layoutName]?.behaviors ?? [];
}

function idByName(
  behaviors: ReadonlyArray<{ id: number; displayName: string }>,
  name: string,
): number {
  const found = behaviors.find((b) => b.displayName === name);
  if (!found) {
    // A default keymap that uses a behavior the demo does not have would
    // otherwise load as a keymap full of unknown ids. Fail where it is
    // obvious; demo-keymaps.test.ts keeps this from reaching a build.
    throw new Error(`Demo has no behavior named "${name}"`);
  }
  return found.id;
}

/**
 * The stand-in for a layout with no default keymap on file: the keycode list
 * in order on Base, with an empty Alt Base (the layer the per-OS default
 * layer feature keys off) so that feature can still be tried.
 */
function placeholderKeymap(
  keyCount: number,
  behaviors: ReadonlyArray<{ id: number; displayName: string }>,
): DemoKeymap {
  const keyPress = idByName(behaviors, "Key Press");
  const transparent = idByName(behaviors, "Transparent");
  return {
    layers: [
      {
        id: 0,
        name: "Base",
        // createHidUsage, because a binding carries the full usage with its
        // page; the bare id is a binding no keyboard would accept.
        bindings: KEYBOARD_KEYCODES.slice(0, keyCount).map((code) => ({
          behaviorId: keyPress,
          param1: createHidUsage(HID_USAGE_PAGE_KEYBOARD, code.code),
          param2: 0,
        })),
      },
      {
        id: 1,
        name: "Alt Base",
        bindings: Array.from({ length: keyCount }, () => ({
          behaviorId: transparent,
          param1: 0,
          param2: 0,
        })),
      },
    ],
    availableLayers: 8,
    maxLayerNameLength: MAX_LAYER_NAME_LENGTH,
  };
}

/** A fresh copy of the default keymap of the keyboard `layout` stands for. */
export function defaultKeymapFor(
  layout: { name: string; keys: ArrayLike<unknown> },
  behaviors: ReadonlyArray<{ id: number; displayName: string }>,
): DemoKeymap {
  const keyboard = KEYBOARDS[layout.name];
  if (!keyboard) return placeholderKeymap(layout.keys.length, behaviors);

  const ids = keyboard.behaviors.map((name) => idByName(behaviors, name));
  return {
    layers: keyboard.layers.map((layer, id) => ({
      id,
      name: layer.name,
      bindings: layer.bindings.map(([behavior, param1, param2]) => ({
        behaviorId: ids[behavior],
        param1,
        param2,
      })),
    })),
    availableLayers: keyboard.reservedLayers,
    maxLayerNameLength: MAX_LAYER_NAME_LENGTH,
  };
}

/**
 * A fingerprint of `value` (FNV-1a over its JSON), as a uint32.
 *
 * The fast keymap protocol lets the web skip anything whose fingerprint it
 * has cached in localStorage. The demo used to answer with constants, which
 * was sound only while its content never changed: with a keymap per keyboard,
 * and every time the demo data itself is updated, the same fingerprint would
 * name different content and the web would draw what it had cached.
 */
export function fingerprint(value: unknown): number {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const sameBinding = (a: DemoBinding | undefined, b: DemoBinding | undefined) =>
  !!a &&
  !!b &&
  a.behaviorId === b.behaviorId &&
  a.param1 === b.param1 &&
  a.param2 === b.param2;

/** The positions of `layer` that differ from `defaults`, with their bindings. */
export function editedBindings(
  layer: DemoLayer,
  defaults: DemoLayer | undefined,
): Array<{ position: number; binding: DemoBinding }> {
  const edited: Array<{ position: number; binding: DemoBinding }> = [];
  layer.bindings.forEach((binding, position) => {
    if (!sameBinding(binding, defaults?.bindings[position])) {
      edited.push({ position, binding });
    }
  });
  return edited;
}
