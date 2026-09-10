/**
 * Saved keymaps — the tab's side of the store.
 *
 * Holds the list, saves what the keymap tab currently has, and writes a saved
 * record back onto the connected keyboard.
 *
 * Loading goes through the same `setBinding` the editor uses, one position at
 * a time, so a loaded keymap becomes unsaved edits the user can look at and
 * then Save (or Discard) exactly like their own. Writing straight to the
 * device would skip the review step on the one operation most likely to be a
 * mistake.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSavedKeymapStore,
  compatibilityOf,
  fileNameFor,
  isShareSupported,
  parseFile,
  resolveForDevice,
  serialize,
  shareUrlFor,
  toPayload,
  toShareCode,
  type Compatibility,
  type ParseFailure,
  type SavedKeymap,
  type SavedKeymapPayload,
  type SavedKeymapStore,
  type UnresolvedBinding,
} from "../lib/savedKeymaps";
import type { BehaviorDefinition, Layer } from "./useKeymap";

export interface LoadOutcome {
  /** Positions written to the keyboard as unsaved edits. */
  written: number;
  /** Positions left alone because the keyboard has no such behavior. */
  unresolved: UnresolvedBinding[];
  /** Layers in the record that the keyboard does not have. */
  skippedLayers: number;
}

export interface UseSavedKeymapsOptions {
  layers: Layer[] | undefined;
  behaviors: Map<number, BehaviorDefinition>;
  /** The connected keyboard's layout, or null when nothing is connected. */
  connected: { layoutName: string; keyCount: number } | null;
  isDemo: boolean;
  setBinding: (
    layerId: number,
    keyPosition: number,
    binding: { behaviorId: number; param1: number; param2: number },
  ) => Promise<boolean>;
}

