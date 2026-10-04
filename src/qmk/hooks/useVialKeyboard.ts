/**
 * One connected Vial keyboard: its definition, its keymap, the edits waiting
 * to be written, and the OS-switch module's state.
 *
 * Edits are held here and written on Save, the same rhythm as the ZMK side:
 * `keymap` is what the page shows (saved values plus pending edits), `saved`
 * is what the keyboard holds, and a key's reset goes back to `saved`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VialClient,
  SUPPORTED_VIAL_PROTOCOL,
  type KeebOnOsState,
  type VialDynamicEntryCounts,
  type VialTapDanceEntry,
  type VialComboEntry,
  type VialKeyOverrideEntry,
} from "../lib/vial/protocol";
import { readDefinition, type VialDefinition } from "../lib/vial/definition";
import { parseKleLayout, visibleKeys, type VialKey } from "../lib/vial/kle";
import type { VialTransport } from "../lib/vial/transport";
import { DemoTransport, base64ToBytes } from "../lib/vial/demoTransport";
import {
  DEMO_DEFINITION_XZ_BASE64,
  DEMO_KEYMAP,
} from "../demo/clickboardErgoMini";

export type VialConnectionMethod = "hid" | "demo";

export interface VialKeyboardInfo {
  productName: string;
  definition: VialDefinition;
  keys: VialKey[];
  layerCount: number;
  isDemo: boolean;
  unlockKeys: Array<{ row: number; col: number }>;
  /** How many tap dance / combo / key override slots the firmware has. */
  entryCounts: VialDynamicEntryCounts;
}

export interface UseVialKeyboard {
  info: VialKeyboardInfo | null;
  /** keycodes[layer][row][col] as shown: saved values plus pending edits */
  keymap: number[][][] | null;
  /** keycodes[layer][row][col] as the keyboard holds them */
  saved: number[][][] | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  /** Tap dance slots as shown (saved plus pending edits) and as saved. */
  tapDances: VialTapDanceEntry[];
  savedTapDances: VialTapDanceEntry[];
  setTapDance(index: number, entry: VialTapDanceEntry): void;
  combos: VialComboEntry[];
  savedCombos: VialComboEntry[];
  setCombo(index: number, entry: VialComboEntry): void;
  keyOverrides: VialKeyOverrideEntry[];
  savedKeyOverrides: VialKeyOverrideEntry[];
  setKeyOverride(index: number, entry: VialKeyOverrideEntry): void;
  layoutOptions: number;
  visible: VialKey[];
  os: KeebOnOsState | null;
  isConnecting: boolean;
  error: string | null;
  connect(
    transport: VialTransport,
    method: VialConnectionMethod,
  ): Promise<void>;
  connectDemo(): Promise<void>;
  disconnect(): Promise<void>;
  /** Stage an edit; nothing reaches the keyboard until saveChanges(). */
  setKeycode(layer: number, row: number, col: number, code: number): void;
  /** Drop the pending edit on one key. */
  resetKey(layer: number, row: number, col: number): void;
  saveChanges(): Promise<void>;
  discardChanges(): void;
  reload(): Promise<void>;
  setLayoutOptions(value: number): Promise<void>;
  setOs(mode: number, blocks: [number, number, number, number]): Promise<void>;
  setOsPreview(block: number | null): Promise<void>;
  refreshOs(): Promise<void>;
}

export function createDemoTransport(): DemoTransport {
  return new DemoTransport({
    productName: "ClickBoard ErgoMini (demo)",
    definition: base64ToBytes(DEMO_DEFINITION_XZ_BASE64),
    rows: 10,
    cols: 6,
    keymap: DEMO_KEYMAP,
    keebOnOs: { layersPerBlock: 4, blockCount: 3, detectedOs: guessHostOs() },
    unlockKeys: [
      { row: 0, col: 6 },
      { row: 0, col: 5 },
    ],
    dynamicEntries: { tapDance: 32, combo: 32, keyOverride: 32 },
  });
}

/** QMK os_variant_t for the browser's own OS, so the demo feels like home. */
function guessHostOs(): number {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Mac|iPhone|iPad/.test(ua)) return 3;
  if (/Linux|Android/.test(ua)) return 1;
  return 2;
}

interface LoadedEntries {
  tapDances: VialTapDanceEntry[];
  combos: VialComboEntry[];
  keyOverrides: VialKeyOverrideEntry[];
}

