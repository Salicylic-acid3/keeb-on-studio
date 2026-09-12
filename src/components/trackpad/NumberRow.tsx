/**
 * One integer trackpad setting as a labelled number box.
 *
 * Shared by the scale and filter sections; the only thing they differ in is
 * which keys they read.
 */
import { useRef } from "react";
import { RetainedInput } from "../macroCombo/RetainedInput";
import { InfoTip } from "../InfoTip";
import type { TrackpadNumber } from "../../lib/trackpad/settings";

export function NumberRow({
  label,
  info,
  field,
  step = 10,
  disabled,
  onCommit,
}: {
  label: string;
  info: string;
  field: TrackpadNumber;
  step?: number;
  disabled?: boolean;
  onCommit: (typed: string) => void;
}) {
  /*
   * What is in the box right now, kept outside React state on purpose: the
   * displayed value belongs to RetainedInput (which reconciles it against the
   * device between edits), and this is only needed to know what to commit when
   * the field is left.
   */
  const typed = useRef(String(field.value));

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </span>
      <RetainedInput
        type="number"
        className="input-field w-24 text-sm"
        value={String(field.value)}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        step={step}
        disabled={disabled}
        aria-label={label}
        onChange={(next) => {
          typed.current = next;
        }}
        /*
         * Committed on blur and on Enter rather than on every keystroke. Each
         * commit is an I2C write to both halves; typing "2860" one digit at a
         * time would push 2, 28, 286 and 2860 in turn, and the pad would lurch
         * through three wrong scales on the way to the right one.
         */
        onBlur={() => onCommit(typed.current)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
