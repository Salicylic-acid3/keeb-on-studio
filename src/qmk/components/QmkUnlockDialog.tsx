/**
 * Vial's unlock, in the ZMK side's unlock prompt look (components/
 * UnlockPrompt.tsx). Shown while Save waits for the keyboard to accept
 * macros, or live keys wait to start: names the keys to hold and fills as the firmware counts down.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { IconKeyboard, IconLock } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";

interface Props {
  open: boolean;
  keyNames: string[];
  progress: number;
  onCancel: () => void;
}

export function QmkUnlockDialog({ open, keyNames, progress, onCancel }: Props) {
  const { t } = useLanguage();
  const keys = keyNames.filter(Boolean).join(" + ");
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
              <IconLock size={32} className="text-[var(--color-electric)]" />
            </div>
          </div>
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] text-center mb-2">
            {t("Keyboard Unlock Required")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] text-center mb-6">
            {t(
              "Vial asks for the keyboard to be unlocked before saving macros or showing live keys.",
            )}
          </Dialog.Description>
          <div className="glass-card p-4 mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
              <IconKeyboard
                size={18}
                className="text-[var(--color-text-muted)]"
              />
              {t("How to Unlock")}
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              {keys
                ? t("Hold {{keys}} together until the bar fills.", { keys })
                : t("Hold the unlock keys together until the bar fills.")}
            </p>
            <div
              className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-[var(--color-electric)] transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-6 text-center">
            {t(
              "If you cancel, the keyboard keeps waiting for these keys until it is unplugged.",
            )}
          </p>
          <button
            className="w-full btn-ghost border border-[var(--color-border)]"
            onClick={onCancel}
          >
            {t("Cancel")}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
