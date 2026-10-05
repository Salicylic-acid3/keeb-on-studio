import {
  IconAlertTriangle,
  IconDownload,
  IconExternalLink,
} from "@tabler/icons-react";

import { useLanguage } from "../hooks/useLanguage";
import { FlashInstructions } from "../components/FlashInstructions";
import { QmkFlashInstructions } from "../components/QmkFlashInstructions";
import { FirmwareToggle } from "../components/FirmwareToggle";
import type { Firmware } from "../lib/firmware";
import {
  FIRMWARE_BOARDS,
  firmwareDownloadUrl,
  firmwareReleasesUrl,
  QMK_FIRMWARE,
  QMK_FIRMWARE_REPO,
  QMK_G0_BOOTLOADER_ASSET,
  type FirmwareBoard,
  type FirmwareExt,
  type FirmwareFile,
} from "../lib/firmwareDownloads";

function DownloadRow({
  repo,
  file,
  ext = "uf2",
}: {
  repo: string;
  file: FirmwareFile;
  ext?: FirmwareExt;
}) {
  const { t } = useLanguage();
  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${
        file.recovery
          ? "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
          {file.recovery && (
            <IconAlertTriangle
              size={15}
              className="shrink-0 text-[var(--color-warning)]"
            />
          )}
          {t(file.label)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {t(file.description)}
        </p>
        <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
          {file.asset}.{ext}
        </p>
      </div>
      {/* A plain link, not fetch(): the browser downloads it directly, so no
          GitHub API call and nothing to fail when rate limited. */}
      <a
        href={firmwareDownloadUrl(repo, file.asset, ext)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-electric)] bg-[var(--color-electric)]/10 px-4 py-2 text-sm font-medium text-[var(--color-electric)] transition-colors hover:bg-[var(--color-electric)]/20"
      >
        <IconDownload size={16} />
        {t("Download")}
      </a>
    </li>
  );
}

function BoardCard({ board }: { board: FirmwareBoard }) {
  const { t } = useLanguage();
  const normal = board.files.filter((file) => !file.recovery);
  const recovery = board.files.filter((file) => file.recovery);

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
            {board.name}
          </h2>
          {board.split && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {t("Split keyboard: flash both halves.")}
            </p>
          )}
        </div>
        <a
          href={firmwareReleasesUrl(board.repo)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-electric)] underline transition-colors hover:text-[var(--color-neon)]"
        >
          {t("Release notes and older versions")}
          <IconExternalLink size={13} />
        </a>
      </div>

      <ul className="space-y-2">
        {normal.map((file) => (
          <DownloadRow key={file.asset} repo={board.repo} file={file} />
        ))}
      </ul>

      {recovery.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recovery.map((file) => (
            <DownloadRow key={file.asset} repo={board.repo} file={file} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function FirmwarePage({
  firmware = "zmk",
  onFirmwareChange,
}: {
  firmware?: Firmware;
  onFirmwareChange?: (firmware: Firmware) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              {firmware === "qmk"
                ? t("Firmware for QMK (Vial) keyboards")
                : t("Firmware")}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t(
                "Download the latest firmware for your keyboard. Each link always points at the newest release.",
              )}
            </p>
          </div>
          {onFirmwareChange && (
            <FirmwareToggle value={firmware} onChange={onFirmwareChange} />
          )}
        </div>

        <div className="glass-card mb-6 p-6">
          <h2 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("How to flash")}
          </h2>
          {firmware === "qmk" ? (
            <QmkFlashInstructions />
          ) : (
            <FlashInstructions />
          )}
        </div>

        {firmware === "qmk" ? (
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="mb-4 flex justify-end">
                <a
                  href={firmwareReleasesUrl(QMK_FIRMWARE_REPO)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-electric)] underline transition-colors hover:text-[var(--color-neon)]"
                >
                  {t("Release notes and older versions")}
                  <IconExternalLink size={13} />
                </a>
              </div>
              <ul className="space-y-2">
                {QMK_FIRMWARE.map((fw) => (
                  <DownloadRow
                    key={fw.asset}
                    repo={QMK_FIRMWARE_REPO}
                    ext={fw.ext}
                    file={{
                      asset: fw.asset,
                      label: fw.name,
                      description:
                        fw.chip === "stm32g0"
                          ? "Copy onto the KEEBONBOOT drive."
                          : "Copy onto the RPI-RP2 drive.",
                    }}
                  />
                ))}
              </ul>
            </div>

            {/* STM32G0 boards made before TinyUF2: the bootloader, once,
                over the chip's own DFU -- or the old .bin that way. */}
            <div className="glass-card p-6">
              <h2 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
                {t("STM32G0 keyboards without the KEEBONBOOT bootloader")}
              </h2>
              <p className="mb-4 text-sm text-[var(--color-text-muted)]">
                {t(
                  "ClickBoard Tenkey, EzTenkey, EzTenkeyMX and WzTwenty STM made before the KEEBONBOOT bootloader show no drive. Install the bootloader once (below), then use the .uf2 above from then on. Or keep writing the .bin for your keyboard the old way.",
                )}
              </p>
              <ol className="mb-4 list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
                <li>
                  {t(
                    "Hold the BOOT switch while plugging in. The keyboard switches to the chip's firmware update mode (DFU).",
                  )}
                </li>
                <li>
                  {t(
                    "Write the bootloader with QMK Toolbox, or with dfu-util:",
                  )}
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-secondary)]">
                    {`dfu-util -a 0 -d 0483:DF11 -s 0x08000000:mass-erase:force:leave -D ${QMK_G0_BOOTLOADER_ASSET}.bin`}
                  </pre>
                </li>
                <li>
                  {t(
                    "The KEEBONBOOT drive appears. Copy the .uf2 for your keyboard onto it.",
                  )}
                </li>
              </ol>
              <ul className="space-y-2">
                <DownloadRow
                  repo={QMK_FIRMWARE_REPO}
                  ext="bin"
                  file={{
                    asset: QMK_G0_BOOTLOADER_ASSET,
                    label: "KEEBONBOOT bootloader (STM32G0)",
                    description: "Write once over DFU; it stays.",
                  }}
                />
                {QMK_FIRMWARE.filter((fw) => fw.chip === "stm32g0").map(
                  (fw) => (
                    <DownloadRow
                      key={`${fw.asset}-dfu`}
                      repo={QMK_FIRMWARE_REPO}
                      ext="bin"
                      file={{
                        asset: `${fw.asset}-dfu`,
                        label: `${fw.name} (DFU)`,
                        description:
                          "Without the bootloader: write with QMK Toolbox (DFU).",
                      }}
                    />
                  ),
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {FIRMWARE_BOARDS.map((board) => (
              <BoardCard key={board.repo} board={board} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
