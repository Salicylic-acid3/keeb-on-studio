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
import { decodeMacro, splitMacroBuffer, type MacroStep } from "../lib/macro";
import {
  supportedFields,
  TAP_HOLD_SETTINGS,
  writeField,
} from "../lib/qmkSettings";

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

describe("QMK Settings", () => {
  test("stage and Save, through the same fields the cards use", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.keyboard.qmkSettingIds.has(7)).toBe(true),
    );
    const fields = supportedFields(
      TAP_HOLD_SETTINGS,
      hook.result.current.keyboard.qmkSettingIds,
    );
    // This firmware has Permissive Hold and Retro Tapping as bits of id 8.
    expect(fields.map((f) => f.label)).toEqual([
      "Tapping term",
      "Permissive Hold",
      "Retro Tapping",
      "Tapping toggle",
    ]);
    const permissive = fields[1];
    act(() =>
      hook.result.current.keyboard.setQmkSetting(
        permissive.qsid,
        writeField(permissive, hook.result.current.keyboard.qmkSettings, true),
      ),
    );
    act(() => hook.result.current.keyboard.setQmkSetting(7, 230));
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(true);
    await act(async () => hook.result.current.keyboard.saveChanges());
    const client = new VialClient(transport);
    expect(await client.getQmkSetting(7, 2)).toBe(230);
    expect(await client.getQmkSetting(8, 1)).toBe(1);
  });
});

describe("Vial macros", () => {
  test("Save unlocks the keyboard first, then writes the buffer", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.keyboard.macros).toHaveLength(16),
    );
    expect(hook.result.current.keyboard.macroBufferSize).toBe(1024);
    const steps: MacroStep[] = [
      { action: "string", text: "hi" },
      { action: "tap", keycode: parseKeycode("KC_ENT")! },
    ];
    act(() => hook.result.current.keyboard.setMacro(1, steps));
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(true);
    await act(async () => hook.result.current.keyboard.saveChanges());
    expect(hook.result.current.keyboard.unlock).toBeNull();
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(false);
    // The keyboard was asked to unlock before the buffer was written.
    const cmds = transport.log.map((r) =>
      r[0] === 0xfe ? `v${r[1]}` : `${r[0]}`,
    );
    expect(cmds.indexOf("v6")).toBeGreaterThan(-1);
    expect(cmds.indexOf("15")).toBeGreaterThan(cmds.lastIndexOf("v7"));

    const client = new VialClient(transport);
    const buffer = await client.getMacroBuffer(1024);
    expect(splitMacroBuffer(buffer, 16).map(decodeMacro)[1]).toEqual(steps);
  });
});

describe(".vil export and import", () => {
  test("what is exported comes back as pending edits", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.keyboard.macros).toHaveLength(16),
    );
    const td = {
      onTap: 0x29,
      onHold: 0,
      onDoubleTap: 0x39,
      onTapHold: 0,
      tappingTerm: 210,
    };
    act(() => hook.result.current.keyboard.setTapDance(4, td));
    act(() =>
      hook.result.current.keyboard.setMacro(0, [
        { action: "string", text: "ok" },
      ]),
    );
    act(() => hook.result.current.keyboard.setQmkSetting(7, 260));
    const file = hook.result.current.keyboard.exportVil();
    expect(JSON.parse(file.replace(/"uid":\d+/, '"uid":0')).version).toBe(1);

    act(() => hook.result.current.keyboard.discardChanges());
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(false);
    let result:
      | ReturnType<typeof hook.result.current.keyboard.importVil>
      | undefined;
    act(() => {
      result = hook.result.current.keyboard.importVil(file);
    });
    expect(result?.otherKeyboard).toBe(false);
    expect(result?.skipped).toEqual([]);
    expect(hook.result.current.keyboard.tapDances[4]).toEqual(td);
    expect(hook.result.current.keyboard.macros[0]).toEqual([
      { action: "string", text: "ok" },
    ]);
    expect(hook.result.current.keyboard.qmkSettings[7]).toBe(260);
    expect(hook.result.current.keyboard.hasUnsavedChanges).toBe(true);
  });
});

describe("Live keys", () => {
  test("turning on unlocks first, then shows the switches held down", async () => {
    const { transport, hook } = setup();
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.keyboard.info).not.toBeNull(),
    );
    // Locked: the firmware will not say (it would be a keylogger).
    transport.pressed = [[1, 2]];
    expect((await new VialClient(transport).getSwitchMatrix(10, 6)).size).toBe(
      0,
    );

    await act(async () => hook.result.current.keyboard.setLiveKeys(true));
    expect(hook.result.current.keyboard.liveKeys.enabled).toBe(true);
    await waitFor(() =>
      expect([...hook.result.current.keyboard.liveKeys.pressed]).toEqual([
        "1,2",
      ]),
    );
    transport.pressed = [
      [0, 0],
      [9, 5],
    ];
    await waitFor(() =>
      expect([...hook.result.current.keyboard.liveKeys.pressed].sort()).toEqual(
        ["0,0", "9,5"],
      ),
    );
    await act(async () => hook.result.current.keyboard.setLiveKeys(false));
    expect(hook.result.current.keyboard.liveKeys.pressed.size).toBe(0);
  });
});

function tapBindingCode(s: Parameters<typeof tapBinding>[0]): number {
  // Read back through the card's own reader to prove it understands us.
  return bindingToKeycode(tapBinding(s)!);
}
