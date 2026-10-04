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
import { useLanguage } from "../../hooks/useLanguage";
import {
  sidesDisagree,
  type TrackpadNumber,
} from "../../lib/trackpad/settings";

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
  const { t } = useLanguage();
  const decimals = scale > 1 ? Math.ceil(Math.log10(scale)) : 0;
  const shown = (stored: number) => (stored / scale).toFixed(decimals);
  /*
   * The box shows the central's copy. When the other half holds something
   * else — a write that reached one side and not the other — the box alone
   * would hide it, and a keyboard configured two ways is exactly the fault
   * these rows exist to prevent. Say so, and let a commit of any value (the
   * shown one included) write both back into agreement.
   */
  const disagree = sidesDisagree(field);
  /*
   * What is in the box right now, kept outside React state on purpose: the
   * displayed value belongs to RetainedInput (which reconciles it against the
   * device between edits), and this is only needed to know what to commit when
   * the field is left.
   */
  const typed = useRef(shown(field.value));

  /*
   * A tile: the label on one line, the box under it, the two boxed together.
   * In a row with the label at the left edge and the box at the right, the
   * eye had to travel the width of the card to pair them, and a page of such
   * rows read as two unrelated columns. Tiles sit two to a line (the grid is
   * the parent's), so each pair is close and bordered.
   */
  return (
    <div className="setting-tile">
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        <span className="min-w-0">{label}</span>
        <InfoTip text={info} />
      </span>
      <RetainedInput
        type="number"
        className="input-field w-24 px-3 py-1 text-center text-sm"
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
      {disagree && (
        <span className="text-xs text-[var(--color-warning)]">
          {t(
            "The halves differ: {{values}}. Press Enter in the box to write both.",
            {
              values: field.copies.map(shown).join(" / "),
            },
          )}
        </span>
      )}
    </div>
  );
}
