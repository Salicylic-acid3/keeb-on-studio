import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";
Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream ?? NodeReadableStream,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { createDemoTransport, useVialKeyboard } from "../hooks/useVialKeyboard";
import { useQmkFirmwareUpdate } from "../hooks/useQmkFirmwareUpdate";

function uf2(family: number, blocks = 2): Uint8Array {
  const out = new Uint8Array(blocks * 512);
  const v = new DataView(out.buffer);
  for (let i = 0; i < blocks; i++) {
    const o = i * 512;
    v.setUint32(o, 0x0a324655, true);
    v.setUint32(o + 4, 0x9e5d5157, true);
    v.setUint32(o + 8, 0x2000, true);
    v.setUint32(o + 28, family, true);
    v.setUint32(o + 508, 0x0ab16f30, true);
  }
  return out;
}

function fakeDrive(boardId: string) {
  const written: Uint8Array[] = [];
  return {
    written,
    dir: {
      async getFileHandle(name: string) {
        if (name === "INFO_UF2.TXT") {
          return {
            getFile: async () => ({
              text: async () => `UF2 Bootloader\nBoard-ID: ${boardId}\n`,
            }),
          };
        }
        return {
          getFile: async () => ({ text: async () => "" }),
          createWritable: async () => ({
            write: async (d: Uint8Array) => {
              written.push(d);
            },
            // The drive vanishes as the keyboard restarts.
            close: async () => {
              throw new Error("gone");
            },
          }),
        };
      },
    },
  };
}

describe("Update firmware", () => {
  test("downloads, sends the keyboard to its bootloader, writes onto the picked drive", async () => {
    const transport = createDemoTransport();
    const firmware = uf2(0xe48bff56); // the demo is an ErgoMini: RP2040
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => firmware.buffer,
    })) as unknown as typeof fetch;
    const drive = fakeDrive("RPI-RP2");
    Object.assign(window, {
      showDirectoryPicker: jest.fn(async () => drive.dir),
    });

    const hook = renderHook(() => {
      const keyboard = useVialKeyboard();
      const update = useQmkFirmwareUpdate(keyboard);
      return { keyboard, update };
    });
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.update.firmware?.asset).toBe(
        "clickboard_ergomini",
      ),
    );
    // Not offered in demo mode -- there is nothing to write to.
    expect(hook.result.current.update.available).toBe(false);

    await act(async () => hook.result.current.update.start());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/firmware/clickboard_ergomini.uf2",
    );
    expect(transport.jumpedToBootloader).toBe(true);
    await waitFor(() =>
      expect(hook.result.current.update.state.step).toBe("pick-drive"),
    );

    await act(async () => hook.result.current.update.pickDriveAndWrite());
    expect(hook.result.current.update.state.step).toBe("done");
    expect(drive.written[0]).toEqual(firmware);
  });

  test("refuses a drive that is not the bootloader, and a file for another chip", async () => {
    const transport = createDemoTransport();
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => uf2(0x300f5633).buffer, // STM32G0, not RP2040
    })) as unknown as typeof fetch;
    const hook = renderHook(() => {
      const keyboard = useVialKeyboard();
      return { update: useQmkFirmwareUpdate(keyboard), keyboard };
    });
    await act(async () =>
      hook.result.current.keyboard.connect(transport, "demo"),
    );
    await waitFor(() =>
      expect(hook.result.current.update.firmware).toBeDefined(),
    );
    await act(async () => hook.result.current.update.start());
    expect(hook.result.current.update.state).toMatchObject({ step: "error" });
    expect(transport.jumpedToBootloader).toBe(false);

    // Right file, wrong drive: nothing is written.
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => uf2(0xe48bff56).buffer,
    })) as unknown as typeof fetch;
    const drive = fakeDrive("SOME-OTHER-BOARD");
    Object.assign(window, {
      showDirectoryPicker: jest.fn(async () => drive.dir),
    });
    act(() => hook.result.current.update.close());
    await act(async () => hook.result.current.update.start());
    await waitFor(() =>
      expect(hook.result.current.update.state.step).toBe("pick-drive"),
    );
    await act(async () => hook.result.current.update.pickDriveAndWrite());
    expect(hook.result.current.update.state).toMatchObject({ step: "error" });
    expect(drive.written).toHaveLength(0);
  });
});
