/**
 * The pad's coordinate scale, as two numbers.
 *
 * The sensor spreads a fixed number of counts across each axis of the pad, so
 * counts per millimetre is that number divided by the length of that side — and
 * the two have to be set in proportion to the pad's two sides or the long one
 * comes out slower. That much is arithmetic. What is not arithmetic is the
 * length of the sides: a board drawing gives you the copper outline, not the
 * electrode array, and the difference between them is easily a factor of two.
 *
 * Getting it wrong does not present as "the resolution is wrong". It presents as
 * the pointer being reluctant in one direction — and, less obviously, as every
 * gesture leaning the other way, because the firmware decides which axis a
 * scroll is on, which way a swipe went and whether fingers spread faster than
 * they travelled by comparing counts, not millimetres.
 *
 * So this is a knob rather than a build switch. Finding the right pair by
 * rebuilding, reflashing and re-forming an opinion takes ten minutes a step.
 * Finding it here takes five seconds, and the keyboard keeps the answer.
 *
 * Nothing is drawn for a keyboard that does not publish these: older firmware,
 * or a build without CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS.
 */
import { IconLoader2 } from "@tabler/icons-react";
import { useMemo, useRef } from "react";
import { RetainedInput } from "../macroCombo/RetainedInput";
import { InfoTip } from "../InfoTip";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import {
  RESOLUTION_X_KEY,
  RESOLUTION_Y_KEY,
  TRACKPAD_SUBSYSTEM_ID,
  readTrackpadNumber,
  type TrackpadNumber,
} from "../../lib/trackpad/settings";

function NumberRow({
  label,
  info,
  field,
  disabled,
  onCommit,
}: {
  label: string;
  info: string;
  field: TrackpadNumber;
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
        step={10}
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

export function ScaleSettings() {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: TRACKPAD_SUBSYSTEM_ID,
  });

  const rows = useMemo(
    () => settings.sections.flatMap((section) => section.settings),
    [settings.sections],
  );
  const x = readTrackpadNumber(rows, RESOLUTION_X_KEY);
  const y = readTrackpadNumber(rows, RESOLUTION_Y_KEY);

  const commit = async (field: TrackpadNumber, draft: string) => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed === field.value) return;

    const min = field.min ?? 1;
    const max = field.max ?? 4095;
    const clamped = Math.min(max, Math.max(min, parsed));

    await settings.writeSettingToMemory(
      field.setting,
      { int32Value: clamped },
      { allSources: true },
    );
    await settings.saveSection(field.setting.customSubsystemIndex);
  };

  if (!x && !y) {
    return settings.isLoading ? (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <IconLoader2 size={14} className="animate-spin" />
        {t("Loading...")}
      </div>
    ) : null;
  }

  // The ratio is the number that actually matters, so it is shown rather than
  // left to be worked out from the two fields.
  const ratio = x && y && y.value > 0 ? x.value / y.value : null;

  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("Pad scale")}
      </h3>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Counts spread across each side of the pad. Only the ratio matters: it has to match the ratio of the pad's sides. Set it wrong and the pointer drags in one direction while scrolls, swipes and pinches all lean the other way.",
        )}
      </p>

      {x && (
        <NumberRow
          label={t("Along the pad (screen vertical)")}
          info={t(
            "The sensor's X axis, which the listener swaps onto the screen's vertical. Raise it to make upward and downward movement travel further for the same finger distance.",
          )}
          field={x}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(x, typed)}
        />
      )}

      {y && (
        <NumberRow
          label={t("Across the pad (screen horizontal)")}
          info={t(
            "The sensor's Y axis, which the listener swaps onto the screen's horizontal. Lower it to slow sideways movement instead of speeding the other axis up, which keeps the overall pointer speed where you had it.",
          )}
          field={y}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(y, typed)}
        />
      )}

      {ratio !== null && (
        <p className="font-mono text-xs text-[var(--color-text-muted)]">
          {t("Ratio {{ratio}} — aim for the ratio of the pad's own sides", {
            ratio: ratio.toFixed(2),
          })}
        </p>
      )}
    </div>
  );
}
