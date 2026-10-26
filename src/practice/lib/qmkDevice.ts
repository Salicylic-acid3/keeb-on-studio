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
  decodeKeycode,
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
import type { VialTapDanceEntry } from "../../qmk/lib/vial/protocol";
import {
  HID_BY_CODE,
  type LayerBlock,
  needsTapDance,
  type Unwritable,
  windowTrigger,
} from "./device";

/** QMK's own basic keycodes for keys the HID keyboard page has no usage for. */
const QMK_ONLY: Record<string, number> = {
  AudioVolumeMute: 0xa8,
  AudioVolumeUp: 0xa9,
  AudioVolumeDown: 0xaa,
};
const CODE_BY_QMK_ONLY: Record<number, string> = Object.fromEntries(
  Object.entries(QMK_ONLY).map(([code, id]) => [id, code]),
);
const basicCode = (code: string): number | undefined =>
  HID_BY_CODE[code] ?? QMK_ONLY[code];
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

/**
 * A QMK keycode as a trigger, through the same text the key test reads;
 * a tap dance is read from its entry, when the entries are given.
 */
export function keycodeToTrigger(
  code: number,
  tapDances?: VialTapDanceEntry[],
): Trigger {
  const key = decodeKeycode(code);
  if (key.kind === "tapDance" && tapDances) {
    const t = tapDanceToTrigger(tapDances[key.index]);
    if (t) return t;
  }
  if (key.kind === "basic" && CODE_BY_QMK_ONLY[key.code])
    return { kind: "key", code: CODE_BY_QMK_ONLY[key.code], mods: [] };
  return qmkTrigger(keycodeToText(code));
}

/**
 * A Vial tap dance as a key trigger: its tap (a plain key, possibly with
 * modifiers), its hold as a modifier, its double tap as a plain key.
 * Anything else the guide does not describe, so null.
 */
export function tapDanceToTrigger(
  e: VialTapDanceEntry | undefined,
): Trigger | null {
  if (!e) return null;
  const tap = qmkTrigger(keycodeToText(e.onTap));
  if (tap.kind !== "key" || tap.hold || tap.holdLayer !== undefined)
    return null;
  const out: Extract<Trigger, { kind: "key" }> = {
    kind: "key",
    code: tap.code,
    mods: tap.mods,
  };
  if (e.onHold !== KC_NO) {
    const hold = qmkTrigger(keycodeToText(e.onHold));
    if (
      hold.kind !== "key" ||
      hold.mods.length ||
      modsOfHold(hold.code) === null
    )
      return null;
    out.hold = hold.code;
  }
  if (e.onDoubleTap !== KC_NO) {
    const dbl = qmkTrigger(keycodeToText(e.onDoubleTap));
    if (dbl.kind !== "key" || dbl.mods.length) return null;
    out.doubleTap = dbl.code;
  }
  if (e.onTapHold !== KC_NO) return null;
  if (e.tappingTerm) out.term = e.tappingTerm;
  return out;
}

/** The tap-dance entry for a trigger that needs one, or null when it cannot be one. */
export function triggerToTapDance(t: Trigger): VialTapDanceEntry | null {
  if (t.kind !== "key" || t.holdLayer !== undefined) return null;
  const code = basicCode(t.code);
  if (code === undefined) return null;
  const onTap = t.mods.length
    ? encodeKeycode({
        kind: "mods",
        mods: t.mods.reduce((f, m) => f | MOD_BIT[m], 0),
        code,
      })
    : encodeKeycode({ kind: "basic", code });
  let onHold = KC_NO;
  if (t.hold) {
    const h = basicCode(t.hold);
    if (h === undefined || modsOfHold(t.hold) === null) return null;
    onHold = encodeKeycode({ kind: "basic", code: h });
  }
  let onDoubleTap = KC_NO;
  if (t.doubleTap) {
    const d = basicCode(t.doubleTap);
    if (d === undefined) return null;
    onDoubleTap = encodeKeycode({ kind: "basic", code: d });
  }
  return {
    onTap,
    onHold,
    onDoubleTap,
    onTapHold: KC_NO,
    tappingTerm: t.term ?? 200,
  };
}

const sameTapDance = (a: VialTapDanceEntry, b: VialTapDanceEntry) =>
  a.onTap === b.onTap &&
  a.onHold === b.onHold &&
  a.onDoubleTap === b.onDoubleTap &&
  a.onTapHold === b.onTapHold &&
  a.tappingTerm === b.tappingTerm;
const emptyTapDance = (e: VialTapDanceEntry) =>
  e.onTap === KC_NO &&
  e.onHold === KC_NO &&
  e.onDoubleTap === KC_NO &&
  e.onTapHold === KC_NO;

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
      // A double tap or a tapping term of its own needs a tap dance entry.
      if (needsTapDance(trigger)) return null;
      const code = basicCode(trigger.code);
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
  block: LayerBlock = { start: 0, size: keymap.length },
  tapDances?: VialTapDanceEntry[],
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
        : windowTrigger(keycodeToTrigger(code, tapDances), block);
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
  tapDances: VialTapDanceEntry[] = [],
): {
  /** `layer` is the device's layer index. */
  writes: Array<{
    change: Change;
    layer: number;
    row: number;
    col: number;
    code: number;
  }>;
  /** Tap-dance entries to set, each at its index, before the keycodes. */
  tapDanceWrites: Array<{ index: number; entry: VialTapDanceEntry }>;
  unwritable: Unwritable[];
} {
  const writes: Array<{
    change: Change;
    layer: number;
    row: number;
    col: number;
    code: number;
  }> = [];
  const tapDanceWrites: Array<{ index: number; entry: VialTapDanceEntry }> = [];
  const entries = tapDances.map((e) => ({ ...e }));
  // The entry that already is this tap dance, else the first empty one.
  const tapDanceIndex = (entry: VialTapDanceEntry): number | null => {
    let i = entries.findIndex((e) => sameTapDance(e, entry));
    if (i < 0) i = entries.findIndex(emptyTapDance);
    if (i < 0) return null;
    if (!sameTapDance(entries[i], entry)) {
      entries[i] = entry;
      tapDanceWrites.push({ index: i, entry });
    }
    return i;
  };
  const unwritable: Unwritable[] = [];
  for (const change of changes) {
    const at = live.matrix[change.pos];
    if (change.layer >= live.layerCount || !at) {
      unwritable.push({ change, reason: "layer" });
      continue;
    }
    const t = absolute(change.trigger, live.block);
    let code: number | null;
    if (needsTapDance(t)) {
      const entry = triggerToTapDance(t);
      const index = entry ? tapDanceIndex(entry) : null;
      code = index === null ? null : encodeKeycode({ kind: "tapDance", index });
    } else code = triggerToKeycode(t);
    if (code === null) {
      unwritable.push({
        change,
        reason: needsTapDance(t) ? "tapdance" : "keycode",
      });
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
  return { writes, tapDanceWrites, unwritable };
}
