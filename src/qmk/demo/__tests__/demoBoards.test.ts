import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";
Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream ?? NodeReadableStream,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});

import boards from "../boards.json";
import { QMK_FIRMWARE } from "../../../lib/firmwareDownloads";
import { createDemoTransport } from "../../hooks/useVialKeyboard";
import { VialClient } from "../../lib/vial/protocol";
import { readDefinition } from "../../lib/vial/definition";
import { parseKleLayout, visibleKeys } from "../../lib/vial/kle";
import {
  DEFAULT_DEMO_BOARD,
  demoBoardChoices,
  loadDemoBoard,
  rememberDemoBoard,
  rememberedDemoBoard,
  type DemoBoard,
} from "../demoBoards";

const all = boards as unknown as Record<string, DemoBoard>;

describe("demo keyboards", () => {
  it("are every QMK keyboard on the firmware list, in its order", () => {
    expect(Object.keys(all)).toEqual(QMK_FIRMWARE.map((f) => f.asset));
    expect(demoBoardChoices().map((b) => b.id)).toEqual(Object.keys(all));
  });

  it.each(Object.keys(all))(
    "%s connects as its released firmware would",
    async (id) => {
      const board = all[id];
      const transport = createDemoTransport(board);
      expect(transport.productName).toBe(`${board.name} (demo)`);
      const client = new VialClient(transport);
      const definition = await readDefinition(
        await client.getDefinitionBytes(),
      );
      expect(definition.name).toBe(id);
      expect(definition.matrix).toEqual({ rows: board.rows, cols: board.cols });

      // The OS blocks the definition names match the firmware's layers.
      const layers = await client.getLayerCount();
      expect(layers).toBe(board.layersPerBlock * board.blockCount);
      const blocks = definition.keebOn?.osBlocks ?? [];
      expect(blocks).toHaveLength(board.blockCount);
      blocks.forEach((b, i) =>
        expect(b.layers).toEqual(
          Array.from(
            { length: board.layersPerBlock },
            (_, k) => i * board.layersPerBlock + k,
          ),
        ),
      );

      // Every key drawn has a keycode on the base layer.
      const keymap = await client.getKeymap(layers, board.rows, board.cols);
      const keys = visibleKeys(
        parseKleLayout(definition.keymap),
        definition.layoutLabels,
        0,
      );
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(keymap[0][k.row][k.col]).toBeDefined();
      }

      const unlock = await client.getUnlockStatus();
      expect(unlock.unlockKeys).toEqual(board.unlockKeys);
    },
  );

  it("load the one asked for, the default for an unknown one", async () => {
    expect((await loadDemoBoard("bethirty_ortho")).id).toBe("bethirty_ortho");
    expect((await loadDemoBoard("nope")).id).toBe(DEFAULT_DEMO_BOARD);
  });

  it("remember the keyboard picked last, and ignore one no longer listed", () => {
    localStorage.clear();
    expect(rememberedDemoBoard()).toBe(DEFAULT_DEMO_BOARD);
    rememberDemoBoard("goforty_us");
    expect(rememberedDemoBoard()).toBe("goforty_us");
    localStorage.setItem("keebon.qmk.demoBoard", "gone_board");
    expect(rememberedDemoBoard()).toBe(DEFAULT_DEMO_BOARD);
  });
});
