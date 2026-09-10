/**
 * UnlockPrompt Component
 *
 * A dialog that prompts the user to unlock their keyboard
 * when ZMK Studio lock is detected.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { IconLock, IconKeyboard, IconRefresh } from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";
import { unlockHintFor } from "../lib/studioUnlockHint";

interface UnlockPromptProps {
  /** Whether the dialog is open */
  open: boolean;
  /**
   * The keyboard's reported name, used to name its actual unlock gesture.
   * Undefined falls back to the generic wording.
   */
  deviceName?: string | null;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback to retry the operation after unlock */
  onRetry: () => void;
}

export function UnlockPrompt({
  open,
  deviceName,
  onClose,
  onRetry,
}: UnlockPromptProps) {
  const { t } = useLanguage();
  // What to actually press. Only this app's own keyboards can be named; for
  // anything else the generic line is the honest answer.
  const hint = unlockHintFor(deviceName);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-2xl z-50 p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20 flex items-center justify-center">
              <IconLock size={32} className="text-[var(--color-electric)]" />
            </div>
          </div>

          {/* Title */}
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)] text-center mb-2">
            {t("Keyboard Unlock Required")}
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description className="text-sm text-[var(--color-text-muted)] text-center mb-6">
            {t(
              "Your keyboard's ZMK Studio is locked. Please unlock it to continue editing your keymap.",
            )}
          </Dialog.Description>

          {/* Instructions */}
          <div className="glass-card p-4 mb-6">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
              <IconKeyboard
                size={18}
                className="text-[var(--color-text-muted)]"
              />
              {t("How to Unlock")}
            </h4>
            <ol className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                  1
                </span>
                <span>
                  {hint
                    ? t(hint)
                    : t(
                        "Press the studio unlock key combination on your keyboard",
                      )}
                </span>
              </li>
              {/* No LED step: neither of these keyboards has an indicator for
                  this, and the app notices the unlock by itself — the device
                  sends a lock-state change, which closes this dialog and
                  resumes whatever the user was doing. Retry is for when that
                  notification does not arrive. */}
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-electric)]/20 text-[var(--color-electric)] text-xs flex items-center justify-center">
                  2
                </span>
                <span>
                  {t(
                    "This dialog closes on its own once the keyboard reports it. Press Retry if it does not.",
                  )}
                </span>
              </li>
            </ol>
          </div>

          {/* Note: only for a keyboard we could not name a gesture for.
              Telling someone to go read their keymap is unhelpful when we
              already told them which keys to press. */}
          {!hint && (
            <p className="text-xs text-[var(--color-text-muted)] mb-6 text-center">
              {t(
                "The unlock key combination is typically configured in your ZMK keymap. Check your firmware configuration if you're unsure.",
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex-1 btn-ghost border border-[var(--color-border)]"
              onClick={onClose}
            >
              {t("Cancel")}
            </button>
            <button
              className="flex-1 btn-electric flex items-center justify-center gap-2"
              onClick={() => {
                onRetry();
              }}
            >
              <IconRefresh size={18} />
              {t("Retry")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
