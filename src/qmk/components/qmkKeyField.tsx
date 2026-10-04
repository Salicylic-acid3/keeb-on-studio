/**
 * A key on a combo or key-override card: shows what the key does with the
 * same text the keycaps use, and opens the same "Select Key Binding" dialog
 * as the keymap page when clicked.
 */
import { useState } from "react";
import { KeycodeSelector } from "../../components/KeycodeSelector";
import { useLanguage } from "../../hooks/useLanguage";
import {
  bindingToKeycode,
  keycodeToBinding,
  QmkBridgeError,
} from "../lib/zmkBridge";
import { KC_NO } from "../lib/keycodes/qmkKeycode";
import { qmkKeyLabel, type QmkKeyContext } from "../lib/keyLabel";

interface QmkKeyFieldProps {
  label: string;
  code: number;
  onChange: (code: number) => void;
  ctx: QmkKeyContext;
  /** Shown when the key is empty. */
  placeholder?: string;
  modified?: boolean;
}

export function QmkKeyField({
  label,
  code,
  onChange,
  ctx,
  placeholder,
  modified,
}: QmkKeyFieldProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = qmkKeyLabel(code, ctx);
  return (
    <>
      <button
        type="button"
        className={`w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border hover:border-[var(--color-electric)]/50 text-left transition-colors ${
          modified
            ? "border-[var(--color-neon)]/60"
            : "border-[var(--color-border)]"
        }`}
        onClick={() => setOpen(true)}
      >
        <span className="block text-xs text-[var(--color-text-muted)]">
          {label}
        </span>
        <span
          className={`block text-sm truncate mt-1 ${
            text ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
          }`}
        >
          {text || placeholder || t("Not set")}
        </span>
      </button>
      {error && (
        <p className="mt-1 text-xs text-[var(--color-warning)]">{t(error)}</p>
      )}
      <KeycodeSelector
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(binding) => {
          try {
            onChange(bindingToKeycode(binding));
            setError(null);
            setOpen(false);
          } catch (err) {
            setError(err instanceof QmkBridgeError ? err.message : String(err));
          }
        }}
        currentBinding={code === KC_NO ? null : keycodeToBinding(code)}
        behaviors={ctx.behaviors}
        layers={ctx.layers}
        keyboardLayout={ctx.keyboardLayout}
      />
    </>
  );
}
