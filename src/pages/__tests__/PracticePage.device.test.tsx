/**
 * The practice page with a ZMK keyboard connected: the board comes from
 * the keyboard's layout and keymap, the guide starts from that keymap,
 * applying a step writes its bindings to the keyboard, and saving is the
 * person's own step.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { ConnectionContext } from "../../components/DeviceConnection";
import type { BehaviorDefinition } from "../../hooks/useKeymapSource";
import { zmkTrigger } from "../../keyTest/lib/triggers";
import { keyboardBindings } from "../../layoutEditor/lib/keyboards";
import { GOFORTY_MAX } from "../../lib/layouts";
import { BEHAVIORS } from "../../lib/transport/behaviors";
import { behaviorIds, triggerToBinding } from "../../practice/lib/device";
import data from "../../layoutEditor/data/keyboards.json";
import { parseKeycode } from "../../qmk/lib/keycodes/qmkKeycode";
import { parseKleLayout } from "../../qmk/lib/vial/kle";
import type { KleRow } from "../../qmk/lib/vial/definition";
import { VialKeyboardContext } from "../../qmk/contexts/vialKeyboardContext";
import type { UseVialKeyboard } from "../../qmk/hooks/useVialKeyboard";
import { PracticePage } from "../PracticePage";

jest.mock("../../hooks/useKeymap", () => ({
  ...jest.requireActual("../../hooks/useKeymap"),
  useKeymap: jest.fn(),
}));
jest.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string, params?: Record<string, string | number>) =>
      Object.entries(params ?? {}).reduce(
        (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
        key,
      ),
  }),
}));
jest.mock("../../components/StandaloneFrame", () => ({
  StandaloneFrame: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
import { useKeymap } from "../../hooks/useKeymap";

const mockUseKeymap = useKeymap as jest.MockedFunction<typeof useKeymap>;

const behaviors = new Map<number, BehaviorDefinition>(
  BEHAVIORS.map((b) => [b.id, b as unknown as BehaviorDefinition]),
);
const ids = behaviorIds(behaviors, null);

/** GoFortyMax's default keymap as a keyboard would hold it. */
function deviceKeymap(): Keymap {
  const def = keyboardBindings("goforty_max_ortho")!;
  const textLayers = [def.bindings, ...def.layers];
  return {
    layers: textLayers.map((texts, i) => ({
      id: i,
      name: `L${i}`,
      bindings: texts.map(
        (text) =>
          triggerToBinding(zmkTrigger(text), ids, (x) => x) ?? {
            behaviorId: ids.trans!,
            param1: 0,
            param2: 0,
          },
      ),
    })),
    availableLayers: 8,
    maxLayerNameLength: 32,
  } as unknown as Keymap;
}

/** A Vial keyboard as the context would hold it: GoForty JP, or nothing. */
function vialOf(connected: boolean): {
  vial: UseVialKeyboard;
  setKeycode: jest.Mock;
  saveChanges: jest.Mock;
} {
  const setKeycode = jest.fn();
  const saveChanges = jest.fn().mockResolvedValue(undefined);
  const base = {
    info: null,
    keymap: null,
    saved: null,
    hasUnsavedChanges: false,
    isSaving: false,
    isConnecting: false,
    error: null,
    visible: [],
    unlock: null,
    setKeycode,
    saveChanges,
    discardChanges: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    cancelUnlock: jest.fn(),
  };
  if (!connected)
    return {
      vial: base as unknown as UseVialKeyboard,
      setKeycode,
      saveChanges,
    };
  const entry = (
    data as {
      qmk: Array<{
        id: string;
        keymap: KleRow[];
        keycodes: Record<string, string>;
        layers: Array<Record<string, string>>;
      }>;
    }
  ).qmk.find((q) => q.id === "goforty_jp")!;
  const keys = parseKleLayout(entry.keymap);
  const rows = Math.max(...keys.map((k) => k.row)) + 1;
  const cols = Math.max(...keys.map((k) => k.col)) + 1;
  const layer = (codes: Record<string, string>) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from(
        { length: cols },
        (_, c) => parseKeycode(codes[`${r},${c}`] ?? "KC_NO") ?? 0,
      ),
    );
  const saved = [layer(entry.keycodes), ...entry.layers.map(layer)];
  return {
    vial: {
      ...base,
      info: {
        productName: "GoForty JP",
        definition: { name: "goforty_jp" },
        keys,
        layerCount: saved.length,
        isDemo: false,
      },
      keymap: saved,
      saved,
      visible: keys,
    } as unknown as UseVialKeyboard,
    setKeycode,
    saveChanges,
  };
}

