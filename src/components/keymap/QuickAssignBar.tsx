/**
 * The keyboard that lives at the bottom of the keymap screen.
 *
 * Setting one key is a job for the dialog: it can express anything a binding
 * can be. Setting thirty in a row is not — each key costs an open, a choice
 * and a close, and the board you are editing vanishes behind the modal every
 * time you choose.
 *
 * So this is the other half of that trade, and deliberately only the other
 * half: one behavior, a plain key press, picked off a keyboard that stays on
 * screen, applied to the selected key, which then advances. Everything with
 * parameters — layer taps, mod taps, macros — still goes through the dialog,
 * which is why the dialog is untouched.
 *
 * It stays collapsed to a single button until asked for. The dialog is the
 * better tool for most edits and should not be pushed aside by a panel nobody
 * opened; and on a laptop screen this panel is a real slice of the keymap.
 */
import { IconKeyboard, IconX } from "@tabler/icons-react";
import { KeyLayoutSelector } from "../KeyLayoutSelector";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";
import { useLanguage } from "../../hooks/useLanguage";

export interface QuickAssignBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which key is being set, in words. Null when none is selected. */
  targetLabel: string | null;
  /** The base keycode currently on the selected key, for highlighting. */
  selectedCode: number;
  /** A keycode was picked. The page turns it into a binding and advances. */
  onAssign: (code: number) => void;
  keyboardLayout?: KeyboardLayoutType;
  /** True once the run has walked off the end of the board. */
  finished: boolean;
  disabled?: boolean;
}

export function QuickAssignBar({
  open,
  onOpenChange,
  targetLabel,
  selectedCode,
  onAssign,
  keyboardLayout,
  finished,
  disabled = false,
}: QuickAssignBarProps) {
  const { t } = useLanguage();

  if (!open) {
    return (
      <div className="flex justify-center mt-4">
        <button
          className="btn-ghost text-sm flex items-center gap-2"
          onClick={() => onOpenChange(true)}
          disabled={disabled}
          aria-label={t("Set keys one after another")}
        >
          <IconKeyboard size={18} />
          {t("Set keys one after another")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 glass-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <IconKeyboard size={18} className="text-[var(--color-text-muted)]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text)]">
            {finished
              ? t("That was the last key.")
              : targetLabel
                ? t("Setting: {{key}}", { key: targetLabel })
                : t("Pick a key on the board to start.")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Choosing a key here sets it and moves to the next one. Use the key dialog for anything other than a plain key press.",
            )}
          </p>
        </div>
        <button
          className="btn-ghost p-2"
          onClick={() => onOpenChange(false)}
          aria-label={t("Close")}
        >
          <IconX size={16} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Dimmed rather than unmounted when there is no target: the keyboard
          staying put is the point, and a panel that appears and disappears as
          the selection changes would be worse than one that waits. */}
      <div
        className={
          targetLabel === null || disabled
            ? "opacity-40 pointer-events-none"
            : undefined
        }
      >
        <KeyLayoutSelector
          selectedCode={selectedCode}
          onSelect={onAssign}
          keyboardLayout={keyboardLayout}
        />
      </div>
    </div>
  );
}
