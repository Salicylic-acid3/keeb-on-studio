/**
 * The OS-switch module's settings: which OS the keyboard thinks it is on,
 * whether to follow that or pin one, which block each OS uses, and a preview
 * switch for trying another block without unplugging.
 */
import { useState } from "react";
import { IconDeviceDesktop, IconEye, IconEyeOff } from "@tabler/icons-react";
import { HexIcon } from "../../components/brand/HexIcon";
import { useLanguage } from "../../hooks/useLanguage";
import {
  DETECTED_OS_NAMES,
  OS_TARGETS,
  OS_TARGET_NAMES,
} from "../lib/osBlocks";
import type { UseVialKeyboard } from "../hooks/useVialKeyboard";

const MODES = [
  { value: 0, label: "Follow the detected OS" },
  { value: 1, label: "Always Windows" },
  { value: 2, label: "Always macOS" },
  { value: 3, label: "Always Linux" },
];

export function QmkOsPage({ keyboard }: { keyboard: UseVialKeyboard }) {
  const { t } = useLanguage();
  const { info, os } = keyboard;
  const [busy, setBusy] = useState(false);
  if (!info || !os) return null;
  const blocks = info.definition.keebOn?.osBlocks ?? [];
  const blockName = (i: number) => blocks[i]?.id ?? String(i);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <HexIcon>
            <IconDeviceDesktop
              size={24}
              className="text-[var(--color-electric)]"
            />
          </HexIcon>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              {t("OS")}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Which keymap the keyboard uses on each computer")}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 max-w-3xl">
          <section className="glass-card p-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Detected OS")}
            </h2>
            <p className="mt-2 text-2xl font-light text-[var(--color-text)]">
              {t(DETECTED_OS_NAMES[os.detectedOs] ?? "Unknown")}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t("Using block {{block}} (layers {{layers}})", {
                block: blockName(os.activeBlock),
                layers: (blocks[os.activeBlock]?.layers ?? []).join(", "),
              })}
              {os.previewBlock !== null && ` — ${t("preview")}`}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {t(
                "The keyboard works out the OS from how the computer talks to it over USB. A Mac often shows up as iOS; that is the same block.",
              )}
            </p>
          </section>

          <section className="glass-card p-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Which OS to assume")}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t(
                "Pin one when detection gets it wrong, for example behind a KVM switch or in a virtual machine.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => keyboard.setOs(m.value, os.blocks))}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    os.mode === m.value
                      ? "bg-[var(--color-electric)]/15 border-[var(--color-electric)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/60"
                  }`}
                >
                  {t(m.label)}
                </button>
              ))}
            </div>
          </section>

          <section className="glass-card p-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Which block each OS uses")}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t(
                "Point two OSes at the same block to share one keymap between them, e.g. Linux using the Windows block.",
              )}
            </p>
            <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
              {OS_TARGETS.map((target, i) => (
                <div key={target} className="contents">
                  <span className="text-sm text-[var(--color-text)]">
                    {t(OS_TARGET_NAMES[target])}
                  </span>
                  <div className="flex gap-2">
                    {blocks.map((b, bi) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => {
                            const next = [...os.blocks] as [
                              number,
                              number,
                              number,
                              number,
                            ];
                            next[i] = bi;
                            return keyboard.setOs(os.mode, next);
                          })
                        }
                        className={`px-3 py-1 rounded-md border text-xs transition-colors ${
                          os.blocks[i] === bi
                            ? "bg-[var(--color-electric)]/15 border-[var(--color-electric)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-electric)]/60"
                        }`}
                        title={t("Layers {{layers}}", {
                          layers: b.layers.join(", "),
                        })}
                      >
                        {t("Block {{id}}", { id: b.id })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-4">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Try another block")}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t(
                "Switch the keyboard to a block for a moment to type on it. Not saved; unplugging ends it.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {blocks.map((b, bi) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      keyboard.setOsPreview(os.previewBlock === bi ? null : bi),
                    )
                  }
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    os.previewBlock === bi
                      ? "bg-[var(--color-neon)]/15 border-[var(--color-neon)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon)]/60"
                  }`}
                >
                  {os.previewBlock === bi ? (
                    <IconEyeOff size={14} />
                  ) : (
                    <IconEye size={14} />
                  )}
                  {t("Block {{id}}", { id: b.id })}
                </button>
              ))}
              {os.previewBlock !== null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => keyboard.setOsPreview(null))}
                  className="btn-ghost text-sm"
                >
                  {t("Back to normal")}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
