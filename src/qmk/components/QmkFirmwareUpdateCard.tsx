/**
 * The Settings tab's "Update firmware" card: one button that takes the
 * keyboard to the latest firmware from the release, without a download and
 * a file copy by hand.
 */
import { IconDownload } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";
import { UF2_DRIVE_NAME } from "../../lib/firmwareDownloads";
import type { QmkFirmwareUpdate } from "../hooks/useQmkFirmwareUpdate";

export function QmkFirmwareUpdateCard({
  update,
}: {
  update: QmkFirmwareUpdate;
}) {
  const { t } = useLanguage();
  if (!update.available || !update.firmware) return null;
  const drive = UF2_DRIVE_NAME[update.firmware.chip];
  return (
    <section className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconDownload
          size={16}
          className="text-[var(--color-electric)] flex-shrink-0"
        />
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Update firmware")}
        </h2>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        {t(
          "Writes the latest {{name}} firmware. The keyboard asks to be unlocked, restarts as a USB drive named {{drive}}, and you choose that drive; the rest is automatic. The keymap stays.",
          { name: update.firmware.name, drive },
        )}
      </p>
      <button
        className="btn-electric text-sm flex items-center gap-1.5"
        onClick={() => void update.start()}
        disabled={update.state.step !== "idle"}
      >
        <IconDownload size={16} />
        {t("Update to the latest firmware")}
      </button>
    </section>
  );
}
