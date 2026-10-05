/**
 * "Update firmware" for the QMK side: fetch the latest .uf2 for this
 * keyboard, send the keyboard to its bootloader (Vial asks for the unlock
 * first), then write the file onto the bootloader's drive, which the person
 * picks in the browser's folder dialog (File System Access, Chrome/Edge).
 *
 * Lives at the app level, not in a page: the keyboard leaves the bus half
 * way through, which unmounts every page that needs a connected keyboard.
 */
import { useCallback, useRef, useState } from "react";
import {
  qmkFirmwareFor,
  UF2_BOARD_ID,
  UF2_DRIVE_NAME,
  UF2_FAMILY,
  type QmkFirmware,
} from "../../lib/firmwareDownloads";
import { boardIdOf, checkUf2 } from "../lib/uf2";
import type { UseVialKeyboard } from "./useVialKeyboard";

export type UpdateStep =
  | { step: "idle" }
  | { step: "downloading"; firmware: QmkFirmware }
  | { step: "pick-drive"; firmware: QmkFirmware }
  | { step: "writing"; firmware: QmkFirmware }
  | { step: "done"; firmware: QmkFirmware }
  | {
      step: "error";
      firmware?: QmkFirmware;
      message: string;
      params?: Record<string, string>;
    };

interface DirectoryHandle {
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{
    getFile(): Promise<File>;
    createWritable(): Promise<{
      write(data: BufferSource): Promise<void>;
      close(): Promise<void>;
    }>;
  }>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    id?: string;
  }) => Promise<DirectoryHandle>;
};

export function canUpdateFirmware(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === "function";
}

export function useQmkFirmwareUpdate(keyboard: UseVialKeyboard) {
  const [state, setState] = useState<UpdateStep>({ step: "idle" });
  const file = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const board = keyboard.info?.definition.name;
  const firmware = board ? qmkFirmwareFor(board) : undefined;
  const available =
    Boolean(firmware) && !keyboard.info?.isDemo && canUpdateFirmware();

  const start = useCallback(async () => {
    if (!firmware) return;
    setState({ step: "downloading", firmware });
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const res = await fetch(
        `/api/firmware/${firmware.asset}.${firmware.ext}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      setState({
        step: "error",
        firmware,
        message:
          "The firmware could not be downloaded. Check the connection and try again.",
      });
      return;
    }
    const check = checkUf2(bytes, UF2_FAMILY[firmware.chip]);
    if (!check.ok) {
      setState({
        step: "error",
        firmware,
        message: "The downloaded file is not firmware for this keyboard.",
      });
      return;
    }
    file.current = bytes;
    const sent = await keyboard.enterBootloader();
    if (!sent) {
      setState({ step: "idle" });
      return;
    }
    setState({ step: "pick-drive", firmware });
  }, [firmware, keyboard]);

  /** Must run from a click: the folder dialog needs a user gesture. */
  const pickDriveAndWrite = useCallback(async () => {
    if (state.step !== "pick-drive" || !file.current) return;
    const fw = state.firmware;
    let dir: DirectoryHandle;
    try {
      dir = await (window as PickerWindow).showDirectoryPicker!({
        mode: "readwrite",
        id: "keebon-uf2",
      });
    } catch {
      return; // dialog closed; stay on this step
    }
    // Make sure it is the bootloader drive before writing anything to it.
    let boardId: string | null = null;
    try {
      const info = await (await dir.getFileHandle("INFO_UF2.TXT")).getFile();
      boardId = boardIdOf(await info.text());
    } catch {
      boardId = null;
    }
    if (boardId !== UF2_BOARD_ID[fw.chip]) {
      setState({
        step: "error",
        firmware: fw,
        message: "That is not the {{drive}} drive. Nothing was written.",
        params: { drive: UF2_DRIVE_NAME[fw.chip] },
      });
      return;
    }
    setState({ step: "writing", firmware: fw });
    try {
      const handle = await dir.getFileHandle("FIRMWARE.UF2", { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.current);
      try {
        await writable.close();
      } catch {
        // The bootloader takes the blocks as they arrive and restarts the
        // keyboard; the drive is gone before the browser can finish the file.
      }
    } catch {
      setState({
        step: "error",
        firmware: fw,
        message:
          "Writing to the drive failed. Copy the .uf2 file by hand from the firmware page.",
      });
      return;
    }
    file.current = null;
    setState({ step: "done", firmware: fw });
  }, [state]);

  const close = useCallback(() => {
    file.current = null;
    setState({ step: "idle" });
  }, []);

  return { state, available, firmware, start, pickDriveAndWrite, close };
}

export type QmkFirmwareUpdate = ReturnType<typeof useQmkFirmwareUpdate>;
