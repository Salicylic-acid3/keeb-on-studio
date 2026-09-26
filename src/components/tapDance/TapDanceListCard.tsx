/**
 * The tap dance list, in the left column under Macros and Combos.
 *
 * One row per slot, named the way the keymap names it (`&rtd N`), with what
 * each tap count does on the second line, so a person can find the dance
 * they are after without opening each one.
 */
import { IconLoader2 } from "@tabler/icons-react";
import { StatusDot } from "../EditStatusIndicator";
import { DocTip } from "../DocTip";
import { useLanguage } from "../../hooks/useLanguage";
import { tapDanceDoc } from "../../i18n/featureDocs";
import { formatBehaviorBinding } from "../../lib/behaviorMetadata";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";
import type { TapDanceSlot } from "../../lib/tapDance/slots";
import type { BehaviorDefinition } from "../../hooks/useKeymap";
import {
  slotHasUnsavedValue,
  tapBinding,
  type UseTapDanceReturn,
} from "./useTapDance";

export interface TapDanceListCardProps {
  tapDance: UseTapDanceReturn;
  behaviors: Map<number, BehaviorDefinition>;
  layers: Array<{ id: number; name: string }>;
  keyboardLayout: KeyboardLayoutType;
  selectedIndex: number | null;
  onSelect: (slot: TapDanceSlot) => void;
}

/** "Esc · Tab · —": one entry per tap, in order. */
function summarizeTaps(
  slot: TapDanceSlot,
  tapDance: Pick<UseTapDanceReturn, "isUnset">,
  behaviors: Map<number, BehaviorDefinition>,
  layers: Array<{ id: number; name: string }>,
  keyboardLayout: KeyboardLayoutType,
): string {
  return slot.taps
    .map((tap) => {
      const binding = tapBinding(tap);
      if (tapDance.isUnset(binding) || !binding) return "—";
      const behavior = behaviors.get(binding.behaviorId);
      if (!behavior) return "?";
      return formatBehaviorBinding(binding, behavior, {
        layers,
        keyboardLayout,
      });
    })
    .join(" · ");
}

export function TapDanceListCard({
  tapDance,
  behaviors,
  layers,
  keyboardLayout,
  selectedIndex,
  onSelect,
}: TapDanceListCardProps) {
  const { t } = useLanguage();

  return (
    <section className="glass-card p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium text-[var(--color-text)]">
            {t("Tap Dance")}
          </h2>
          <DocTip content={tapDanceDoc(t)} />
        </div>
        {tapDance.isLoading && (
          <IconLoader2
            size={14}
            className="animate-spin text-[var(--color-electric)]"
          />
        )}
      </div>

      <div className="space-y-2">
        {tapDance.slots.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {tapDance.isLoading
              ? t("Loading…")
              : t("This keyboard has no tap dance slots.")}
          </p>
        )}
        {tapDance.slots.map((slot) => {
          const summary = summarizeTaps(
            slot,
            tapDance,
            behaviors,
            layers,
            keyboardLayout,
          );
          return (
            <button
              key={slot.index}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedIndex === slot.index
                  ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
              } ${slot.taps.length === 0 ? "opacity-60" : ""}`}
              onClick={() => onSelect(slot)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-text)] truncate flex-1">
                  {t("Tap dance {{index}}", { index: slot.index })}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <code className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)]">
                    &amp;rtd {slot.index}
                  </code>
                  {slotHasUnsavedValue(slot) && <StatusDot status="unsaved" />}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)] truncate">
                {slot.taps.length === 0 ? (
                  <span className="text-[var(--color-text-muted)]">
                    {t("No taps — does nothing")}
                  </span>
                ) : (
                  summary
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
