/**
 * "My keymaps" for the QMK side: kept in this browser (IndexedDB, a database
 * of its own beside the ZMK side's), handed on as a file, a link or a gallery
 * post. Same rules as the ZMK side (hooks/useSavedKeymaps.ts): nothing
 * reaches the keyboard until it is loaded and then saved, and demo mode can
 * keep a keymap but not hand it to anyone.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSavedKeymapStore } from "../../lib/savedKeymaps/backend";
import type { Compatibility, SavedKeymap } from "../../lib/savedKeymaps/types";
import {
  parseQmkKeymapFile,
  qmkBoardName,
  type QmkKeymapPayload,
  type QmkParseFailure,
  vilText,
} from "../lib/savedQmkKeymap";
import { toQmkShareCode, qmkShareUrlFor } from "../lib/qmkShare";
import type { UseVialKeyboard } from "./useVialKeyboard";

export const QMK_SAVED_KEYMAPS_DB = "keeb-on-studio-qmk-saved-keymaps";

export interface QmkSavedKeymap extends QmkKeymapPayload {
  id: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * The shape the ZMK side's "My keymaps" menu reads (name, description,
 * target.layoutName, updatedAt, fromDemo, id), so the same menu shows these.
 */
export type MenuRecord = SavedKeymap & { qmk: QmkSavedKeymap };

function toMenuRecord(r: QmkSavedKeymap): MenuRecord {
  return {
    ...r,
    schemaVersion: 1,
    target: { layoutName: qmkBoardName(r.board), keyCount: 0 },
    behaviors: [],
    layers: [],
    fromDemo: r.fromDemo ?? false,
    qmk: r,
  } as MenuRecord;
}

export function useQmkSavedKeymaps(keyboard: UseVialKeyboard) {
  const store = useMemo(() => createSavedKeymapStore(QMK_SAVED_KEYMAPS_DB), []);
  const [records, setRecords] = useState<QmkSavedKeymap[]>([]);
  const board = keyboard.info?.definition.name ?? null;
  const isDemo = keyboard.info?.isDemo ?? false;

  const refresh = useCallback(async () => {
    const list = (await store.list()) as unknown as QmkSavedKeymap[];
    setRecords(list.sort((a, b) => b.updatedAt - a.updatedAt));
  }, [store]);

  useEffect(() => {
    let alive = true;
    void store.list().then((list) => {
      if (!alive) return;
      setRecords(
        (list as unknown as QmkSavedKeymap[]).sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const add = useCallback(
    async (payload: QmkKeymapPayload): Promise<QmkSavedKeymap> => {
      const now = Date.now();
      const stored = (await store.add({
        ...payload,
        createdAt: now,
        updatedAt: now,
      } as never)) as unknown as QmkSavedKeymap;
      await refresh();
      return stored;
    },
    [store, refresh],
  );

  /** Keep what is on screen (the pending edits included) under a name. */
  const save = useCallback(
    async (name: string, description: string) => {
      if (!board) return null;
      const text = keyboard.exportVil();
      const parsed = parseQmkKeymapFile(text, { board, fallbackName: name });
      if (!parsed.ok) return null;
      return add({
        ...parsed.keymap,
        name: name.trim() || "Untitled",
        description: description.trim(),
        fromDemo: isDemo || undefined,
      });
    },
    [board, isDemo, keyboard, add],
  );

  const remove = useCallback(
    async (id: number) => {
      await store.remove(id);
      await refresh();
    },
    [store, refresh],
  );

  /** A file or a Vial .vil, into My keymaps. */
  const importFromFile = useCallback(
    async (
      file: File,
    ): Promise<
      { ok: true; record: QmkSavedKeymap } | ({ ok: false } & QmkParseFailure)
    > => {
      const parsed = parseQmkKeymapFile(await file.text(), {
        fallbackName: file.name.replace(/\.(vil|json)$/i, ""),
        board: board ?? undefined,
      });
      if (!parsed.ok) return parsed;
      return { ok: true, record: await add(parsed.keymap) };
    },
    [add, board],
  );

  /** Download as a Vial .vil, so it opens in Vial too. */
  const exportToFile = useCallback((record: QmkSavedKeymap) => {
    const blob = new Blob([vilText(record)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.name}.vil`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const canShare =
    Boolean(board) && !isDemo && typeof CompressionStream === "function";

  const shareLink = useCallback(
    async (record: QmkSavedKeymap): Promise<string | null> => {
      if (!canShare) return null;
      const code = await toQmkShareCode(record);
      return qmkShareUrlFor(code, `${window.location.origin}/qmk`);
    },
    [canShare],
  );

  const compatibility = useCallback(
    (record: SavedKeymap): Compatibility => {
      const r = (record as MenuRecord).qmk;
      if (!board || r.board === board) return { kind: "match" };
      return {
        kind: "different-layout",
        savedFor: qmkBoardName(r.board),
        connected: qmkBoardName(board),
      };
    },
    [board],
  );

  return {
    records,
    menuRecords: records.map(toMenuRecord),
    isDurable: store.isDurable,
    canSave: Boolean(board && keyboard.keymap),
    canShare,
    board,
    save,
    add,
    remove,
    importFromFile,
    exportToFile,
    shareLink,
    compatibility,
  };
}
