/**
 * The connected ZMK keyboard for the practice page: its keymap read into
 * a board the guide and the practice can use, and the guide's changes
 * written back through the same path the remapper uses (one binding at a
 * time, into the keyboard's RAM, saved to flash only when asked).
 *
 * Without a connection everything here is null and the page runs on the
 * registered keyboard's default keymap (demo mode).
 */
import { useCallback, useMemo, useState } from "react";
import { useConnection } from "../../hooks/useConnection";
import { useKeymap } from "../../hooks/useKeymap";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import {
  behaviorIds,
  bindingsFor,
  boardIdForDevice,
  liveKeyboard,
  type LiveKeyboard,
  type Unwritable,
} from "../lib/device";
import type { Change } from "../lib/guide";

export interface WriteOutcome {
  written: number;
  unwritable: Unwritable[];
  addedLayers: number;
}

export interface PracticeDevice {
  /** A keyboard is connected and its keymap has been read. */
  ready: boolean;
  connected: boolean;
  deviceName: string | undefined;
  /** The registered board the device is, for metadata and progress; null for an unknown one. */
  boardId: string | null;
  live: LiveKeyboard | null;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  /** The last write's outcome, for the page to show. */
  lastWrite: WriteOutcome | null;
  writing: boolean;
  /** Write changes to the keyboard (adding layers it lacks), in order. */
  write: (changes: Change[]) => Promise<WriteOutcome>;
  save: () => Promise<boolean>;
  discard: () => Promise<boolean>;
  connect: (method: "serial" | "ble") => void;
  disconnect: () => void;
}

export function usePracticeDevice(labelLayout: LabelLayout): PracticeDevice {
  const connection = useConnection();
  const keymap = useKeymap();
  const [lastWrite, setLastWrite] = useState<WriteOutcome | null>(null);
  const [writing, setWriting] = useState(false);

  const connected = connection.isConnected && !connection.isDemo;
  const deviceName = connection.deviceName;
  const boardId = useMemo(
    () => (connected ? boardIdForDevice(deviceName) : null),
    [connected, deviceName],
  );

  const live = useMemo(() => {
    if (!connected || !keymap.isFullyLoaded) return null;
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
    );
  }, [
    connected,
    keymap.isFullyLoaded,
    keymap.physicalLayouts,
    keymap.keymap,
    keymap.behaviors,
    boardId,
    deviceName,
    labelLayout,
  ]);

  const write = useCallback(
    async (changes: Change[]): Promise<WriteOutcome> => {
      const km = keymap.keymap;
      const outcome: WriteOutcome = {
        written: 0,
        unwritable: [],
        addedLayers: 0,
      };
      if (!km || !connected) {
        outcome.unwritable = changes.map((change) => ({
          change,
          reason: "rejected" as const,
        }));
        setLastWrite(outcome);
        return outcome;
      }
      setWriting(true);
      try {
        // Layers the changes reach beyond the keymap are added first; the
        // keyboard hands back a free slot, or null when it has none left.
        const layerIds = km.layers.map((l) => l.id);
        const highest = Math.max(-1, ...changes.map((c) => c.layer));
        while (layerIds.length <= highest) {
          const added = await keymap.addLayer();
          if (!added) break;
          layerIds.splice(added.index, 0, added.layer.id);
          outcome.addedLayers++;
        }
        const ids = behaviorIds(keymap.behaviors, km);
        const { writes, unwritable } = bindingsFor(changes, ids, layerIds);
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
      } finally {
        setWriting(false);
      }
      setLastWrite(outcome);
      return outcome;
    },
    [keymap, connected],
  );

  return {
    ready: live !== null,
    connected,
    deviceName,
    boardId,
    live,
    loading: connection.isLoading || (connected && !keymap.isFullyLoaded),
    error: connection.error ?? keymap.error,
    hasUnsavedChanges: keymap.hasUnsavedChanges,
    lastWrite,
    writing,
    write,
    save: keymap.saveChanges,
    discard: keymap.discardChanges,
    connect: connection.onConnect,
    disconnect: connection.onDisconnect,
  };
}
