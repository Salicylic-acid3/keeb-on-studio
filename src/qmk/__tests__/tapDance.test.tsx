import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";
Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream ?? NodeReadableStream,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { useVialKeyboard, createDemoTransport } from "../hooks/useVialKeyboard";
import { useVialTapDance } from "../hooks/useVialTapDance";
import { bindingToKeycode, keycodeToBinding } from "../lib/zmkBridge";
import { keycodeToText, parseKeycode } from "../lib/keycodes/qmkKeycode";
import { tapBinding } from "../../components/tapDance/useTapDance";
import { VialClient } from "../lib/vial/protocol";

function setup() {
  const transport = createDemoTransport();
  const hook = renderHook(() => {
    const keyboard = useVialKeyboard();
    const tapDance = useVialTapDance(keyboard);
    return { keyboard, tapDance };
  });
  return { transport, hook };
}

describe("Vial tap dance through the ZMK cards' interface", () => {
  test("slots appear, edits stage, Save writes the entry", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.tapDance.slots).toHaveLength(32),
    );
    const slot0 = () => hook.result.current.tapDance.slots[0];
    expect(slot0().taps).toHaveLength(0);
    expect(slot0().term?.value?.int32Value).toBe(200);
    expect(slot0().maxTaps).toBe(2);

    await act(async () => hook.result.current.tapDance.addTap(slot0()));
    expect(slot0().taps).toHaveLength(1);
    await act(async () =>
      hook.result.current.tapDance.setTap(
        slot0(),
        0,
        keycodeToBinding(parseKeycode("KC_ESC")!),
      ),
    );
    await act(async () =>
      hook.result.current.tapDance.setHold(
        slot0(),
        0,
        keycodeToBinding(parseKeycode("MO(1)")!),
      ),
    );
    await act(async () => hook.result.current.tapDance.addTap(slot0()));
    await act(async () =>
      hook.result.current.tapDance.setTap(
        slot0(),
        1,
        keycodeToBinding(parseKeycode("KC_CAPS")!),
      ),
    );
    await act(async () => hook.result.current.tapDance.setTerm(slot0(), 250));
    expect(slot0().taps.map((s) => keycodeToText(tapBindingCode(s)))).toEqual([
      "KC_ESC",
      "KC_CAPS",
    ]);
    expect(slot0().taps[0].hasUnsavedValue).toBe(true);
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(true);

    await act(async () => hook.result.current.keyboard.saveChanges());
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(false);
    const written = await new VialClient(transport).getTapDance(0);
    expect(written).toEqual({
      onTap: parseKeycode("KC_ESC"),
      onHold: parseKeycode("MO(1)"),
      onDoubleTap: parseKeycode("KC_CAPS"),
      onTapHold: 0,
      tappingTerm: 250,
    });

    await act(async () => hook.result.current.tapDance.removeTap(slot0()));
    expect(slot0().taps).toHaveLength(1);
    await act(async () => hook.result.current.tapDance.discard());
    expect(slot0().taps).toHaveLength(2);
  });
});

describe("Vial combos and key overrides", () => {
  test("stage, Save and read back", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.keyboard.combos).toHaveLength(32),
    );
    expect(hook.result.current.keyboard.keyOverrides).toHaveLength(32);

    const combo = {
      input: [0x04, 0x16, 0, 0] as [number, number, number, number],
      output: 0x29,
    };
    const ko = {
      trigger: 0x2a,
      replacement: 0x4c,
      layers: 0xffff,
      triggerMods: 0x02,
      negativeModMask: 0,
      suppressedMods: 0x02,
      options: 0x87,
    };
    act(() => hook.result.current.keyboard.setCombo(2, combo));
    act(() => hook.result.current.keyboard.setKeyOverride(0, ko));
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(true);
    await act(async () => hook.result.current.keyboard.saveChanges());
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(false);

    const client = new VialClient(transport);
    expect(await client.getCombo(2)).toEqual(combo);
    expect(await client.getKeyOverride(0)).toEqual(ko);
  });
});

function tapBindingCode(s: Parameters<typeof tapBinding>[0]): number {
  // Read back through the card's own reader to prove it understands us.
  return bindingToKeycode(tapBinding(s)!);
}
