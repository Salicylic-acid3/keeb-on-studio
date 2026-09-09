import {
  IconAlertTriangle,
  IconDownload,
  IconExternalLink,
} from "@tabler/icons-react";

import { useLanguage } from "../hooks/useLanguage";
import {
  FIRMWARE_BOARDS,
  firmwareDownloadUrl,
  firmwareReleasesUrl,
  type FirmwareBoard,
  type FirmwareFile,
} from "../lib/firmwareDownloads";

function DownloadRow({ repo, file }: { repo: string; file: FirmwareFile }) {
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
          {file.asset}.uf2
        </p>
      </div>
      {/* A plain link, not fetch(): the browser downloads it directly, so no
          GitHub API call and nothing to fail when rate limited. */}
      <a
        href={firmwareDownloadUrl(repo, file.asset)}
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

export function FirmwarePage() {
  const { t } = useLanguage();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-medium text-[var(--color-text)]">
            {t("Firmware")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t(
              "Download the latest firmware for your keyboard. Each link always points at the newest release.",
            )}
          </p>
        </div>

        <div className="glass-card mb-6 p-6">
          <h2 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("How to flash")}
          </h2>
          <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
            <li>{t("Download the .uf2 file for your keyboard below.")}</li>
            <li>
              {t(
                "Connect the keyboard over USB and double-tap its reset switch. It restarts into the bootloader and appears as a USB drive.",
              )}
            </li>
            <li>
              {t(
                "Copy the .uf2 file onto that drive. The keyboard writes it and restarts on its own, and the drive disappears — that is normal, not an error.",
              )}
            </li>
            <li>
              {t(
                "On a split keyboard, repeat for the other half: each half runs its own firmware.",
              )}
            </li>
          </ol>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            {t(
              "If Bluetooth misbehaves after an update, unpair the keyboard on the host and pair it again.",
            )}
          </p>
        </div>

        <div className="space-y-6">
          {FIRMWARE_BOARDS.map((board) => (
            <BoardCard key={board.repo} board={board} />
          ))}
        </div>
      </div>
    </div>
  );
}
