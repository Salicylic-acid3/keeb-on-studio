/**
 * The right-column editor for one tap dance slot.
 *
 * Edits land in keyboard memory as they are made, the same as the macro and
 * combo editors; the tab's Save button persists them. Nothing here saves
 * on its own.
 */
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { KeycodeSelector } from "../KeycodeSelector";
import { StatusDot } from "../EditStatusIndicator";
import { useLanguage } from "../../hooks/useLanguage";
import { formatBehaviorBinding } from "../../lib/behaviorMetadata";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";
import type { TapDanceSlot } from "../../lib/tapDance/slots";
import type {
  BehaviorBinding,
  BehaviorDefinition,
} from "../../hooks/useKeymap";
import {
  slotHasUnsavedValue,
  tapBinding,
  type UseTapDanceReturn,
} from "./useTapDance";

export interface TapDanceEditorCardProps {
  tapDance: UseTapDanceReturn;
  slot: TapDanceSlot;
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
  keyboardLayout: KeyboardLayoutType;
  disabled?: boolean;
}

export function TapDanceEditorCard({
  tapDance,
  slot,
  behaviors,
  layers,
  keyboardLayout,
  disabled = false,
}: TapDanceEditorCardProps) {
  const { t } = useLanguage();
  const [editingTap, setEditingTap] = useState<number | null>(null);

  // The same label the keymap puts on a key. The behavior name alone is not
  // enough to tell taps apart: two &kp taps both read "Key Press", so a dance
  // of Escape then Tab would show the same word twice.
  const tapLabel = (binding: BehaviorBinding | null): string => {
    if (!binding || tapDance.isUnset(binding)) return "";
    const behavior = behaviors.get(binding.behaviorId);
    if (!behavior) return "";
    return formatBehaviorBinding(binding, behavior, { layers, keyboardLayout });
  };

  const full = slot.maxTaps > 0 && slot.taps.length >= slot.maxTaps;

  return (
    <section className="glass-card p-4 tablet:p-6 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {t("Tap dance {{index}}", { index: slot.index })}
            </h2>
            <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)]">
              &amp;rtd {slot.index}
            </code>
            {slotHasUnsavedValue(slot) && <StatusDot status="unsaved" />}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Put &rtd {{index}} on a key in the Keymap tab. Tapping that key once, twice or three times does what is set here.",
              { index: slot.index },
            )}
          </p>
        </div>
        {slot.term && (
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-[var(--color-text-muted)]">
            {t("Wait between taps")}
            <input
              type="number"
              min={50}
              max={1000}
              step={10}
              // Narrow and fixed: three digits is the whole range, and
              // input-field is full-width by default, which otherwise
              // swallows the row.
              className="input-field !w-20 shrink-0 px-2 py-1 text-sm"
              value={slot.term.value?.int32Value ?? 200}
              disabled={disabled}
              onChange={(event) =>
                void tapDance.setTerm(slot, Number(event.target.value))
              }
            />
            ms
          </label>
        )}
      </div>

      {tapDance.error && (
        <p className="mb-3 text-sm text-[var(--color-warning)]">
          {tapDance.error}
        </p>
      )}

      {slot.taps.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {t(
            "No taps yet — this slot does nothing when pressed. Add one to start.",
          )}
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {slot.taps.map((tap, tapIndex) => {
            const binding = tapBinding(tap);
            const name = tapLabel(binding);
            return (
              <li
                key={tap.value?.arrayValue?.index ?? tapIndex}
                className="flex items-center gap-3"
              >
                <span className="w-20 shrink-0 text-xs text-[var(--color-text-muted)]">
                  {t("{{count}} taps", { count: tapIndex + 1 })}
                </span>
                <button
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-electric)]/50 text-left transition-colors disabled:opacity-40"
                  disabled={disabled}
                  onClick={() => setEditingTap(tapIndex)}
                >
                  <span
                    className={`block text-sm truncate ${
                      name
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {name || t("Not set — click to choose")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
          onClick={() => void tapDance.addTap(slot)}
          disabled={disabled || tapDance.noneBehaviorId === null || full}
          title={
            tapDance.noneBehaviorId === null
              ? t('This keyboard has no "None" behavior to start a tap from.')
              : full
                ? t("This keyboard allows up to {{count}} taps.", {
                    count: slot.maxTaps,
                  })
                : undefined
          }
        >
          <IconPlus size={14} />
          {t("Add a tap")}
        </button>
        <button
          className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
          onClick={() => void tapDance.removeTap(slot)}
          disabled={disabled || slot.taps.length === 0}
        >
          <IconMinus size={14} />
          {t("Remove the last tap")}
        </button>
      </div>

      {/* The same picker the keymap uses, so a tap is chosen exactly the way
          a key is. */}
      <KeycodeSelector
        open={editingTap !== null}
        onClose={() => setEditingTap(null)}
        onSelect={(binding) => {
          if (editingTap !== null) {
            void tapDance.setTap(slot, editingTap, binding);
          }
          setEditingTap(null);
        }}
        currentBinding={
          editingTap !== null ? tapBinding(slot.taps[editingTap]) : null
        }
        behaviors={behaviors}
        layers={layers}
      />
    </section>
  );
}
