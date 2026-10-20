/**
 * The guide's result kept as a keymap in the remapper's "My keymaps"
 * (demo mode), named キーマップ道場, one per keyboard: the registered
 * keyboard's complete default keymap with every applied step laid over
 * it, in the format the ZMK or QMK remapper loads onto a keyboard later.
 *
 * Keys the guide does not understand (Bluetooth, trackpad behaviors) are
 * kept by their original binding text, which no keyboard resolves, so
 * loading the record leaves those keys as the keyboard has them.
 */
import type { TestBoard } from "../../keyTest/lib/boards";
import {
  qmkTrigger,
  zmkTrigger,
  type Trigger,
} from "../../keyTest/lib/triggers";
import { keyboardBindings } from "../../layoutEditor/lib/keyboards";
import {
  createSavedKeymapStore,
  toPayload,
  type SavedKeymap,
  type SavedKeymapPayload,
  type SavedKeymapStore,
} from "../../lib/savedKeymaps";
import { QMK_SAVED_KEYMAPS_DB } from "../../qmk/hooks/useQmkSavedKeymaps";
import { KC_NO, parseKeycode } from "../../qmk/lib/keycodes/qmkKeycode";
import {
  parseQmkKeymapFile,
  type QmkKeymapPayload,
} from "../../qmk/lib/savedQmkKeymap";
import { SUPPORTED_VIAL_PROTOCOL } from "../../qmk/lib/vial/protocol";
import { exportVil } from "../../qmk/lib/vil";
import { triggerToBinding, type BehaviorRole } from "./device";
import { applyChanges, type Change, type WorkingKeymap } from "./guide";
import { positionMap } from "./metadata";
import { triggerToKeycode } from "./qmkDevice";

export const DOJO_KEYMAP_NAME = "キーマップ道場";

/** The ZMK behavior names the guide writes, as the remapper's records name them. */
const ROLE_NAME: Record<BehaviorRole, string> = {
  kp: "Key Press",
  mo: "Momentary Layer",
  lt: "Layer-Tap",
  mt: "Mod-Tap",
  trans: "Trans",
  none: "None",
  mkp: "Mouse Key Press",
  to: "To Layer",
  tog: "Toggle Layer",
};

/**
 * The registered keyboard's whole default keymap as triggers, with the
 * original binding text of every key kept beside it, and the board's key
 * index for each project key (the drawing drops decals, so the two can
 * differ).
 */
function defaultKeymap(board: TestBoard) {
  const def = keyboardBindings(board.id);
  if (!def) return null;
  const parse = def.firmware === "zmk" ? zmkTrigger : qmkTrigger;
  const textLayers = [def.bindings, ...def.layers];
  // Project key index -> board key index, by where the key sits.
  const projectBoard: TestBoard = {
    id: board.id,
    name: board.name,
    keys: def.project.keys.map((k) => ({
      id: k.id,
      cx: k.cx,
      cy: k.cy,
      w: k.w,
      h: k.h,
      angle: k.angle,
      trigger: { kind: "none" },
      label: { main: "" },
    })),
  };
  const toBoard = positionMap(projectBoard, board);
  const toProject = positionMap(board, projectBoard);
  const layers: Trigger[][] = textLayers.map((texts) =>
    board.keys.map((_, pos) => {
      const pi = toProject(pos);
      return pi === null ? { kind: "none" } : parse(texts[pi]);
    }),
  );
  const texts: Array<Array<string | undefined>> = textLayers.map((t) =>
    board.keys.map((_, pos) => {
      const pi = toProject(pos);
      return pi === null ? undefined : t[pi];
    }),
  );
  return { def, layers, texts, toBoard, toProject };
}

/** The guide's result over the default keymap: every applied change in step order. */
export function dojoKeymapOf(
  board: TestBoard,
  changes: Change[],
): WorkingKeymap | null {
  const d = defaultKeymap(board);
  if (!d) return null;
  return applyChanges({ layers: d.layers }, changes);
}

export interface DojoRecord {
  firmware: "zmk" | "qmk";
  /** The saved-keymap database it belongs in (the ZMK one when undefined). */
  dbName: string | undefined;
  /** Whether a stored record is this keyboard's earlier save. */
  same: (r: SavedKeymap) => boolean;
  payload: SavedKeymapPayload | QmkKeymapPayload;
  /** Keys the guide wrote that the record could not hold. */
  skipped: number;
}

async function upsert(
  store: SavedKeymapStore,
  same: (r: SavedKeymap) => boolean,
  payload: DojoRecord["payload"],
): Promise<void> {
  const rows = await store.list();
  const existing = rows.find((r) => r.name === DOJO_KEYMAP_NAME && same(r));
  const now = Date.now();
  if (existing) await store.update(existing.id, payload as never);
  else await store.add({ ...payload, createdAt: now, updatedAt: now } as never);
}

