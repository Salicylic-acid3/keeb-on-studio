/**
 * The QMK (Vial) side's About page (/qmk/about): what Keeb-On! Studio does
 * for the QMK keyboards, which ones it is for, and the Q&A.
 *
 * The ZMK side's page (pages/HomePage.tsx) speaks of ZMK Studio, Bluetooth
 * and ZMK keyboards, none of which apply here, so the QMK side has its own
 * page in the same layout instead of a mix of both on one.
 *
 * The keyboard list comes from the firmware list (lib/firmwareDownloads.ts),
 * the same one the download page shows, so a keyboard added there shows up
 * here too.
 *
 * The copy is written out per language here rather than through the
 * dictionary: several sentences carry a link in the middle, and the words
 * around it do not split the same way in Japanese, English and Chinese.
 */
import { IconBrandGithub } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { qmkSeries } from "../../lib/firmwareDownloads";
import { AuthorLinks } from "../../pages/HomePage";

const linkClass =
  "underline text-[var(--color-electric)] hover:text-[var(--color-neon)] transition-colors mx-1";

type Copy = { ja: ReactNode; en: ReactNode; zh: ReactNode };

function QA({ q, children }: { q: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="font-medium text-[var(--color-text)] mb-1">{q}</p>
      <div className="text-sm text-[var(--color-text-muted)] space-y-1">
        {children}
      </div>
    </div>
  );
}

