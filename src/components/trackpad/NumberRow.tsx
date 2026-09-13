/**
 * One integer trackpad setting as a labelled number box.
 *
 * Shared by the scale and filter sections; the only thing they differ in is
 * which keys they read. A setting the firmware stores scaled (tenths of a
 * count, say) passes `scale`, and the box shows and takes the human unit —
 * the value, range and step are all divided by it on the way in; the caller
 * multiplies back on commit.
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
  scale = 1,
  disabled,
  onCommit,
}: {
  label: string;
  info: string;
  field: TrackpadNumber;
  step?: number;
  scale?: number;
  disabled?: boolean;
  onCommit: (typed: string) => void;
}) {
  const decimals = scale > 1 ? Math.ceil(Math.log10(scale)) : 0;
  const shown = (stored: number) => (stored / scale).toFixed(decimals);
  /*
   * What is in the box right now, kept outside React state on purpose: the
   * displayed value belongs to RetainedInput (which reconciles it against the
   * device between edits), and this is only needed to know what to commit when
   * the field is left.
   */
  const typed = useRef(shown(field.value));

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </span>
      <RetainedInput
        type="number"
        className="input-field w-24 text-sm"
        value={shown(field.value)}
        min={field.min === null ? undefined : field.min / scale}
        max={field.max === null ? undefined : field.max / scale}
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
