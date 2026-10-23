/**
 * The guide under the splash screen's connect buttons.
 *
 * Two hexagons on their own told a newcomer nothing: not that a custom
 * keyboard is meant to be remapped, not where the firmware is, not where to
 * read up or where to ask. This puts those things right under the buttons,
 * on the same page, so nobody has to connect a keyboard -- or find a
 * separate About page -- to learn what the app is for.
 *
 * The firmware is one click away rather than listed here: the list of
 * keyboards will keep growing, and a row of download buttons per keyboard
 * would crowd the front page. The articles come from guideLinks.ts, where
 * one that is still being written has no URL yet and is shown as coming
 * soon.
 */
import {
  IconBook,
  IconBrandDiscord,
  IconDownload,
  IconExternalLink,
  IconKeyboard,
  IconLayoutGrid,
  IconMessages,
  IconSchool,
} from "@tabler/icons-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { GUIDE_ARTICLES, DISCORD_URL } from "../lib/guideLinks";
import { KEY_TEST_PATH } from "../pages/KeyTestPage";
import { LAYOUT_PATH } from "../pages/LayoutEditorPage";
import { PRACTICE_PATH } from "../pages/PracticePage";

/** Opens one of the app's own pages in place, the way its routes change. */
function openInPlace(path: string) {
  return (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    // Back returns to the top page it was opened from (ZMK or QMK).
    window.history.pushState({ from: window.location.pathname }, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
}
const openKeyTest = openInPlace(KEY_TEST_PATH);
const openPractice = openInPlace(PRACTICE_PATH);
const openLayout = openInPlace(LAYOUT_PATH);

interface SplashGuideProps {
  /** Open the supported-keyboards / Q&A page (the Home tab's content). */
  onShowAbout: () => void;
  /** Open the firmware downloads page (the Firmware tab's content). */
  onShowDownloads: () => void;
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

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-electric)] bg-[var(--color-electric)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-electric)] transition-colors hover:bg-[var(--color-electric)]/20";

export function SplashGuide({
  onShowAbout,
  onShowDownloads,
}: SplashGuideProps) {
  const { t } = useLanguage();

  return (
    <div className="flex w-[640px] max-w-[calc(100vw-3rem)] flex-col gap-4">
      {/* What this app is for. */}
      <div className="space-y-2 px-2 text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <p>
          {t(
            "A custom keyboard comes into its own once you change its keymap to fit what you actually use it for. Keeb-On! Studio was made to support that trial and error, so you can shape the keyboard to your own use.",
          )}
        </p>
        <p>
          {t(
            "Keeb-On! Studio is free to use and needs no installation. You can look at a supported keyboard in demo mode before buying it, build a keymap there, and apply it once the keyboard arrives.",
          )}
        </p>
      </div>

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
            </li>
          ))}
          <li className="text-sm">
            <button onClick={onShowAbout} className={linkClass}>
              {t("Supported keyboards and Q&A")}
            </button>
          </li>
        </ul>
      </Card>

      <Card icon={<IconDownload size={18} />} title={t("Firmware")}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "The latest firmware for every supported keyboard, with the steps for writing it, is on the downloads page.",
          )}
        </p>
        <button onClick={onShowDownloads} className={`${buttonClass} mt-3`}>
          <IconDownload size={14} />
          {t("Open the downloads page")}
        </button>
      </Card>

      <Card icon={<IconKeyboard size={18} />} title={t("Key test")}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "Check that every key of a keyboard you just got works. It only listens to what the keyboard types, so there is nothing to connect or unlock, and a wireless keyboard works too.",
          )}
        </p>
        <a
          href={KEY_TEST_PATH}
          onClick={openKeyTest}
          className={`${buttonClass} mt-3`}
        >
          <IconKeyboard size={14} />
          {t("Open the key test")}
        </a>
      </Card>

      <Card icon={<IconSchool size={18} />} title={t("Keymap dojo")}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "Decide the keymap of a small keyboard step by step -- which symbols you use most, the thumb keys, what goes on each layer -- and practise typing on it. Works without a keyboard too; with one connected, the result is written to it.",
          )}
        </p>
        <a
          href={PRACTICE_PATH}
          onClick={openPractice}
          className={`${buttonClass} mt-3`}
        >
          <IconSchool size={14} />
          {t("Open the keymap dojo")}
        </a>
      </Card>

      <Card icon={<IconLayoutGrid size={18} />} title={t("Layout editor")}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "Draw a keyboard layout on a PC or a phone, with legends and matrix numbers, and see whether Acid Caps or GoForty Caps cover it. Reads and writes Keyboard Layout Editor data and the layouts.keymap rows for VIA and Vial, and saves to your own GitHub Gists.",
          )}
        </p>
        <a
          href={LAYOUT_PATH}
          onClick={openLayout}
          className={`${buttonClass} mt-3`}
        >
          <IconLayoutGrid size={14} />
          {t("Open the layout editor")}
        </a>
      </Card>

      <Card
        icon={<IconMessages size={18} />}
        title={t("Opinions and questions about using it go here")}
      >
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cyber)] bg-[var(--color-cyber)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-cyber)] transition-colors hover:bg-[var(--color-cyber)]/20"
        >
          <IconBrandDiscord size={15} />
          {t("Discord")}
          <IconExternalLink size={12} />
        </a>
      </Card>
    </div>
  );
}