async function readEntries(
  client: VialClient,
  counts: VialDynamicEntryCounts,
): Promise<LoadedEntries> {
  const out: LoadedEntries = { tapDances: [], combos: [], keyOverrides: [] };
  for (let i = 0; i < counts.tapDance; i++)
    out.tapDances.push(await client.getTapDance(i));
  for (let i = 0; i < counts.combo; i++)
    out.combos.push(await client.getCombo(i));
  for (let i = 0; i < counts.keyOverride; i++)
    out.keyOverrides.push(await client.getKeyOverride(i));
  return out;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(list: T[]): T[] => list.map((e) => structuredCloneSafe(e));
function structuredCloneSafe<T>(e: T): T {
  return JSON.parse(JSON.stringify(e)) as T;
}
const changed = <T>(list: T[], saved: T[]) =>
  list.some((e, i) => !same(e, saved[i]));

export function useVialKeyboard(): UseVialKeyboard {
  const clientRef = useRef<VialClient | null>(null);
  const [info, setInfo] = useState<VialKeyboardInfo | null>(null);
  const [keymap, setKeymap] = useState<number[][][] | null>(null);
  const [saved, setSaved] = useState<number[][][] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tapDances, setTapDances] = useState<VialTapDanceEntry[]>([]);
  const [savedTapDances, setSavedTapDances] = useState<VialTapDanceEntry[]>([]);
  const [combos, setCombos] = useState<VialComboEntry[]>([]);
  const [savedCombos, setSavedCombos] = useState<VialComboEntry[]>([]);
  const [keyOverrides, setKeyOverrides] = useState<VialKeyOverrideEntry[]>([]);
  const [savedKeyOverrides, setSavedKeyOverrides] = useState<
    VialKeyOverrideEntry[]
  >([]);

  const applyEntries = useCallback((e: LoadedEntries) => {
    setTapDances(e.tapDances);
    setSavedTapDances(copy(e.tapDances));
    setCombos(e.combos);
    setSavedCombos(copy(e.combos));
    setKeyOverrides(e.keyOverrides);
    setSavedKeyOverrides(copy(e.keyOverrides));
  }, []);
  const [layoutOptions, setLayoutOptionsState] = useState(0);
  const [os, setOsState] = useState<KeebOnOsState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    clientRef.current = null;
    setInfo(null);
    setKeymap(null);
    setSaved(null);
    setTapDances([]);
    setSavedTapDances([]);
    setCombos([]);
    setSavedCombos([]);
    setKeyOverrides([]);
    setSavedKeyOverrides([]);
    setOsState(null);
    setLayoutOptionsState(0);
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    clear();
    if (client) {
      try {
        await client.transport.close();
      } catch {
        // Already gone; nothing to do.
      }
    }
  }, [clear]);

  const connect = useCallback(
    async (transport: VialTransport, method: VialConnectionMethod) => {
      setIsConnecting(true);
      setError(null);
      const client = new VialClient(transport);
      try {
        const id = await client.getKeyboardId();
        if (id.vialProtocol !== SUPPORTED_VIAL_PROTOCOL) {
          throw new Error(
            `This keyboard speaks Vial protocol ${id.vialProtocol}; Keeb-On! Studio expects ${SUPPORTED_VIAL_PROTOCOL}.`,
          );
        }
        const definition = await readDefinition(
          await client.getDefinitionBytes(),
        );
        const keys = parseKleLayout(definition.keymap);
        const layerCount = await client.getLayerCount();
        const { rows, cols } = definition.matrix;
        const map = await client.getKeymap(layerCount, rows, cols);
        const options = definition.layoutLabels.length
          ? await client.getLayoutOptions()
          : 0;
        const unlock = await client.getUnlockStatus();
        const entryCounts = await client.getDynamicEntryCounts();
        const entries = await readEntries(client, entryCounts);
        const osState = definition.keebOn?.osProtocol
          ? await client.getKeebOnOs()
          : null;
        transport.onDisconnect(() => {
          clear();
          setError(null);
        });
        clientRef.current = client;
        setInfo({
          productName: transport.productName,
          definition,
          keys,
          layerCount,
          isDemo: method === "demo",
          unlockKeys: unlock.unlockKeys,
          entryCounts,
        });
        applyEntries(entries);
        setKeymap(map);
        setSaved(map.map((l) => l.map((r) => [...r])));
        setLayoutOptionsState(options);
        setOsState(osState);
      } catch (err) {
        clientRef.current = null;
        setError(err instanceof Error ? err.message : String(err));
        try {
          await transport.close();
        } catch {
          // ignore
        }
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [clear, applyEntries],
  );

  const connectDemo = useCallback(async () => {
    await connect(createDemoTransport(), "demo");
  }, [connect]);

  const setKeycode = useCallback(
    (layer: number, row: number, col: number, code: number) => {
      setKeymap((prev) => {
        if (!prev || prev[layer]?.[row]?.[col] === code) return prev;
        const next = prev.map((l, li) =>
          li === layer ? l.map((r) => [...r]) : l,
        );
        next[layer][row][col] = code;
        return next;
      });
    },
    [],
  );

  const resetKey = useCallback(
    (layer: number, row: number, col: number) => {
      const original = saved?.[layer]?.[row]?.[col];
      if (original !== undefined) setKeycode(layer, row, col, original);
    },
    [saved, setKeycode],
  );

  const keymapChanged = useMemo(() => {
    if (!keymap || !saved) return false;
    return keymap.some((l, li) =>
      l.some((r, ri) => r.some((c, ci) => c !== saved[li][ri][ci])),
    );
  }, [keymap, saved]);
  const entriesChanged =
    changed(tapDances, savedTapDances) ||
    changed(combos, savedCombos) ||
    changed(keyOverrides, savedKeyOverrides);
  const hasUnsavedChanges = keymapChanged || entriesChanged;

  const setTapDance = useCallback((index: number, entry: VialTapDanceEntry) => {
    setTapDances((prev) =>
      prev.map((e, i) => (i === index ? { ...entry } : e)),
    );
  }, []);

  const setCombo = useCallback((index: number, entry: VialComboEntry) => {
    setCombos((prev) =>
      prev.map((e, i) => (i === index ? structuredCloneSafe(entry) : e)),
    );
  }, []);
  const setKeyOverride = useCallback(
    (index: number, entry: VialKeyOverrideEntry) => {
      setKeyOverrides((prev) =>
        prev.map((e, i) => (i === index ? { ...entry } : e)),
      );
    },
    [],
  );

  // One Save for everything on the keyboard, the same as the ZMK side: the
  // keymap and the tap dances go out together.
  const saveChanges = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !keymap || !saved) return;
    setIsSaving(true);
    try {
      for (let l = 0; l < keymap.length; l++) {
        for (let r = 0; r < keymap[l].length; r++) {
          for (let c = 0; c < keymap[l][r].length; c++) {
            if (keymap[l][r][c] !== saved[l][r][c]) {
              await client.setKeycode(l, r, c, keymap[l][r][c]);
            }
          }
        }
      }
      setSaved(keymap.map((l) => l.map((r) => [...r])));
      for (let i = 0; i < tapDances.length; i++) {
        if (!same(tapDances[i], savedTapDances[i]))
          await client.setTapDance(i, tapDances[i]);
      }
      for (let i = 0; i < combos.length; i++) {
        if (!same(combos[i], savedCombos[i]))
          await client.setCombo(i, combos[i]);
      }
      for (let i = 0; i < keyOverrides.length; i++) {
        if (!same(keyOverrides[i], savedKeyOverrides[i]))
          await client.setKeyOverride(i, keyOverrides[i]);
      }
      setSavedTapDances(copy(tapDances));
      setSavedCombos(copy(combos));
      setSavedKeyOverrides(copy(keyOverrides));
    } finally {
      setIsSaving(false);
    }
  }, [
    keymap,
    saved,
    tapDances,
    savedTapDances,
    combos,
    savedCombos,
    keyOverrides,
    savedKeyOverrides,
  ]);

  const discardChanges = useCallback(() => {
    if (saved) setKeymap(saved.map((l) => l.map((r) => [...r])));
    setTapDances(copy(savedTapDances));
    setCombos(copy(savedCombos));
    setKeyOverrides(copy(savedKeyOverrides));
  }, [saved, savedTapDances, savedCombos, savedKeyOverrides]);

  const reload = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !info) return;
    const { rows, cols } = info.definition.matrix;
    const map = await client.getKeymap(info.layerCount, rows, cols);
    setKeymap(map);
    setSaved(map.map((l) => l.map((r) => [...r])));
    applyEntries(await readEntries(client, info.entryCounts));
  }, [info, applyEntries]);

  const setLayoutOptions = useCallback(async (value: number) => {
    const client = clientRef.current;
    if (!client) return;
    await client.setLayoutOptions(value);
    setLayoutOptionsState(value);
  }, []);

  const refreshOs = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setOsState(await client.getKeebOnOs());
  }, []);

  const setOs = useCallback(
    async (mode: number, blocks: [number, number, number, number]) => {
      const client = clientRef.current;
      if (!client) return;
      await client.setKeebOnOs(mode, blocks);
      await refreshOs();
    },
    [refreshOs],
  );

  const setOsPreview = useCallback(
    async (block: number | null) => {
      const client = clientRef.current;
      if (!client) return;
      await client.setKeebOnOsPreview(block);
      await refreshOs();
    },
    [refreshOs],
  );

  // Poll the detected OS while connected: the firmware switches on its own
  // when the host changes (KVM, replug), and the page should say so.
  useEffect(() => {
    if (!info || !os) return;
    const timer = setInterval(() => {
      refreshOs().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [info, os !== null, refreshOs]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () =>
      info
        ? visibleKeys(info.keys, info.definition.layoutLabels, layoutOptions)
        : [],
    [info, layoutOptions],
  );

  return {
    info,
    keymap,
    saved,
    hasUnsavedChanges,
    isSaving,
    tapDances,
    savedTapDances,
    setTapDance,
    combos,
    savedCombos,
    setCombo,
    keyOverrides,
    savedKeyOverrides,
    setKeyOverride,
    layoutOptions,
    visible,
    os,
    isConnecting,
    error,
    connect,
    connectDemo,
    disconnect,
    setKeycode,
    resetKey,
    saveChanges,
    discardChanges,
    reload,
    setLayoutOptions,
    setOs,
    setOsPreview,
    refreshOs,
  };
}