export function QmkAboutContent({
  headerAside,
  onShowDownloads,
}: {
  /** The ZMK / QMK switch, at the right of the title. */
  headerAside?: ReactNode;
  onShowDownloads?: () => void;
}) {
  const { language, t } = useLanguage();
  const pick = (copy: Copy) =>
    language === "ja" ? copy.ja : language === "zh" ? copy.zh : copy.en;

  const dl = (label: string) =>
    onShowDownloads ? (
      <button onClick={onShowDownloads} className={linkClass}>
        {label}
      </button>
    ) : (
      <span className="mx-1">{label}</span>
    );
  const download = {
    ja: dl("ダウンロードページ"),
    en: dl("download page"),
    zh: dl("下载页面"),
  };
  const vial = (
    <a
      href="https://get.vial.today/"
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      Vial
    </a>
  );
  const github = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} inline-flex items-center gap-1`}
    >
      <IconBrandGithub size={14} />
      {label}
    </a>
  );

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col tablet:flex-row tablet:items-start gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-xl font-medium text-[var(--color-text)] text-center tablet:text-left">
              {pick({
                ja: "Keeb-On! Studio（QMK版）へようこそ",
                en: "Welcome to Keeb-On! Studio for QMK",
                zh: "欢迎使用 Keeb-On! Studio（QMK 版）",
              })}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {pick({
                ja: "Keeb-On! Studio の QMK版は、Salicylic_acid3 が開発する QMK キーボードを、ブラウザから設定するためのツールです。中身は Vial と同じ仕組みで動くので、Vial でできることはほとんどそのままできます。",
                en: "The QMK side of Keeb-On! Studio sets up the QMK keyboards Salicylic_acid3 develops, from the browser. It works the same way as Vial underneath, so almost everything Vial does, it does too.",
                zh: "Keeb-On! Studio 的 QMK 版用于在浏览器中设置 Salicylic_acid3 开发的 QMK 键盘。它的底层与 Vial 的工作方式相同，因此 Vial 能做的事情几乎都能做到。",
              })}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {pick({
                ja: "対応しているのは、主に Vial のファームウェアを書き込んだキーボードだけです。Keeb-On! Studio 用のファームウェア（Vial＋OS切り替え）なら、より多くの機能を使えます。",
                en: "It is mainly for those keyboards with Vial firmware written on them. With the Keeb-On! Studio firmware (Vial plus OS switching), more of its features work.",
                zh: "主要只支持写入了 Vial 固件的键盘。使用 Keeb-On! Studio 专用固件（Vial＋OS 切换）可以使用更多功能。",
              })}
            </p>
          </div>
          {headerAside && (
            <div className="flex justify-center tablet:justify-end">
              {headerAside}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("Features - What you can do with Keeb-On! Studio")}
          </h2>
          <div className="text-sm text-[var(--color-text-muted)] space-y-4">
            <ul className="list-disc list-outside space-y-2 pl-5">
              <li>
                {pick({
                  ja: "キーボードの図を見ながら、キーマップとレイヤーを変更できます。キーは一覧からも、キーボードの形からも選べます。",
                  en: "Change the keymap and layers on a picture of your keyboard, choosing keys from a list or from a keyboard.",
                  zh: "可以一边看键盘图一边修改键位映射和层。按键既可以从列表中选择，也可以从键盘布局中选择。",
                })}
              </li>
              <li>
                {pick({
                  ja: "マクロ・コンボ・タップダンス・キーオーバーライドを設定できます。",
                  en: "Set up macros, combos, tap dances and key overrides.",
                  zh: "可以设置宏、组合键、Tap Dance 和按键覆盖。",
                })}
              </li>
              <li>
                {pick({
                  ja: "タップ/ホールドやマウスキーなど、Vial の QMK Settings と同じ設定を変更できます。",
                  en: "Change Tap-Hold, mouse keys and the other settings Vial calls QMK Settings.",
                  zh: "可以修改点按/按住、鼠标键等与 Vial 的 QMK Settings 相同的设置。",
                })}
              </li>
              <li>
                {pick({
                  ja: "キーマップをブラウザに保存したり、ファイル・共有リンク・ギャラリーでやり取りしたりできます。Vial の .vil ファイルも読み込めます。",
                  en: "Keep keymaps in the browser, and pass them on as a file, a share link or a gallery post. Vial's .vil files open too.",
                  zh: "可以把键位映射保存在浏览器中，也可以通过文件、分享链接或画廊交换。也能读取 Vial 的 .vil 文件。",
                })}
              </li>
              <li>
                {pick({
                  ja: "ファイルを手でコピーしなくても、ブラウザからファームウェアを最新に更新できます。",
                  en: "Update the keyboard to the latest firmware from the browser, without copying files by hand.",
                  zh: "无需手动复制文件，即可在浏览器中把固件更新到最新版本。",
                })}
              </li>
              <li>
                {pick({
                  ja: "Keeb-On! Studio 用のファームウェアなら、つないだパソコンの OS（Windows・macOS・Linux）に合わせて、キーマップを自動で切り替えられます。",
                  en: "With the Keeb-On! Studio firmware, the keymap switches by itself to suit the OS of the computer it is plugged into (Windows, macOS, Linux).",
                  zh: "使用 Keeb-On! Studio 专用固件时，键位映射会根据所连接电脑的操作系统（Windows、macOS、Linux）自动切换。",
                })}
              </li>
            </ul>
            <p>{t("See also below Q&A section for more details.")}</p>
          </div>
        </div>

        {/* Supported keyboards */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            {t("Supported keyboards")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {qmkSeries().map(({ series, models }) => (
              <li
                key={series}
                className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {series}
                </p>
                {(models.length > 1 || models[0] !== series) && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {models.join(" / ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--color-text-muted)] mt-4">
            {pick({
              ja: (
                <>
                  いずれも Vial のファームウェアを書き込んで、USB
                  でつなぎます。各機種の Keeb-On! Studio 用のファームウェアは
                  {download.ja}にあります。
                </>
              ),
              en: (
                <>
                  Each connects over USB with Vial firmware on it. The Keeb-On!
                  Studio firmware for each one is on the {download.en}.
                </>
              ),
              zh: (
                <>
                  均需写入 Vial 固件并通过 USB 连接。各型号的 Keeb-On! Studio
                  专用固件可在{download.zh}获取。
                </>
              ),
            })}
          </p>
        </div>

        {/* Q&A */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            Q&amp;A
          </h2>
          <div className="space-y-4">
            <QA q={t("Q: Can my keyboard support Keeb-On! Studio?")}>
              <p>
                {pick({
                  ja: (
                    <>
                      A: Salicylic_acid3 が開発した QMK キーボードのうち、主に
                      Vial
                      のファームウェアを書き込んだもの（上の対応キーボード）だけに対応しています。それ以外の
                      Vial キーボードは接続できないので、本家の{vial}
                      をご利用ください。
                    </>
                  ),
                  en: (
                    <>
                      A: It is mainly for the QMK keyboards Salicylic_acid3
                      develops, with Vial firmware written on them (the list
                      above). Other Vial keyboards cannot connect; please use
                      the upstream {vial}.
                    </>
                  ),
                  zh: (
                    <>
                      A: 主要只支持 Salicylic_acid3 开发的、写入了 Vial 固件的
                      QMK 键盘（即上面的支持键盘）。其他 Vial
                      键盘无法连接，请使用原版{vial}。
                    </>
                  ),
                })}
              </p>
              <p>
                {pick({
                  ja: "ClickBoard ErgoTrack や GoFortyMax Ortho などの無線（ZMK）キーボードは、ZMK版で設定します（右上の「ZMK / QMK」で切り替え）。",
                  en: "Wireless (ZMK) keyboards such as ClickBoard ErgoTrack and GoFortyMax Ortho are set up on the ZMK side (ZMK / QMK at the top right).",
                  zh: "ClickBoard ErgoTrack、GoFortyMax Ortho 等无线（ZMK）键盘请在 ZMK 版中设置（右上角的“ZMK / QMK”切换）。",
                })}
              </p>
            </QA>

            <QA
              q={pick({
                ja: "Q: Keeb-On! Studio 用のファームウェアと Vial のファームウェアは何が違いますか？",
                en: "Q: What is the difference between the Keeb-On! Studio firmware and Vial firmware?",
                zh: "Q: Keeb-On! Studio 专用固件与 Vial 固件有什么区别？",
              })}
            >
              <p>
                {pick({
                  ja: "A: Keeb-On! Studio 用のファームウェアは、Vial のファームウェアに OS の自動切り替えを足したものです。キーマップ、マクロ、コンボ、タップダンス、設定の変更はどちらでもできますが、OS タブ（つないだパソコンの OS ごとにキーマップを切り替える機能）は Keeb-On! Studio 用のファームウェアでだけ使えます。",
                  en: "A: The Keeb-On! Studio firmware is Vial firmware with automatic OS switching added. The keymap, macros, combos, tap dances and settings can be changed with either; the OS tab (a keymap for each OS of the computer it is plugged into) works only with the Keeb-On! Studio firmware.",
                  zh: "A: Keeb-On! Studio 专用固件是在 Vial 固件的基础上增加了操作系统自动切换。键位映射、宏、组合键、Tap Dance 和设置在两者上都可以修改，但 OS 标签页（按所连接电脑的操作系统切换键位映射）只能在 Keeb-On! Studio 专用固件上使用。",
                })}
              </p>
              <p>
                {pick({
                  ja: (
                    <>
                      Keeb-On! Studio 用のファームウェアは本家の Vial
                      でもそのまま使えるので、Vial と併用できます。{download.ja}
                      からダウンロードできます。
                    </>
                  ),
                  en: (
                    <>
                      The Keeb-On! Studio firmware works in the upstream Vial as
                      it is, so you can keep using Vial too. Get it from the{" "}
                      {download.en}.
                    </>
                  ),
                  zh: (
                    <>
                      Keeb-On! Studio 专用固件也可以直接在原版 Vial
                      中使用，因此可以与 Vial 并用。可在{download.zh}下载。
                    </>
                  ),
                })}
              </p>
            </QA>

            <QA
              q={pick({
                ja: "Q: 接続しようとしても、キーボードが一覧に出てきません。",
                en: "Q: My keyboard does not appear when I connect. What should I check?",
                zh: "Q: 尝试连接时，键盘没有出现在列表中。",
              })}
            >
              <p>
                {pick({
                  ja: (
                    <>
                      A: VIA や Remap
                      用のファームウェア、古いファームウェアのままだと一覧に出ません。
                      {download.ja}
                      から最新のファームウェアを書き込んでください。
                    </>
                  ),
                  en: (
                    <>
                      A: A keyboard with VIA or Remap firmware, or with old
                      firmware, does not appear in the list. Write the latest
                      firmware from the {download.en}.
                    </>
                  ),
                  zh: (
                    <>
                      A: 如果键盘写入的是 VIA 或 Remap
                      用的固件，或者仍是旧版固件，就不会出现在列表中。请从
                      {download.zh}写入最新固件。
                    </>
                  ),
                })}
              </p>
              <p>
                {pick({
                  ja: "接続には、パソコン（Windows・macOS・Linux）の Chrome か Edge が必要です。スマートフォンやタブレット、Safari・Firefox では接続できません。",
                  en: "Connecting needs Chrome or Edge on a computer (Windows, macOS, Linux); it does not work on a phone or tablet, or in Safari or Firefox.",
                  zh: "连接需要电脑（Windows、macOS、Linux）上的 Chrome 或 Edge。手机、平板以及 Safari、Firefox 无法连接。",
                })}
              </p>
            </QA>

            <QA
              q={pick({
                ja: "Q: キーボードのロック解除を求められました。",
                en: "Q: It asks me to unlock the keyboard. What do I do?",
                zh: "Q: 提示需要解锁键盘。",
              })}
            >
              <p>
                {pick({
                  ja: "A: Vial のキーボードは、マクロの保存、キー入力表示、ファームウェアの更新の前にロック解除が必要です。画面に表示されたキーを、バーがいっぱいになるまで同時に押し続けてください。キーボードを抜き差しするまでは、解除されたままです。",
                  en: "A: Vial keyboards need unlocking before macros are saved, before live keys are shown and before a firmware update. Hold the keys shown on the screen together until the bar fills. It stays unlocked until the keyboard is unplugged.",
                  zh: "A: Vial 键盘在保存宏、显示按键输入以及更新固件之前需要解锁。请同时按住屏幕上显示的按键，直到进度条填满。在拔插键盘之前会一直保持解锁状态。",
                })}
              </p>
            </QA>

            <QA q={t("Q: Can I get source code of Keeb-On! Studio?")}>
              <p>
                {pick({
                  ja: (
                    <>
                      A: はい、Keeb-On! Studio
                      はオープンソース（AGPL-3.0）です。
                      {github(
                        "https://github.com/Salicylic-acid3/keeb-on-studio",
                        "GitHub",
                      )}
                      で公開しています。ファームウェアは
                      {github(
                        "https://github.com/Salicylic-acid3/vial-qmk",
                        "vial-qmk",
                      )}
                      のフォークからビルドしています。
                    </>
                  ),
                  en: (
                    <>
                      A: Yes, Keeb-On! Studio is open source (AGPL-3.0) on{" "}
                      {github(
                        "https://github.com/Salicylic-acid3/keeb-on-studio",
                        "GitHub",
                      )}
                      . The firmware is built from a fork of{" "}
                      {github(
                        "https://github.com/Salicylic-acid3/vial-qmk",
                        "vial-qmk",
                      )}
                      .
                    </>
                  ),
                  zh: (
                    <>
                      A: 是的，Keeb-On! Studio 是开源软件（AGPL-3.0），在
                      {github(
                        "https://github.com/Salicylic-acid3/keeb-on-studio",
                        "GitHub",
                      )}
                      上公开。固件由
                      {github(
                        "https://github.com/Salicylic-acid3/vial-qmk",
                        "vial-qmk",
                      )}
                      的分支构建。
                    </>
                  ),
                })}
              </p>
            </QA>
          </div>
        </div>

        <AuthorLinks />
      </div>
    </div>
  );
}
