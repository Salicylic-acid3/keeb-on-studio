/**
 * The steps of "Update firmware" after the keyboard has gone to its
 * bootloader, in the unlock dialog's look: pick the drive, writing, done.
 * Shown at the app level, since the keyboard is disconnected meanwhile.
 */
import * as Dialog from "@radix-ui/react-dialog";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDeviceFloppy,
  IconFolder,
  IconLoader2,
} from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import { UF2_DRIVE_NAME } from "../../lib/firmwareDownloads";
import { QMK_DOWNLOADS_PATH } from "../../pages/DownloadsPage";
import type { QmkFirmwareUpdate } from "../hooks/useQmkFirmwareUpdate";

export function QmkFirmwareUpdateDialog({
  update,
}: {
  update: QmkFirmwareUpdate;
}) {
  const { t } = useLanguage();
  const s = update.state;
  if (s.step === "idle") return null;
  // Only the write itself cannot be walked away from; everything else,
  // including the download, can be closed.
  const busy = s.step === "writing";
  const drive =
    "firmware" in s && s.firmware ? UF2_DRIVE_NAME[s.firmware.chip] : "";

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && update.close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
              {s.step === "done" ? (
                <IconCircleCheck
                  size={32}
                  className="text-[var(--color-electric)]"
                />
              ) : s.step === "error" ? (
                <IconAlertTriangle
                  size={32}
                  className="text-[var(--color-warning)]"
                />
              ) : busy || s.step === "downloading" ? (
                <IconLoader2
                  size={32}
                  className="animate-spin text-[var(--color-electric)]"
                />
              ) : (
                <IconDeviceFloppy
                  size={32}
                  className="text-[var(--color-electric)]"
                />
              )}
            </div>
          </div>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] text-center mb-2">
            {t("Update firmware")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] text-center mb-6">
            {s.step === "downloading" && t("Getting the latest firmware…")}
            {s.step === "pick-drive" &&
              t(
                "The keyboard is now a USB drive named {{drive}}. Choose that drive to write the firmware onto it.",
                { drive },
              )}
            {s.step === "writing" && t("Writing… Do not unplug the keyboard.")}
            {s.step === "done" &&
              t(
                "Written. The keyboard restarts on its own; connect it again to carry on.",
              )}
            {s.step === "error" && t(s.message, s.params)}
          </Dialog.Description>

          {s.step === "pick-drive" && (
            <>
              <button
                className="w-full btn-electric flex items-center justify-center gap-2 mb-3"
                onClick={() => void update.pickDriveAndWrite()}
              >
                <IconFolder size={18} />
                {t("Choose the {{drive}} drive", { drive })}
              </button>
              <p className="text-xs text-[var(--color-text-muted)] text-center mb-4">
                {t(
                  "No {{drive}} drive? Keyboards made before this bootloader need it installed once:",
                  { drive },
                )}{" "}
                <a
                  href={QMK_DOWNLOADS_PATH}
                  className="underline text-[var(--color-electric)]"
                >
                  {t("Firmware")}
                </a>
              </p>
            </>
          )}

          {!busy && (
            <button
              className="w-full btn-ghost border border-[var(--color-border)]"
              onClick={update.close}
            >
              {s.step === "done" || s.step === "error"
                ? t("Close")
                : t("Cancel")}
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
