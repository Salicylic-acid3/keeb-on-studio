import {
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandX,
  IconBrandYoutube,
  IconBuildingStore,
  IconCalendarWeek,
  IconNotebook,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { useLanguage } from "../hooks/useLanguage";

/**
 * Salicylic_acid3's own channels. The site names stay in Japanese in every
 * language -- they are the brands' actual names, not copy to translate -- so
 * each carries a translated category label to say what it is.
 */
const AUTHOR_LINKS: {
  href: string;
  name: string;
  /** Translation key for the category label. */
  category: string;
  icon: ReactNode;
}[] = [
  {
    href: "https://salicylic-acid3.hatenablog.com/",
    name: "自作キーボード温泉街の歩き方",
    category: "Blog",
    icon: <IconNotebook size={16} />,
  },
  {
    href: "https://salicylic-weekly.hatenablog.jp/",
    name: "自作キーボード温泉街週報",
    category: "Weekly notes",
    icon: <IconCalendarWeek size={16} />,
  },
  {
    href: "https://salicylic-acid3.booth.pm/",
    name: "自キ温泉街販売所",
    category: "Shop",
    icon: <IconBuildingStore size={16} />,
  },
  {
    href: "https://www.youtube.com/channel/UCGGha1Gn2y0xenVLjHE7ylg",
    name: "自キ温泉街放送局",
    category: "YouTube",
    icon: <IconBrandYoutube size={16} />,
  },
  {
    href: "https://x.com/Salicylic_acid3",
    name: "@Salicylic_acid3",
    category: "X",
    icon: <IconBrandX size={16} />,
  },
  {
    href: "https://discord.gg/y5CNqgEsNg",
    name: "Discord",
    category: "Community",
    icon: <IconBrandDiscord size={16} />,
  },
];

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
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {language === "ja" ? (
                  <>
                    Keeb-On! Studio は DYA Studio
                    の機能を絞り込み、Salicylic_acid3
                    が開発するキーボード向けに特化させたツールです。一般的な ZMK
                    キーボードへの対応は目的としていません。
                  </>
                ) : (
                  <>
                    Keeb-On! Studio intentionally narrows down DYA Studio's
                    feature set to specialize it for the keyboards
                    Salicylic_acid3 develops — it is not intended to support
                    general ZMK keyboards.
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
                {language === "ja" ? (
                  <>
                    A: いいえ。Keeb-On! Studio は Salicylic_acid3
                    が開発するキーボード（ClickBoard ErgoTrack、GoFortyMax
                    など）に特化したツールで、一般の ZMK
                    キーボードには対応していません。
                    <br />
                    一般的な ZMK
                    キーボードで同様のツールを使いたい場合は、本家の{" "}
                    <a
                      href="https://studio.dya.cormoran.works/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      DYA Studio
                    </a>{" "}
                    をご利用のうえ、
                    <a
                      href="https://studio.dya.cormoran.works/developer-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      DYA Studio のドキュメント
                    </a>
                    に従ってセットアップしてください。
                  </>
                ) : (
                  <>
                    A: No — Keeb-On! Studio is specialized for the keyboards
                    Salicylic_acid3 develops (such as ClickBoard ErgoTrack and
                    GoFortyMax) and does not support general ZMK keyboards.
                    <br />
                    If you want a similar tool for a general ZMK keyboard,
                    please use the upstream{" "}
                    <a
                      href="https://studio.dya.cormoran.works/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      DYA Studio
                    </a>{" "}
                    and follow its{" "}
                    <a
                      href="https://studio.dya.cormoran.works/developer-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1"
                    >
                      documentation
                    </a>
                    .
                  </>
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
          </div>
        </div>

        {/* Salicylic_acid3's channels */}
        <div className="glass-card p-6 mt-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("Links by Salicylic_acid3")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AUTHOR_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-electric)] transition-colors group"
                >
                  <span className="text-[var(--color-electric)] shrink-0">
                    {link.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-[var(--color-text-secondary)] truncate group-hover:text-[var(--color-text)] transition-colors">
                      {link.name}
                    </span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {t(link.category)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
