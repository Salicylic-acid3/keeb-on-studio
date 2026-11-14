/**
 * The connected keyboard for the practice page, ZMK or Vial (QMK): its
 * keymap read into a board the guide and the practice can use, and the
 * guide's changes written back through the same paths the remappers use.
 *
 * ZMK: each binding goes to the keyboard's memory at once (setBinding),
 * and "save" writes them to flash. Vial: each keycode is staged in the
 * browser (setKeycode), and "save" writes them all to the keyboard. From
 * the page both look the same: written, then saved.
 *
 * Without a connection everything here is null and the page runs on the
 * registered keyboard's default keymap (demo mode).
 */
import { useCallback, useMemo, useState } from "react";
import { tapBinding, useTapDance } from "../../components/tapDance/useTapDance";
import { useConnection } from "../../hooks/useConnection";
import { useDefaultLayer } from "../../hooks/useDefaultLayer";
import { useKeymap } from "../../hooks/useKeymap";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { useVialKeyboardContext } from "../../qmk/hooks/useVialKeyboardContext";
import {
  isWebHidAvailable,
  requestWebHidTransport,
} from "../../qmk/lib/vial/transport";
import {
  behaviorIds,
  bindingsFor,
  boardIdForDevice,
  type Dance,
  liveKeyboard,
  type LayerBlock,
  needsTapDance,
  sameDance,
  triggerToDance,
  type Unwritable,
  wholeBlock,
} from "../lib/device";
import type { Change, WorkingKeymap } from "../lib/guide";
import { keycodesFor, liveQmkKeyboard } from "../lib/qmkDevice";
import type { TestBoard } from "../../keyTest/lib/boards";

export type DeviceFirmware = "zmk" | "qmk";

export interface WriteOutcome {
  written: number;
  unwritable: Unwritable[];
  addedLayers: number;
}

export interface PracticeDevice {
  /** A keyboard is connected and its keymap has been read. */
  ready: boolean;
  connected: boolean;
  firmware: DeviceFirmware | null;
  deviceName: string | undefined;
  /** The registered board the device is, for metadata and progress; null for an unknown one. */
  boardId: string | null;
  live: { board: TestBoard; keymap: WorkingKeymap; block: LayerBlock } | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  /** The last write's outcome, for the page to show. */
  lastWrite: WriteOutcome | null;
  writing: boolean;
  /** Write changes to the keyboard (adding layers it lacks, where it can), in order. */
  write: (changes: Change[]) => Promise<WriteOutcome>;
  save: () => Promise<boolean>;
  discard: () => Promise<boolean>;
  connect: (firmware: DeviceFirmware) => void;
  disconnect: () => void;
}