export interface UseSavedKeymapsReturn {
  keymaps: SavedKeymap[];
  isLoading: boolean;
  /** False when records live only in memory (private browsing, and the like). */
  isDurable: boolean;
  error: string | null;
  /** True when there is a keymap in the tab worth saving. */
  canSave: boolean;
  /**
   * True when a keymap may be handed to someone else as a link.
   *
   * Saving works in demo mode -- laying out a keymap before the keyboard
   * arrives is a real thing -- but sharing does not: a link is addressed to
   * other people, and the ones this app is for are the ones holding one of
   * these keyboards.
   */
  canShare: boolean;
  save: (name: string, description: string) => Promise<SavedKeymap | null>;
  rename: (id: number, name: string, description: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  load: (record: SavedKeymap) => Promise<LoadOutcome>;
  compatibility: (record: SavedKeymap) => Compatibility;
  /** Hands the record to the browser as a .json download. */
  exportToFile: (record: SavedKeymap) => void;
  /**
   * Reads a file into the list. Deliberately does NOT touch the keyboard:
   * importing is "add this to my keymaps", and putting one on the board stays
   * a separate, deliberate step.
   */
  importFromFile: (
    file: File,
  ) => Promise<
    { ok: true; record: SavedKeymap } | ({ ok: false } & ParseFailure)
  >;
  /** The link that carries this keymap, or null when sharing is not allowed. */
  shareLink: (record: SavedKeymap) => Promise<string | null>;
  /** Adds an already-checked keymap to the list. Same rule as import: the keyboard is not touched. */
  addKeymap: (keymap: SavedKeymapPayload) => Promise<SavedKeymap | null>;
}

export function useSavedKeymaps({
  layers,
  behaviors,
  connected,
  isDemo,
  setBinding,
}: UseSavedKeymapsOptions): UseSavedKeymapsReturn {
  // One store for the life of the page; opening IndexedDB per render would be
  // a new connection each time.
  const [store] = useState<SavedKeymapStore>(() => createSavedKeymapStore());
  const [keymaps, setKeymaps] = useState<SavedKeymap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await store.list();
      // Newest first: the one you just saved is the one you are looking for.
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
      setKeymaps(rows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const behaviorNameById = useCallback(
    (behaviorId: number) => behaviors.get(behaviorId)?.displayName ?? "",
    [behaviors],
  );

  const behaviorIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, behavior] of behaviors) {
      // First writer wins: two behaviors sharing a display name would be
      // indistinguishable to a saved record anyway.
      if (!map.has(behavior.displayName)) map.set(behavior.displayName, id);
    }
    return map;
  }, [behaviors]);

  const canSave = Boolean(layers?.length && connected);

  const save = useCallback(
    async (name: string, description: string) => {
      if (!layers?.length || !connected) return null;
      const now = Date.now();
      const payload = toPayload({
        name,
        description,
        target: connected,
        fromDemo: isDemo,
        layers: layers.map((layer) => ({
          name: layer.name,
          bindings: layer.bindings,
        })),
        behaviorName: behaviorNameById,
      });
      try {
        const stored = await store.add({
          ...payload,
          createdAt: now,
          updatedAt: now,
        });
        await refresh();
        return stored;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return null;
      }
    },
    [layers, connected, isDemo, behaviorNameById, store, refresh],
  );

  const rename = useCallback(
    async (id: number, name: string, description: string) => {
      try {
        await store.update(id, { name, description });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [store, refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      try {
        await store.remove(id);
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [store, refresh],
  );

  const load = useCallback(
    async (record: SavedKeymap): Promise<LoadOutcome> => {
      const resolved = resolveForDevice(record, behaviorIdByName);
      const target = layers ?? [];
      let written = 0;
      let skippedLayers = 0;

      for (const [layerIndex, layer] of resolved.layers.entries()) {
        const targetLayer = target[layerIndex];
        if (!targetLayer) {
          skippedLayers++;
          continue;
        }
        for (const [keyPosition, binding] of layer.bindings.entries()) {
          if (!binding) continue;
          if (keyPosition >= targetLayer.bindings.length) continue;
          const ok = await setBinding(targetLayer.id, keyPosition, binding);
          if (ok) written++;
        }
      }

      return { written, unresolved: resolved.unresolved, skippedLayers };
    },
    [behaviorIdByName, layers, setBinding],
  );

  const compatibility = useCallback(
    (record: SavedKeymap) => compatibilityOf(record, connected),
    [connected],
  );

  const exportToFile = useCallback((record: SavedKeymap) => {
    const blob = new Blob([serialize(record)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(record.name);
    // The anchor has to be in the document for `download` to be honoured --
    // clicked detached, the browser saves the blob under a generic name and
    // the keymap arrives as "download".
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can race the download in some browsers; a tick is
    // enough for the click to have been taken up.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const addKeymap = useCallback(
    async (keymap: SavedKeymapPayload) => {
      const now = Date.now();
      try {
        const stored = await store.add({
          ...keymap,
          createdAt: now,
          updatedAt: now,
        });
        await refresh();
        return stored;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return null;
      }
    },
    [store, refresh],
  );

  const importFromFile = useCallback(
    async (file: File) => {
      const parsed = parseFile(await file.text());
      if (!parsed.ok) return parsed;
      const stored = await addKeymap(parsed.keymap);
      if (!stored) {
        return { ok: false as const, reason: "malformed" as const, field: "" };
      }
      return { ok: true as const, record: stored };
    },
    [addKeymap],
  );

  // Demo mode can save but not share -- see `canShare`. Checked here as well as
  // in the menu, so a link cannot be produced by any other caller either.
  const canShare = Boolean(connected) && !isDemo && isShareSupported();

  const shareLink = useCallback(
    async (record: SavedKeymap) => {
      if (!canShare) return null;
      // The id and timestamps are this browser's bookkeeping rather than part
      // of the keymap, so they stay out of the link; whoever opens it gets
      // their own.
      const code = await toShareCode({
        schemaVersion: record.schemaVersion,
        name: record.name,
        description: record.description,
        target: record.target,
        behaviors: record.behaviors,
        layers: record.layers,
        fromDemo: record.fromDemo,
      });
      return shareUrlFor(
        code,
        `${window.location.origin}${window.location.pathname}`,
      );
    },
    [canShare],
  );

  return {
    keymaps,
    isLoading,
    isDurable: store.isDurable,
    error,
    canSave,
    canShare,
    save,
    rename,
    remove,
    load,
    compatibility,
    exportToFile,
    importFromFile,
    shareLink,
    addKeymap,
  };
}
