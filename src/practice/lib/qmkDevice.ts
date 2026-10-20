/**
 * The connected Vial (QMK) keyboard as the guide and the practice see it,
 * the counterpart of device.ts for ZMK: its keys and keymap turned into a
 * TestBoard plus a working keymap, and the guide's changes turned back
 * into QMK keycodes.
 *
 * Positions: a TestBoard key's index is an index into the visible keys
 * (`matrix` keeps each one's row and column); layers are QMK layers, whose
 * count the keyboard fixes.
 */
import { importKle } from "../../layoutEditor/lib/kle";
import { zmkToKle } from "../../layoutEditor/lib/keyboards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import {
  labelOf,
  type TestBoard,
  type TestKey,
} from "../../keyTest/lib/boards";
import { qmkTrigger, type Mod, type Trigger } from "../../keyTest/lib/triggers";
import type { VialKey } from "../../qmk/lib/vial/kle";
import {
  encodeKeycode,
  KC_NO,
  KC_TRANSPARENT,
  keycodeToText,
  MOD_LALT,
  MOD_LCTL,
  MOD_LGUI,
  MOD_LSFT,
  MOD_RIGHT,
} from "../../qmk/lib/keycodes/qmkKeycode";
import {
  HID_BY_CODE,
  type LayerBlock,
  type Unwritable,
  windowTrigger,
} from "./device";
import type { Change, WorkingKeymap } from "./guide";

export interface LiveQmkKeyboard {
  board: TestBoard;
  keymap: WorkingKeymap;
  /** Matrix position of each board key, by key index. */
  matrix: Array<{ row: number; col: number }>;
  /** Layers in the block (working-keymap layer i is device layer block.start + i). */
  layerCount: number;
  block: LayerBlock;
}

/** A QMK keycode as a trigger, through the same text the key test reads. */
export function keycodeToTrigger(code: number): Trigger {
  return qmkTrigger(keycodeToText(code));
}

const MOD_BIT: Record<Mod, number> = {
  ctrl: MOD_LCTL,
  shift: MOD_LSFT,
  alt: MOD_LALT,
  meta: MOD_LGUI,
};

/** The modifier bits a hold code (ShiftLeft, ControlRight...) stands for. */
function modsOfHold(code: string): number | null {
  const m = /^(Control|Shift|Alt|Meta)(Left|Right)$/.exec(code);
  if (!m) return null;
  const base = {
    Control: MOD_LCTL,
    Shift: MOD_LSFT,
    Alt: MOD_LALT,
    Meta: MOD_LGUI,
  }[m[1] as "Control" | "Shift" | "Alt" | "Meta"];
  return m[2] === "Right" ? base | MOD_RIGHT : base;
}

const MOUSE_CODE = [0xd1, 0xd3, 0xd2, 0xd4, 0xd5]; // Trigger.button 0..4 = L, M, R, B4, B5

/**
 * The keycode that sends `trigger`, or null when QMK has no keycode for
 * it (a layer beyond what a layer-tap can hold, a key QMK lacks).
 */
export function triggerToKeycode(trigger: Trigger): number | null {
  switch (trigger.kind) {
    case "none":
      return trigger.blocked ? KC_NO : KC_TRANSPARENT;
    case "mouse":
      return MOUSE_CODE[trigger.button] ?? null;
    case "layer":
      return trigger.layer === undefined || trigger.layer > 31
        ? null
        : encodeKeycode({ kind: "layer", op: "MO", layer: trigger.layer });
    case "key": {
      const code = HID_BY_CODE[trigger.code];
      if (code === undefined) return null;
      if (trigger.holdLayer !== undefined) {
        if (trigger.holdLayer > 15 || trigger.mods.length) return null;
        return encodeKeycode({
          kind: "layerTap",
          layer: trigger.holdLayer,
          code,
        });
      }
      if (trigger.hold) {
        const mods = modsOfHold(trigger.hold);
        if (mods === null || trigger.mods.length) return null;
        return encodeKeycode({ kind: "modTap", mods, code });
      }
      if (trigger.mods.length) {
        const mods = trigger.mods.reduce((f, m) => f | MOD_BIT[m], 0);
        return encodeKeycode({ kind: "mods", mods, code });
      }
      return encodeKeycode({ kind: "basic", code });
    }
    case "other":
      return null;
  }
}

