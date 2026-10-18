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

function mount(opts: { connected: boolean }) {
  const setBinding = jest.fn().mockResolvedValue(true);
  const saveChanges = jest.fn().mockResolvedValue(true);
  const addLayer = jest.fn().mockResolvedValue(null);
  mockUseKeymap.mockReturnValue({
    physicalLayouts: { activeLayoutIndex: 0, layouts: [GOFORTY_MAX] },
    keymap: deviceKeymap(),
    behaviors,
    isFullyLoaded: opts.connected,
    isLoading: false,
    error: null,
    hasUnsavedChanges: setBinding.mock.calls.length > 0,
    setBinding,
    saveChanges,
    discardChanges: jest.fn().mockResolvedValue(true),
    addLayer,
  } as unknown as ReturnType<typeof useKeymap>);
  const connection = {
    isConnected: opts.connected,
    deviceName: opts.connected ? "goforty-max" : undefined,
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
      <PracticePage onBack={() => {}} />
    </ConnectionContext.Provider>,
  );
  return { setBinding, saveChanges, connection };
}

describe("PracticePage with a keyboard", () => {
  it("offers to connect in demo mode and keeps the board picker", () => {
    const { connection } = mount({ connected: false });
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Keyboard to practise on/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Connect Keyboard/ }));
    // The notice has not been accepted, so the dialog comes first.
    expect(connection.onConnect).not.toHaveBeenCalled();
  });

  it("uses the connected keyboard's keymap and writes applied steps to it", async () => {
    const { setBinding } = mount({ connected: true });
    expect(
      screen.getByText(/Connected: the guide and the practice/),
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
});