export function usePracticeDevice(labelLayout: LabelLayout): PracticeDevice {
  const connection = useConnection();
  const keymap = useKeymap();
  const defaultLayer = useDefaultLayer();
  const vial = useVialKeyboardContext();
  const [lastWrite, setLastWrite] = useState<WriteOutcome | null>(null);
  const [writing, setWriting] = useState(false);
  const [qmkError, setQmkError] = useState<string | null>(null);
  const [qmkConnecting, setQmkConnecting] = useState(false);

  const zmkConnected = connection.isConnected && !connection.isDemo;
  const qmkConnected = vial.info !== null && !vial.info.isDemo;
  const firmware: DeviceFirmware | null = zmkConnected
    ? "zmk"
    : qmkConnected
      ? "qmk"
      : null;
  const deviceName =
    firmware === "zmk"
      ? connection.deviceName
      : firmware === "qmk"
        ? vial.info?.productName
        : undefined;
  const boardId = useMemo(() => {
    if (firmware === "zmk") return boardIdForDevice(connection.deviceName);
    if (firmware === "qmk") return vial.info?.definition.name ?? null;
    return null;
  }, [firmware, connection.deviceName, vial.info]);

  // The block of layers the guide works in. ZMK: the default-layer module
  // says which layer the current OS / endpoint lands on; the other OS base
  // layers bound the block (at most four layers: the base and three). QMK:
  // the OS-switch module's active block. Without either, the whole keymap.
  const zmkBlock = useMemo((): LayerBlock | null => {
    const km = keymap.keymap;
    if (!km) return null;
    const st = defaultLayer.state;
    if (!st || st.resolvedLayer < 0) return wholeBlock(km.layers.length);
    const bases = new Set<number>();
    for (const o of st.osLayers) if (o.value >= 0) bases.add(o.value);
    for (const e of st.endpoints) if (e.value >= 0) bases.add(e.value);
    bases.add(st.resolvedLayer);
    const sorted = [...bases].sort((a, b) => a - b);
    if (sorted.length < 2) return wholeBlock(km.layers.length);
    const start = st.resolvedLayer;
    const next = sorted.find((b) => b > start) ?? km.layers.length;
    return { start, size: Math.min(4, Math.max(1, next - start)) };
  }, [keymap.keymap, defaultLayer.state]);

  // The runtime tap dance module's slots (zmk-feature-runtime-tap-dance),
  // where a key's double tap or its own tapping term lives on ZMK.
  const tapDance = useTapDance(keymap.behaviors);
  const dances = useMemo(() => {
    const out = new Map<number, Dance>();
    for (const slot of tapDance.slots)
      out.set(slot.index, {
        taps: slot.taps.map(
          (t) => tapBinding(t) ?? { behaviorId: 0, param1: 0, param2: 0 },
        ),
        holds: slot.holds.map((h) => {
          const b = tapBinding(h);
          return b && b.behaviorId !== tapDance.noneBehaviorId ? b : null;
        }),
        ...(slot.term?.value?.int32Value !== undefined
          ? { term: slot.term.value.int32Value }
          : {}),
      });
    return out;
  }, [tapDance.slots, tapDance.noneBehaviorId]);

  const liveZmk = useMemo(() => {
    if (firmware !== "zmk" || !keymap.isFullyLoaded || !zmkBlock) return null;
    const layouts = keymap.physicalLayouts;
    const km = keymap.keymap;
    if (!layouts || !km) return null;
    const layout = layouts.layouts[layouts.activeLayoutIndex];
    if (!layout) return null;
    return liveKeyboard(
      boardId ?? `zmk:${(deviceName ?? "keyboard").toLowerCase()}`,
      deviceName ?? layout.name,
      layout,
      km,
      keymap.behaviors,
      labelLayout,
      zmkBlock,
      dances,
    );
  }, [
    firmware,
    keymap.isFullyLoaded,
    keymap.physicalLayouts,
    keymap.keymap,
    keymap.behaviors,
    boardId,
    deviceName,
    labelLayout,
    zmkBlock,
    dances,
  ]);

  // The Vial board is built from the saved keymap, not the staged one, so
  // the guide's own working keymap stays the one source of its changes.
  const liveQmk = useMemo(() => {
    if (firmware !== "qmk" || !vial.info || !vial.saved) return null;
    const os = vial.os;
    // With a block of layers per OS, the guide works in the current OS's
    // block (base and three); otherwise in the whole keymap, whose layer
    // count the firmware fixes.
    const block: LayerBlock = os
      ? {
          start: (os.previewBlock ?? os.activeBlock) * os.layersPerBlock,
          size: Math.min(4, os.layersPerBlock),
        }
      : { start: 0, size: vial.saved.length };
    return liveQmkKeyboard(
      boardId ?? `qmk:${vial.info.productName.toLowerCase()}`,
      vial.info.productName,
      vial.visible,
      vial.saved,
      labelLayout,
      block,
      vial.savedTapDances,
    );
  }, [
    firmware,
    vial.info,
    vial.saved,
    vial.visible,
    vial.os,
    vial.savedTapDances,
    boardId,
    labelLayout,
  ]);

  const live = liveZmk ?? liveQmk;

  const write = useCallback(
    async (changes: Change[]): Promise<WriteOutcome> => {
      const outcome: WriteOutcome = {
        written: 0,
        unwritable: [],
        addedLayers: 0,
      };
      const rejectAll = () => {
        outcome.unwritable = changes.map((change) => ({
          change,
          reason: "rejected" as const,
        }));
        setLastWrite(outcome);
        return outcome;
      };
      setWriting(true);
      try {
        if (firmware === "zmk") {
          const km = keymap.keymap;
          if (!km || !liveZmk) return rejectAll();
          // Layers the changes reach beyond the block's existing layers are
          // added first, while the block has room; the keyboard hands back
          // a free slot, or null when it has none left.
          const layerIds = [...liveZmk.layerIds];
          const highest = Math.max(-1, ...changes.map((c) => c.layer));
          while (
            layerIds.length <= highest &&
            layerIds.length < liveZmk.block.size
          ) {
            const added = await keymap.addLayer();
            if (!added) break;
            layerIds.push(added.layer.id);
            outcome.addedLayers++;
          }
          const ids = behaviorIds(keymap.behaviors, km);
          // A key with a double tap or its own tapping term is a tap dance
          // slot: one already holding that dance, else a free one set up
          // for it. Without the module (or a free slot) the key is set aside.
          const slotOf = new Map<Change, number>();
          const taken = new Set<number>();
          for (const change of changes) {
            if (!needsTapDance(change.trigger) || ids.rtd === undefined)
              continue;
            const dance = triggerToDance(change.trigger, ids);
            if (!dance) continue;
            let slot = tapDance.slots.find((sl) => {
              const d = dances.get(sl.index);
              return d && sameDance(d, dance);
            });
            if (!slot) {
              slot = tapDance.slots.find(
                (sl) => sl.taps.length === 0 && !taken.has(sl.index),
              );
              if (slot && !(await tapDance.setDance(slot, dance)))
                slot = undefined;
            }
            if (slot) {
              taken.add(slot.index);
              slotOf.set(change, slot.index);
            }
          }
          const { writes, unwritable } = bindingsFor(
            changes,
            ids,
            layerIds,
            (c) => slotOf.get(c),
          );
          outcome.unwritable.push(...unwritable);
          for (const w of writes) {
            const ok = await keymap.setBinding(
              w.layerId,
              w.change.pos,
              w.binding,
            );
            if (ok) outcome.written++;
            else
              outcome.unwritable.push({ change: w.change, reason: "rejected" });
          }
        } else if (firmware === "qmk") {
          if (!liveQmk) return rejectAll();
          // QMK's layer count is fixed by the firmware; nothing can be added.
          const { writes, tapDanceWrites, unwritable } = keycodesFor(
            changes,
            liveQmk,
            vial.tapDances,
          );
          outcome.unwritable.push(...unwritable);
          for (const td of tapDanceWrites) vial.setTapDance(td.index, td.entry);
          for (const w of writes) {
            vial.setKeycode(w.layer, w.row, w.col, w.code);
            outcome.written++;
          }
        } else {
          return rejectAll();
        }
      } finally {
        setWriting(false);
      }
      setLastWrite(outcome);
      return outcome;
    },
    [firmware, keymap, liveZmk, liveQmk, vial, tapDance, dances],
  );

  const connectQmk = useCallback(async () => {
    setQmkError(null);
    if (!isWebHidAvailable()) {
      setQmkError("WebHID is not available in this browser.");
      return;
    }
    setQmkConnecting(true);
    try {
      const transport = await requestWebHidTransport();
      if (!transport) return;
      await vial.connect(transport, "hid");
    } catch (e) {
      setQmkError(e instanceof Error ? e.message : String(e));
    } finally {
      setQmkConnecting(false);
    }
  }, [vial]);

  const connect = useCallback(
    (which: DeviceFirmware) => {
      if (which === "zmk") connection.onConnect("serial");
      else void connectQmk();
    },
    [connection, connectQmk],
  );

  const disconnect = useCallback(() => {
    if (firmware === "zmk") connection.onDisconnect();
    else if (firmware === "qmk") void vial.disconnect();
  }, [firmware, connection, vial]);

  const save = useCallback(async () => {
    if (firmware === "zmk") {
      // The tap dance slots the guide set up are settings of their own,
      // saved beside the keymap.
      if (tapDance.hasUnsavedChanges) await tapDance.save();
      return keymap.saveChanges();
    }
    if (firmware === "qmk") {
      await vial.saveChanges();
      return true;
    }
    return false;
  }, [firmware, keymap, vial, tapDance]);

  const discard = useCallback(async () => {
    if (firmware === "zmk") {
      if (tapDance.hasUnsavedChanges) await tapDance.discard();
      return keymap.discardChanges();
    }
    if (firmware === "qmk") {
      vial.discardChanges();
      return true;
    }
    return false;
  }, [firmware, keymap, vial, tapDance]);

  return {
    ready: live !== null,
    connected: firmware !== null,
    firmware,
    deviceName,
    boardId,
    live,
    loading:
      connection.isLoading ||
      qmkConnecting ||
      vial.isConnecting ||
      (firmware === "zmk" && !keymap.isFullyLoaded),
    error: connection.error ?? keymap.error ?? qmkError ?? vial.error,
    hasUnsavedChanges:
      firmware === "zmk"
        ? keymap.hasUnsavedChanges || tapDance.hasUnsavedChanges
        : firmware === "qmk"
          ? vial.hasUnsavedChanges
          : false,
    lastWrite,
    writing: writing || vial.isSaving,
    write,
    save,
    discard,
    connect,
    disconnect,
  };
}