/** The connected keyboard's visible keys and keymap as the guide uses them. */
export function liveQmkKeyboard(
  id: string,
  name: string,
  visible: VialKey[],
  keymap: number[][][],
  labelLayout: LabelLayout,
  block: LayerBlock = { start: 0, size: Math.min(4, keymap.length) },
): LiveQmkKeyboard {
  // Vial's key geometry uses the same units as a ZMK physical layout.
  const project = importKle(
    zmkToKle({
      name,
      keys: visible.map((k) => ({
        width: k.width,
        height: k.height,
        x: k.x,
        y: k.y,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
      })),
    }),
  );
  const matrix = visible.map((k) => ({ row: k.row, col: k.col }));
  const inBlock = keymap.slice(block.start, block.start + block.size);
  const layers: Trigger[][] = inBlock.map((layer) =>
    matrix.map(({ row, col }) => {
      const code = layer[row]?.[col];
      return code === undefined
        ? { kind: "none" }
        : windowTrigger(keycodeToTrigger(code), block);
    }),
  );
  const keys: TestKey[] = project.keys.map((key, pos) => {
    const trigger = layers[0]?.[pos] ?? { kind: "none" };
    const onLayers = layers
      .map((layer, l) => ({ t: layer[pos], l }))
      .filter(
        ({ t, l }) =>
          l > 0 &&
          (t.kind === "key" ||
            t.kind === "mouse" ||
            (t.kind === "none" && t.blocked)),
      )
      .map(({ t, l }) => ({ layer: l, trigger: t }));
    return {
      id: key.id,
      cx: key.cx,
      cy: key.cy,
      w: key.w,
      h: key.h,
      angle: key.angle,
      trigger,
      ...(onLayers.length ? { onLayers } : {}),
      label: labelOf(trigger, labelLayout),
    };
  });
  return {
    board: { id, name, keys },
    keymap: { layers, maxLayers: inBlock.length },
    matrix,
    layerCount: inBlock.length,
    block,
  };
}

/** The keycodes to stage for a set of changes, with what cannot be. */
/** A trigger's layer numbers moved back into the device's numbering. */
export function absolute(t: Trigger, block: LayerBlock): Trigger {
  if (t.kind === "key" && t.holdLayer !== undefined)
    return { ...t, holdLayer: t.holdLayer + block.start };
  if (t.kind === "layer" && t.layer !== undefined)
    return { ...t, layer: t.layer + block.start };
  return t;
}

export function keycodesFor(
  changes: Change[],
  live: LiveQmkKeyboard,
): {
  /** `layer` is the device's layer index. */
  writes: Array<{
    change: Change;
    layer: number;
    row: number;
    col: number;
    code: number;
  }>;
  unwritable: Unwritable[];
} {
  const writes: Array<{
    change: Change;
    layer: number;
    row: number;
    col: number;
    code: number;
  }> = [];
  const unwritable: Unwritable[] = [];
  for (const change of changes) {
    const at = live.matrix[change.pos];
    if (change.layer >= live.layerCount || !at) {
      unwritable.push({ change, reason: "layer" });
      continue;
    }
    const code = triggerToKeycode(absolute(change.trigger, live.block));
    if (code === null) {
      unwritable.push({ change, reason: "keycode" });
      continue;
    }
    writes.push({
      change,
      layer: live.block.start + change.layer,
      row: at.row,
      col: at.col,
      code,
    });
  }
  return { writes, unwritable };
}
