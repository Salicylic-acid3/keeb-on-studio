/**
 * The page frame for routes that work without a keyboard: the top bar with
 * the brand on the left and Back + language on the right, over a scrolling
 * body. The release notes, the About page and the firmware downloads all
 * sit in it, so a link to any of them lands on the same kind of page.
 *
 * `fill` is for a page that is one full-height tool rather than a document
 * (the layout editor): the body takes the rest of the screen and does not
 * scroll, so a canvas inside it can own every drag.
 */
import { IconArrowLeft } from "@tabler/icons-react";
import type { ReactNode } from "react";
import KeebOnLogo from "../assets/keebon-logo.svg?react";
import { useLanguage } from "../hooks/useLanguage";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

export function StandaloneFrame({
  onBack,
  children,
  fill = false,
}: {
  onBack: () => void;
  children: ReactNode;
  fill?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`fixed inset-0 z-40 bg-[var(--color-bg)] ${
        fill ? "flex flex-col overflow-hidden" : "overflow-auto"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-cyber opacity-20 pointer-events-none" />

      <header className="sticky top-0 z-10 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <KeebOnLogo className="w-8 h-8" />
            <div className="flex items-center gap-2">
              <span className="text-lg font-light tracking-wide text-[var(--color-text)]">
                Keeb-On!
              </span>
              <span className="text-xs font-light tracking-wider text-[var(--color-text-muted)] uppercase pt-1">
                Studio
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBack}
              className="btn-ghost border border-[var(--color-border)] flex items-center gap-2 text-sm"
            >
              <IconArrowLeft size={18} />
              <span className="hidden sm:inline">{t("Back")}</span>
            </button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={fill ? "relative flex-1 min-h-0" : "relative"}>
        {children}
      </div>
    </div>
  );
}
