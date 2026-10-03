/**
 * One connected Vial keyboard: its definition, its keymap, the edits waiting
 * to be written, and the OS-switch module's state.
 *
 * Keymap edits are written to the keyboard as they are made (Vial keyboards
 * keep the keymap in EEPROM, so every write is immediately persistent); the
 * "original" copy is what the keyboard held when we connected, which is what
 * the key's reset button goes back to.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VialClient,
  SUPPORTED_VIAL_PROTOCOL,
  type KeebOnOsState,
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
}

export interface UseVialKeyboard {
  info: VialKeyboardInfo | null;
  /** keycodes[layer][row][col] as the keyboard currently holds them */
  keymap: number[][][] | null;
  /** what the keyboard held when we connected */
  originalKeymap: number[][][] | null;
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
  setKeycode(
    layer: number,
    row: number,
    col: number,
    code: number,
  ): Promise<void>;
  resetKey(layer: number, row: number, col: number): Promise<void>;
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

export function useVialKeyboard(): UseVialKeyboard {
  const clientRef = useRef<VialClient | null>(null);
  const [info, setInfo] = useState<VialKeyboardInfo | null>(null);
  const [keymap, setKeymap] = useState<number[][][] | null>(null);
  const [originalKeymap, setOriginalKeymap] = useState<number[][][] | null>(
    null,
  );
  const [layoutOptions, setLayoutOptionsState] = useState(0);
  const [os, setOsState] = useState<KeebOnOsState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    clientRef.current = null;
    setInfo(null);
    setKeymap(null);
    setOriginalKeymap(null);
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
        });
        setKeymap(map);
        setOriginalKeymap(map.map((l) => l.map((r) => [...r])));
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
    [clear],
  );

  const connectDemo = useCallback(async () => {
    await connect(createDemoTransport(), "demo");
  }, [connect]);

  const setKeycode = useCallback(
    async (layer: number, row: number, col: number, code: number) => {
      const client = clientRef.current;
      if (!client) return;
      await client.setKeycode(layer, row, col, code);
      setKeymap((prev) => {
        if (!prev) return prev;
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
    async (layer: number, row: number, col: number) => {
      const original = originalKeymap?.[layer]?.[row]?.[col];
      if (original === undefined) return;
      await setKeycode(layer, row, col, original);
    },
    [originalKeymap, setKeycode],
  );

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
    originalKeymap,
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
    setLayoutOptions,
    setOs,
    setOsPreview,
    refreshOs,
  };
}
