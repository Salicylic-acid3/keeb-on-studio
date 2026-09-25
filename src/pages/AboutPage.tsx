/**
 * The Home tab, reachable before a keyboard is connected.
 *
 * The splash screen offered nothing but three connect buttons, so someone
 * who arrived without a keyboard -- deciding whether to buy one, or sent
 * here by a link -- had no way to see what the app does, which keyboards it
 * is for, or the Q&A, all of which sit on the Home tab behind the
 * connection gate. This is that tab in the standalone page frame the
 * release notes use, on its own path, so it can also be linked to directly.
 */
import { IconArrowLeft } from "@tabler/icons-react";
import KeebOnLogo from "../assets/keebon-logo.svg?react";
import { useLanguage } from "../hooks/useLanguage";
import { LanguageToggle } from "../components/LanguageToggle";
import { HomePage } from "./HomePage";

export const ABOUT_PATH = "/about";

export function AboutPage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-[var(--color-bg)]">
      <div className="absolute inset-0 bg-gradient-cyber opacity-20 pointer-events-none" />

      {/* Same top bar as the release notes: brand left, controls right */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="btn-ghost border border-[var(--color-border)] flex items-center gap-2 text-sm"
            >
              <IconArrowLeft size={18} />
              <span className="hidden sm:inline">{t("Back")}</span>
            </button>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <div className="relative">
        <HomePage />
      </div>
    </div>
  );
}
