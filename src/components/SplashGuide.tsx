/**
 * The guide under the splash screen's connect buttons.
 *
 * Two hexagons on their own told a newcomer nothing: not that a custom
 * keyboard is meant to be remapped, not where the firmware is, not where to
 * read up or where to say what is awkward. This puts those four things
 * right under the buttons, on the same page, so nobody has to connect a
 * keyboard -- or find a separate About page -- to learn what the app is for.
 *
 * Everything here is static or a plain link. The firmware links are GitHub's
 * "latest release" permalinks, so this needs no network call and cannot be
 * rate limited; the articles come from guideLinks.ts, where one that is
 * still being written has no URL yet and is shown as coming soon.
 */
import {
  IconBook,
  IconBrandDiscord,
  IconBrandX,
  IconDownload,
  IconExternalLink,
  IconMessageReport,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
  FIRMWARE_BOARDS,
  firmwareDownloadUrl,
  firmwareReleasesUrl,
} from "../lib/firmwareDownloads";
import { GUIDE_ARTICLES, DISCORD_URL, X_URL } from "../lib/guideLinks";
import { FlashInstructions } from "./FlashInstructions";

interface SplashGuideProps {
  /** Open the supported-keyboards / Q&A page (the Home tab's content). */
  onShowAbout: () => void;
}

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm">
      <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
        <span className="text-[var(--color-cyber)]">{icon}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const linkClass =
  "inline-flex items-center gap-1 text-[var(--color-electric)] underline transition-colors hover:text-[var(--color-neon)]";

export function SplashGuide({ onShowAbout }: SplashGuideProps) {
  const { t } = useLanguage();

  return (
    <div className="flex w-[640px] max-w-[calc(100vw-3rem)] flex-col gap-4">
      {/* Why this app exists, in two sentences. */}
      <p className="px-2 text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {t(
          "A custom keyboard is meant to be remapped. It ships with a default layout, but the point is to move the keys to where your own hands and work want them — and that is what Keeb-On! Studio is for: keymap, layers and trackpad, edited from the browser with nothing to install.",
        )}
        <br />
        <span className="text-[var(--color-text-muted)]">
          {t(
            "Connect over USB above, or open the demo mode to look around without a keyboard.",
          )}
        </span>
      </p>

      <Card icon={<IconBook size={18} />} title={t("Learn how to use it")}>
        <ul className="space-y-2">
          {GUIDE_ARTICLES.map((article) => (
            <li key={article.label} className="text-sm">
              {article.href ? (
                <a
                  href={article.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {t(article.label)}
                  <IconExternalLink size={13} />
                </a>
              ) : (
                <span className="text-[var(--color-text-secondary)]">
                  {t(article.label)}
                  <span className="ml-2 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                    {t("Coming soon")}
                  </span>
                </span>
              )}
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {t(article.description)}
              </p>
            </li>
          ))}
          <li className="text-sm">
            <button onClick={onShowAbout} className={linkClass}>
              {t("Supported keyboards and Q&A")}
            </button>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {t(
                "Which keyboards this app drives, what each tab does, and the questions people ask.",
              )}
            </p>
          </li>
        </ul>
      </Card>

      <Card icon={<IconDownload size={18} />} title={t("Firmware")}>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t(
            "The latest firmware for each keyboard, straight from here. Each link always points at the newest release.",
          )}
        </p>
        <ul className="mt-3 space-y-3">
          {FIRMWARE_BOARDS.map((board) => (
            <li
              key={board.repo}
              className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text)]">{board.name}</p>
                <a
                  href={firmwareReleasesUrl(board.repo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} text-xs`}
                >
                  {t("Release notes and older versions")}
                  <IconExternalLink size={12} />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {board.files
                  .filter((file) => !file.recovery)
                  .map((file) => (
                    <a
                      key={file.asset}
                      href={firmwareDownloadUrl(board.repo, file.asset)}
                      title={`${file.asset}.uf2`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-electric)] bg-[var(--color-electric)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-electric)] transition-colors hover:bg-[var(--color-electric)]/20"
                    >
                      <IconDownload size={14} />
                      {t(file.label)}
                    </a>
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            {t("How to flash")}
          </summary>
          <FlashInstructions className="mt-2" />
        </details>
      </Card>

      <Card
        icon={<IconMessageReport size={18} />}
        title={t("Tell us how it goes")}
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "Something awkward, something broken, something you wish it did — say so on Discord. That is what decides what the next version fixes.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cyber)] bg-[var(--color-cyber)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-cyber)] transition-colors hover:bg-[var(--color-cyber)]/20"
          >
            <IconBrandDiscord size={15} />
            {t("Report it on Discord")}
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)]"
          >
            <IconBrandX size={15} />
            @Salicylic_acid3
          </a>
        </div>
      </Card>
    </div>
  );
}
