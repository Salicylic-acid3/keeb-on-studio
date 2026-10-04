// jsdom has no web streams; the browser does.
import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";
Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream ?? NodeReadableStream,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});

import { VialClient } from "../protocol";
import { DemoTransport, base64ToBytes } from "../demoTransport";
import { readDefinition } from "../definition";
import { parseKleLayout, visibleKeys } from "../kle";
import { keycodeToText, parseKeycode } from "../../keycodes/qmkKeycode";
import {
  DEMO_DEFINITION_XZ_BASE64,
  DEMO_KEYMAP,
} from "../../../demo/clickboardErgoMini";

function demo(withOs = true) {
  return new DemoTransport({
    productName: "clickboard_ergomini (demo)",
    definition: base64ToBytes(DEMO_DEFINITION_XZ_BASE64),
    rows: 10,
    cols: 6,
    keymap: DEMO_KEYMAP,
    keebOnOs: withOs
      ? { layersPerBlock: 4, blockCount: 3, detectedOs: 3 }
      : undefined,
    dynamicEntries: { tapDance: 32, combo: 32, keyOverride: 32 },
  });
}

describe("VialClient against the demo keyboard", () => {
  test("identifies as Vial protocol 6 / VIA 9", async () => {
    const client = new VialClient(demo());
    expect(await client.getViaProtocolVersion()).toBe(9);
    const id = await client.getKeyboardId();
    expect(id.vialProtocol).toBe(6);
    expect(id.uid).toBe("2375963e659eb743");
  });

  test("reads and decodes the embedded definition", async () => {
    const client = new VialClient(demo());
    const def = await readDefinition(await client.getDefinitionBytes());
    expect(def.name).toBe("clickboard_ergomini");
    expect(def.vendorId).toBe(0x355d);
    expect(def.matrix).toEqual({ rows: 10, cols: 6 });
    expect(def.keebOn?.osBlocks).toHaveLength(3);
    expect(def.keebOn?.osBlocks?.[1].layers).toEqual([4, 5, 6, 7]);
    const keys = parseKleLayout(def.keymap);
    expect(keys).toHaveLength(50);
    // The real layout: column stagger, and four thumb keys rotated 15/30 degrees.
    expect(keys.find((k) => k.row === 0 && k.col === 0)).toMatchObject({
      x: 25,
      width: 100,
      height: 100,
    });
    expect(
      keys
        .filter((k) => k.r !== 0)
        .map((k) => k.r / 100)
        .sort((a, b) => a - b),
    ).toEqual([-30, -15, 15, 30]);
    expect(visibleKeys(keys, def.layoutLabels, 0)).toHaveLength(50);
  });

  test("reads the keymap buffer in 28-byte slices and matches per-key reads", async () => {
    const transport = demo();
    const client = new VialClient(transport);
    const layers = await client.getLayerCount();
    expect(layers).toBe(12);
    const keymap = await client.getKeymap(layers, 10, 6);
    expect(keycodeToText(keymap[0][0][0])).toBe("KC_TAB");
    const fnRow = DEMO_KEYMAP[0].findIndex((row) => row.includes("MO(1)"));
    const fnCol = DEMO_KEYMAP[0][fnRow].indexOf("MO(1)");
    expect(keycodeToText(keymap[0][fnRow][fnCol])).toBe("MO(1)");
    expect(keycodeToText(keymap[4][fnRow][fnCol])).toBe("MO(5)");
    expect(keycodeToText(keymap[8][fnRow][fnCol])).toBe("MO(9)");
    expect(keycodeToText(keymap[1][0][0])).toBe("KC_TRNS");
    expect(await client.getKeycode(4, fnRow, fnCol)).toBe(
      keymap[4][fnRow][fnCol],
    );
    // 12 * 10 * 6 * 2 = 1440 bytes -> 52 slices
    expect(transport.log.filter((r) => r[0] === 0x12)).toHaveLength(52);
  });

  test("writes a keycode", async () => {
    const transport = demo();
    const client = new VialClient(transport);
    await client.setKeycode(0, 0, 0, parseKeycode("LT(1,KC_SPC)")!);
    expect(keycodeToText(await client.getKeycode(0, 0, 0))).toBe(
      "LT(1,KC_SPC)",
    );
    expect(transport.readKeycode(0, 0, 0)).toBe(0x412c);
  });

  test("layout options round-trip", async () => {
    const client = new VialClient(demo());
    await client.setLayoutOptions(0x00000005);
    expect(await client.getLayoutOptions()).toBe(5);
  });

  test("OS-switch module: state, settings, preview", async () => {
    const client = new VialClient(demo());
    const state = await client.getKeebOnOs();
    expect(state).toMatchObject({
      protocol: 1,
      detectedOs: 3,
      mode: 0,
      activeBlock: 1,
      blocks: [0, 1, 2, 0],
      layersPerBlock: 4,
      blockCount: 3,
      previewBlock: null,
    });
    await client.setKeebOnOsPreview(2);
    expect((await client.getKeebOnOs())?.activeBlock).toBe(2);
    await client.setKeebOnOsPreview(null);
    await client.setKeebOnOs(1, [0, 1, 0, 0]);
    expect(await client.getKeebOnOs()).toMatchObject({
      mode: 1,
      activeBlock: 0,
      blocks: [0, 1, 0, 0],
    });
  });

  test("firmware without the OS module answers id_unhandled", async () => {
    const client = new VialClient(demo(false));
    expect(await client.getKeebOnOs()).toBeNull();
  });

  test("unlock status and dynamic entry counts", async () => {
    const client = new VialClient(demo());
    const status = await client.getUnlockStatus();
    expect(status.unlocked).toBe(false);
    expect(status.unlockKeys).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(await client.getDynamicEntryCounts()).toEqual({
      tapDance: 32,
      combo: 32,
      keyOverride: 32,
    });
  });

  test("tap dance, combo and key override entries round-trip", async () => {
    const transport = demo();
    const client = new VialClient(transport);
    const td = await client.getTapDance(0);
    expect(td).toEqual({
      onTap: 0,
      onHold: 0,
      onDoubleTap: 0,
      onTapHold: 0,
      tappingTerm: 200,
    });
    await client.setTapDance(3, {
      onTap: 0x29,
      onHold: 0x5221,
      onDoubleTap: 0x2b,
      onTapHold: 0,
      tappingTerm: 250,
    });
    expect(await client.getTapDance(3)).toEqual({
      onTap: 0x29,
      onHold: 0x5221,
      onDoubleTap: 0x2b,
      onTapHold: 0,
      tappingTerm: 250,
    });
    // Little-endian on the wire, as the firmware memcpy()s the struct.
    const setReq = transport.log.find((r) => r[0] === 0xfe && r[2] === 0x02)!;
    expect(Array.from(setReq.slice(3, 14))).toEqual([
      3, 0x29, 0, 0x21, 0x52, 0x2b, 0, 0, 0, 250, 0,
    ]);

    await client.setCombo(1, { input: [0x04, 0x05, 0, 0], output: 0x29 });
    expect(await client.getCombo(1)).toEqual({
      input: [0x04, 0x05, 0, 0],
      output: 0x29,
    });

    const ko = {
      trigger: 0x2a,
      replacement: 0x4c,
      layers: 0xffff,
      triggerMods: 0x02,
      negativeModMask: 0,
      suppressedMods: 0x02,
      options: 0x87,
    };
    await client.setKeyOverride(0, ko);
    expect(await client.getKeyOverride(0)).toEqual(ko);
    await expect(client.getTapDance(99)).rejects.toThrow();
  });

  test("QMK Settings: list, read and write", async () => {
    const client = new VialClient(demo());
    expect(await client.listQmkSettings()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
    expect(await client.getQmkSetting(7, 2)).toBe(200);
    await client.setQmkSetting(7, 2, 280);
    expect(await client.getQmkSetting(7, 2)).toBe(280);
    await client.setQmkSetting(8, 1, 0b1001);
    expect(await client.getQmkSetting(8, 1)).toBe(9);
    await expect(client.getQmkSetting(99, 1)).rejects.toThrow();
  });
});
