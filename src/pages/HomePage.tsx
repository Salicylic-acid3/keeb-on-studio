import { IconBrandGithub } from "@tabler/icons-react";

import { useLanguage } from "../hooks/useLanguage";

export function HomePage() {
  const { language, t } = useLanguage();

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
              <h1 className="text-xl font-medium text-[var(--color-text)] text-center tablet:text-left">
                {t("Welcome to Keeb-On! Studio")}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {language === "ja" ? (
                  <>
                    Keeb-On! Studio は ClickBoard ErgoTrack と GoFortyMax
                    向けの、もう一つの{" "}
                    <a
                      href="https://zmk.studio/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      ZMK Studio
                    </a>{" "}
                    です（
                    <a
                      href="https://github.com/cormoran/dya-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      DYA Studio
                    </a>{" "}
                    からのフォークです）
                  </>
                ) : (
                  <>
                    Keeb-On! Studio is yet another{" "}
                    <a
                      href="https://zmk.studio/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      ZMK Studio
                    </a>{" "}
                    for ClickBoard ErgoTrack and GoFortyMax, forked from{" "}
                    <a
                      href="https://github.com/cormoran/dya-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      DYA Studio
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Guide */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("Features - What you can do with Keeb-On! Studio")}
          </h2>
          <div className="text-sm text-[var(--color-text-muted)] space-y-4">
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                {t(
                  "You can customize keymaps with a slightly easier UI, equivalent to ZMK Studio.",
                )}
              </li>
              <li>
                {t(
                  "You can configure trackball sensitivity, auto layer switching and various input processor settings.",
                )}
              </li>
              <li>
                {t(
                  "You can inspect device diagnostics and generate a troubleshooting report to share when asking for support.",
                )}
              </li>
              <li>
                {t("You can name BLE connection targets and unpair them.")}
              </li>
              <li>
                {t(
                  "You can change various settings such as the time to enter sleep mode.",
                )}
              </li>
            </ul>
            <p>{t("See also below Q&A section for more details.")}</p>
          </div>
        </div>

        {/* Supported Keyboards Section */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("Supported keyboards")}
          </h2>
          <div className="space-y-3">
            {/* ClickBoard ErgoTrack */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] group flex-col sm:flex-row">
              <div className="flex flex-col flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    ClickBoard ErgoTrack
                  </p>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t(
                      "An ultra-thin ClickBoard-series keyboard using mouse switches.",
                    )}
                  </span>
                  <span className="text-xs font-medium uppercase text-[var(--color-cyber)] sm:ml-auto">
                    {t("Coming Soon")}
                  </span>
                </div>
              </div>
            </div>

            {/* GoFortyMax */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] group flex-col sm:flex-row">
              <div className="flex flex-col flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    GoFortyMax
                  </p>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("From the GoForty small-form-factor keyboard line.")}
                  </span>
                  <span className="text-xs font-medium uppercase text-[var(--color-cyber)] sm:ml-auto">
                    {t("Coming Soon")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Q&amp;A
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                {t("Q: Can my keyboard support Keeb-On! Studio?")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t(
                  "A: Yes, you can use the keymap feature without any modification with your ZMK keyboard.",
                )}
                <br />
                {t(
                  "You can also support other features by using cormoran's ZMK fork and cormoran's ZMK modules, although it's not suggested considering compatibility and maintainability.",
                )}
                <br />
                {t(
                  "ClickBoard ErgoTrack and GoFortyMax firmware support is in progress.",
                )}
                <div className="mt-2 p-3 rounded bg-[var(--color-warning)]/20 border border-[var(--color-warning)] text-[var(--color-warning)] text-xs">
                  {t(
                    "Warning: cormoran's ZMK fork is very experimental, optimized for DYA keyboards and may contain unstable or breaking changes. Use at your own risk. In rare cases, it may cause malfunction or damage to your keyboard hardware.",
                  )}
                </div>
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                {t("Q: Can I get source code of Keeb-On! Studio?")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {language === "ja" ? (
                  <>
                    A: はい、Keeb-On! Studio はオープンソース（AGPL-3.0）です。
                    <a
                      href="https://github.com/Salicylic-acid3/keeb-on-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1 inline-flex items-center gap-1"
                    >
                      <IconBrandGithub size={14} />
                      GitHub
                    </a>
                    で公開しています。フォーク元の
                    <a
                      href="https://github.com/cormoran/dya-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1 inline-flex items-center gap-1"
                    >
                      <IconBrandGithub size={14} />
                      DYA Studio
                    </a>
                    のソースはこちらです。
                  </>
                ) : (
                  <>
                    A: Yes, Keeb-On! Studio is open source (AGPL-3.0). Find it
                    on{" "}
                    <a
                      href="https://github.com/Salicylic-acid3/keeb-on-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1 inline-flex items-center gap-1"
                    >
                      <IconBrandGithub size={14} />
                      GitHub
                    </a>
                    . The upstream{" "}
                    <a
                      href="https://github.com/cormoran/dya-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1 inline-flex items-center gap-1"
                    >
                      <IconBrandGithub size={14} />
                      DYA Studio source
                    </a>{" "}
                    is what this fork started from.
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)] mb-1">
                {t("Q: Are there plan to migrate the ZMK fork to ZMK v0.4.0?")}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t(
                  "A: Yes, it's already done. The ZMK fork now tracks recent ZMK (Zephyr 4.x).",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
