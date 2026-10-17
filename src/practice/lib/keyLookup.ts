/**
 * Which key of the keymap types a character.
 *
 * The base layer first, then Shift on the base layer, then every layer a
 * layer key reaches. The answer names the key, any Shift to hold, and the
 * layer key to hold, which is what the practice lights up on a miss and
 * what the result's heatmap is counted on. Null means no key types the
 * character: the practice reports it and skips it (SPEC §6.2).
 */
import {
  labelOf,
  type TestBoard,
  type TestKey,
} from "../../keyTest/lib/boards";
import type { KeyLabel, LabelLayout } from "../../layoutEditor/lib/keyLabels";

const LETTER = /^[a-z]$/i;

export interface KeyHint {
  /** The key(s) that type the character; several when the keymap has duplicates. */
  keys: string[];
  /** Shift keys to hold as well. */
  shift: string[];
  /** The layer key(s) to hold, if the character sits on a layer. */
  layerKeys: string[];
  /** The layer the key sits on; 0 for the base layer. */
  layer: number;
}

function matches(label: { main: string; sub?: string }, ch: string) {
  if (LETTER.test(ch))
    return label.main.toUpperCase() === ch.toUpperCase() ? "main" : null;
  if (ch === " ") return label.main === "Space" ? "main" : null;
  if (label.main === ch) return "main";
  if (label.sub === ch) return "sub";
  return null;
}

/**
 * Which key of the keymap types `ch`, looking through the base layer and
 * then every layer a layer key reaches; null when none does, which is what
 * the practice reports as a character that cannot be typed (SPEC §6.2).
 */
export function findKey(
  board: TestBoard,
  ch: string,
  layout: LabelLayout,
): KeyHint | null {
  const shiftKeys = board.keys
    .filter((k) => k.label.main === "Shift")
    .map((k) => k.id);
  const base: string[] = [];
  const shifted: string[] = [];
  for (const k of board.keys) {
    if (k.trigger.kind !== "key" || k.trigger.mods.length) continue;
    const how = matches(k.label, ch);
    if (how === "main") base.push(k.id);
    else if (how === "sub") shifted.push(k.id);
  }
  if (base.length) return { keys: base, shift: [], layerKeys: [], layer: 0 };
  if (shifted.length)
    return { keys: shifted, shift: shiftKeys, layerKeys: [], layer: 0 };

  for (const k of board.keys) {
    for (const on of k.onLayers ?? []) {
      if (on.trigger.kind !== "key") continue;
      const how = matches(labelOf(on.trigger, layout), ch);
      if (!how) continue;
      const layerKeys = board.keys
        .filter(
          (lk) =>
            (lk.trigger.kind === "layer" && lk.trigger.layer === on.layer) ||
            (lk.trigger.kind === "key" && lk.trigger.holdLayer === on.layer),
        )
        .map((lk) => lk.id);
      return {
        keys: [k.id],
        shift: how === "sub" ? shiftKeys : [],
        layerKeys,
        layer: on.layer,
      };
    }
  }
  return null;
}

/** What a key shows on `layer` (0 = base); null when the layer leaves it as is. */
export function labelOnLayer(
  key: TestKey,
  layer: number,
  layout: LabelLayout,
): KeyLabel | null {
  if (layer === 0) return key.label;
  const on = key.onLayers?.find((o) => o.layer === layer);
  return on ? labelOf(on.trigger, layout) : null;
}

/**
 * Which key sends `code` (a KeyboardEvent.code such as "F5" or
 * "ArrowLeft"), on the base layer first and then on any layer a layer key
 * reaches; null when none does.
 */
export function findKeyByCode(board: TestBoard, code: string): KeyHint | null {
  const base = board.keys
    .filter(
      (k) =>
        k.trigger.kind === "key" &&
        k.trigger.mods.length === 0 &&
        (k.trigger.code === code || k.alsoCodes?.includes(code)),
    )
    .map((k) => k.id);
  if (base.length) return { keys: base, shift: [], layerKeys: [], layer: 0 };
  for (const k of board.keys) {
    for (const on of k.onLayers ?? []) {
      if (on.trigger.kind !== "key" || on.trigger.code !== code) continue;
      const layerKeys = board.keys
        .filter(
          (lk) =>
            (lk.trigger.kind === "layer" && lk.trigger.layer === on.layer) ||
            (lk.trigger.kind === "key" && lk.trigger.holdLayer === on.layer),
        )
        .map((lk) => lk.id);
      return { keys: [k.id], shift: [], layerKeys, layer: on.layer };
    }
  }
  return null;
}

/** The keys that send a modifier (either side), for lighting a chord. */
export function modifierKeys(
  board: TestBoard,
  mod: "ctrl" | "alt" | "meta" | "shift",
): string[] {
  const codes = {
    ctrl: ["ControlLeft", "ControlRight"],
    alt: ["AltLeft", "AltRight"],
    meta: ["MetaLeft", "MetaRight", "OSLeft", "OSRight"],
    shift: ["ShiftLeft", "ShiftRight"],
  }[mod];
  return board.keys
    .filter(
      (k) =>
        (k.trigger.kind === "key" && codes.includes(k.trigger.code)) ||
        (k.trigger.kind === "key" &&
          k.trigger.hold !== undefined &&
          codes.includes(k.trigger.hold)),
    )
    .map((k) => k.id);
}