/** The record to keep for `board` with the guide's changes, or null for an unknown board. */
export function dojoRecord(
  board: TestBoard,
  changes: Change[],
): DojoRecord | null {
  const d = defaultKeymap(board);
  if (!d) return null;
  const km = applyChanges({ layers: d.layers }, changes);
  const description = "キーマップ道場で決めたキーマップ";
  let skipped = 0;

  if (d.def.firmware === "zmk") {
    // Behavior ids here are indexes into the names the record stores.
    const names: string[] = [];
    const idOf = (name: string) => {
      let i = names.indexOf(name);
      if (i < 0) {
        i = names.length;
        names.push(name);
      }
      return i;
    };
    const ids: Partial<Record<BehaviorRole, number>> = {};
    for (const role of Object.keys(ROLE_NAME) as BehaviorRole[])
      ids[role] = idOf(ROLE_NAME[role]);
    const layers = km.layers.map((layer, l) => ({
      name: l === 0 ? "Base" : `Layer ${l}`,
      bindings: layer.map((t, pos) => {
        const b = triggerToBinding(t, ids, (i) => i);
        if (b) return b;
        // Not the guide's to write: kept by its own text, which no
        // keyboard resolves, so the key is left as it is on loading.
        const raw = d.texts[l]?.[pos];
        if (t.kind !== "other") skipped++;
        return { behaviorId: idOf(raw ?? "trans"), param1: 0, param2: 0 };
      }),
    }));
    const payload: SavedKeymapPayload = toPayload({
      name: DOJO_KEYMAP_NAME,
      description,
      target: { layoutName: d.def.project.name, keyCount: board.keys.length },
      fromDemo: true,
      layers,
      behaviorName: (id) => names[id] ?? "",
    });
    return {
      firmware: "zmk",
      dbName: undefined,
      same: (r) => r.target.layoutName === payload.target.layoutName,
      payload,
      skipped,
    };
  }

  // QMK: a .vil with the keymap by matrix position; the rest empty.
  const keys = d.def.project.keys;
  let rows = 0;
  let cols = 0;
  for (const k of keys)
    if (k.matrix) {
      rows = Math.max(rows, k.matrix.row + 1);
      cols = Math.max(cols, k.matrix.col + 1);
    }
  const textLayers = [d.def.bindings, ...d.def.layers];
  const keymap: number[][][] = textLayers.map((texts) => {
    const layer = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => KC_NO),
    );
    keys.forEach((k, pi) => {
      const text = texts[pi];
      if (k.matrix && text !== undefined)
        layer[k.matrix.row][k.matrix.col] = parseKeycode(text) ?? KC_NO;
    });
    return layer;
  });
  km.layers.forEach((layer, l) => {
    if (!keymap[l]) return;
    layer.forEach((t, pos) => {
      const pi = d.toProject(pos);
      const m = pi === null ? undefined : keys[pi]?.matrix;
      if (!m) return;
      const code = triggerToKeycode(t);
      if (code === null) {
        if (t.kind === "other") skipped++;
        return;
      }
      keymap[l][m.row][m.col] = code;
    });
  });
  const text = exportVil({
    vialProtocol: SUPPORTED_VIAL_PROTOCOL,
    keymap,
    layoutOptions: 0,
    macros: [],
    tapDances: [],
    combos: [],
    keyOverrides: [],
    settings: {},
  });
  const parsed = parseQmkKeymapFile(text, {
    board: board.id,
    fallbackName: DOJO_KEYMAP_NAME,
  });
  if (!parsed.ok) return null;
  const payload: QmkKeymapPayload = {
    ...parsed.keymap,
    name: DOJO_KEYMAP_NAME,
    description,
    board: board.id,
    fromDemo: true,
  };
  return {
    firmware: "qmk",
    dbName: QMK_SAVED_KEYMAPS_DB,
    same: (r) => (r as unknown as QmkKeymapPayload).board === board.id,
    payload,
    skipped,
  };
}

/**
 * Save the guide's result for `board` into the remapper's keymaps,
 * replacing the one saved for this keyboard before.
 */
export async function saveDojoKeymap(
  board: TestBoard,
  changes: Change[],
  storeFor: (dbName?: string) => SavedKeymapStore = createSavedKeymapStore,
): Promise<{ firmware: "zmk" | "qmk"; skipped: number } | null> {
  const record = dojoRecord(board, changes);
  if (!record) return null;
  await upsert(storeFor(record.dbName), record.same, record.payload);
  return { firmware: record.firmware, skipped: record.skipped };
}