function mount(opts: { connected: boolean; qmk?: boolean }) {
  const { vial, setKeycode } = vialOf(!!opts.qmk);
  const setBinding = jest.fn().mockResolvedValue(true);
  const saveChanges = jest.fn().mockResolvedValue(true);
  const addLayer = jest.fn().mockResolvedValue(null);
  mockUseKeymap.mockReturnValue({
    physicalLayouts: { activeLayoutIndex: 0, layouts: [GOFORTY_MAX] },
    keymap: deviceKeymap(),
    behaviors,
    isFullyLoaded: opts.connected && !opts.qmk,
    isLoading: false,
    error: null,
    hasUnsavedChanges: setBinding.mock.calls.length > 0,
    setBinding,
    saveChanges,
    discardChanges: jest.fn().mockResolvedValue(true),
    addLayer,
  } as unknown as ReturnType<typeof useKeymap>);
  const zmk = opts.connected && !opts.qmk;
  const connection = {
    isConnected: zmk,
    deviceName: zmk ? "goforty-max" : undefined,
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    isLoading: false,
    error: null,
    isReconnecting: false,
    onCancelReconnect: jest.fn(),
    unsupportedDevice: false,
    isDemo: false,
  };
  window.localStorage.clear();
  window.history.replaceState(null, "", "/practice");
  render(
    <ConnectionContext.Provider value={connection}>
      <VialKeyboardContext.Provider value={vial}>
        <PracticePage onBack={() => {}} />
      </VialKeyboardContext.Provider>
    </ConnectionContext.Provider>,
  );
  return { setBinding, saveChanges, connection, setKeycode };
}

describe("PracticePage with a keyboard", () => {
  it("offers to connect in demo mode and keeps the board picker", () => {
    const { connection } = mount({ connected: false });
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Keyboard to practise on/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect QMK keyboard/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Connect ZMK keyboard/ }),
    );
    // The notice has not been accepted, so the dialog comes first.
    expect(connection.onConnect).not.toHaveBeenCalled();
  });

  it("uses the connected keyboard's keymap and writes applied steps to it", async () => {
    const { setBinding } = mount({ connected: true });
    expect(
      screen.getByText(/Connected \(ZMK\): the guide and the practice/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /Keyboard to practise on/ }),
    ).toBeNull();
    // The guide, started on the device's keymap.
    fireEvent.click(screen.getByRole("button", { name: /Start the guide/ }));
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    // Step 2 (symbols) has a proposal on GoFortyMax; applying writes it.
    const apply = screen.getByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(setBinding).toHaveBeenCalled());
    const [layerId, pos, binding] = setBinding.mock.calls[0];
    expect(layerId).toBe(0);
    expect(typeof pos).toBe("number");
    expect(binding.behaviorId).toBe(ids.kp);
    // A full HID usage with its page, never a bare id.
    expect(binding.param1 & 0xff0000).toBe(0x070000);
    // Progress is kept apart from the demo's.
    expect(
      window.localStorage.getItem(
        "keeb-on:practice-guide:live:goforty_max_ortho",
      ),
    ).not.toBeNull();
    expect(
      window.localStorage.getItem("keeb-on:practice-guide:goforty_max_ortho"),
    ).toBeNull();
  });

  it("uses a Vial keyboard's keymap and stages applied steps by matrix position", async () => {
    const { setKeycode, setBinding } = mount({ connected: true, qmk: true });
    expect(
      screen.getByText(/Connected \(QMK\): the guide and the practice/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start the guide/ }));
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    // GoForty JP has one symbol slot that already holds the top symbol, so
    // the first steps have nothing to apply; the thumb row does.
    const applyOrSkip = () => {
      const apply = screen.getByRole("button", { name: "Apply" });
      if (!(apply as HTMLButtonElement).disabled) fireEvent.click(apply);
      else
        fireEvent.click(
          screen.getByRole("button", { name: "Next without changing" }),
        );
    };
    applyOrSkip();
    applyOrSkip();
    fireEvent.click(
      screen.getByRole("button", { name: "Use Salicylic_acid3's row" }),
    );
    const apply = screen.getByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(setKeycode).toHaveBeenCalled());
    const [layer, row, col, code] = setKeycode.mock.calls[0];
    expect(layer).toBe(0);
    expect(typeof row).toBe("number");
    expect(typeof col).toBe("number");
    expect(code).toBeGreaterThan(0);
    expect(setBinding).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem("keeb-on:practice-guide:live:goforty_jp"),
    ).not.toBeNull();
  });
});
