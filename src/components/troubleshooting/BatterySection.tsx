/**
 * Each half's battery, on the page people open when something is wrong.
 *
 * It is here rather than in a status bar deliberately. A battery reading is
 * not something to watch while typing; it is something to check when the
 * keyboard is dropping keys or a trackpad has gone quiet, and this is the
 * page for that. A capacitive trackpad draws far more than a key matrix, so
 * on a cell that is on its way out the pointer dies first and the keys keep
 * working — which reads as a firmware fault right up until you see the
 * number.
 *
 * The number is a voltage, not a percentage, wherever the keyboard gives us
 * one. These keyboards run on primary cells — CR2032, AAA — and a primary
 * cell does not run down the way a LiPo gauge does: it sits near its nominal
 * voltage for most of its life and then falls off, and the keyboard stops
 * working at a voltage, not at a percentage. ErgoTrack's owner watched his
 * stop at 2.7 V. A bar that said 70% there would have been the firmware's
 * linear clamp between two configured voltages, and would have said nothing
 * about how close the end was. So the voltage is the reading, the keyboard's
 * own guide says where empty is, and the bar is drawn against that guide.
 *
 * A split peripheral only sends its percentage across the link, so for it
 * the voltage is read back out of the firmware's clamp — exact to 10 mV
 * except at 100%, which is shown as a floor.
 *
 * Read-only by construction: there is no Save or Discard here, because the
 * firmware writes these in temporary mode and there is nothing to persist.
 */
import { useMemo } from "react";
import { IconBattery2, IconRefresh } from "@tabler/icons-react";
import { SectionCard, SectionSummaryBadge } from "./SectionCard";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import {
  BATTERY_SUBSYSTEM_ID,
  batteryGuideFor,
  centralIsOnUsb,
  firmwareCutoffMv,
  millivoltsFromPercent,
  readBatteryLevels,
  voltagePercent,
  type BatteryGuide,
  type BatteryLevel,
} from "../../lib/battery/levels";

/** Below this a percentage-only reading is close enough to done to say so. */
const LOW_PERCENT = 20;
/** Within this of the voltage the keyboard dies at, it is said to be low. */
const LOW_MARGIN_MV = 100;

export interface BatterySectionProps {
  /** The keyboard's reported name, used to say which half is which. */
  deviceName?: string | null;
}

/** One half's reading, resolved into what the row and the badge show. */
interface Reading {
  level: BatteryLevel;
  /** The text in the right-hand column: "2.95 V", "≥ 3.00 V", or "74%". */
  text: string;
  /** How full the bar is, 0–100. */
  fill: number;
  low: boolean;
}

function formatVolts(millivolts: number): string {
  return `${(millivolts / 1000).toFixed(2)} V`;
}

function resolve(level: BatteryLevel, guide: BatteryGuide | null): Reading {
  const percent = Math.max(0, Math.min(100, level.percent));

  if (!guide) {
    // A keyboard we have no guide for: the firmware's own number, as it is.
    // A voltage without a scale to read it against is just a number.
    return {
      level,
      text:
        level.millivolts !== null
          ? formatVolts(level.millivolts)
          : `${percent}%`,
      fill: percent,
      low: percent <= LOW_PERCENT,
    };
  }

  let millivolts: number;
  let atLeast = false;
  if (level.millivolts !== null) {
    millivolts = level.millivolts;
  } else {
    ({ millivolts, atLeast } = millivoltsFromPercent(percent, guide));
  }

  return {
    level,
    text: `${atLeast ? "≥ " : ""}${formatVolts(millivolts)}`,
    fill: voltagePercent(millivolts, guide),
    low: !atLeast && millivolts <= guide.deadMv + LOW_MARGIN_MV,
  };
}

function LevelRow({ reading }: { reading: Reading }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-[var(--color-text-secondary)]">
        {reading.level.label ? t(reading.level.label) : reading.level.key}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${reading.fill}%`,
            background: reading.low
              ? "var(--color-warning)"
              : "var(--color-electric)",
          }}
        />
      </div>
      <span className="w-16 text-right text-sm tabular-nums text-[var(--color-text)]">
        {reading.text}
      </span>
    </div>
  );
}

export function BatterySection({ deviceName }: BatterySectionProps) {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: BATTERY_SUBSYSTEM_ID,
  });

  const section = settings.sections[0] ?? null;
  const guide = useMemo(() => batteryGuideFor(deviceName), [deviceName]);
  const readings = useMemo(
    () =>
      readBatteryLevels(section?.settings ?? [], deviceName).map((level) =>
        resolve(level, guide),
      ),
    [section, deviceName, guide],
  );
  const onUsb = useMemo(
    () => centralIsOnUsb(section?.settings ?? []),
    [section],
  );
  const cutoffMv = useMemo(
    () => firmwareCutoffMv(section?.settings ?? []),
    [section],
  );

  if (!settings.isAvailable) {
    return null;
  }

  // The emptiest half, shown in the header. This section starts open and a
  // battery is a glance rather than a report, but the badge is what carries
  // the number once someone collapses it.
  const worst = readings.reduce<Reading | null>(
    (min, reading) => (min === null || reading.fill < min.fill ? reading : min),
    null,
  );
  const anyLow = readings.some((reading) => reading.low);

  // The firmware's own shutdown voltage is worth a line only when it is the
  // limit that will actually be hit. On the keyboards we have a guide for, the
  // keyboard stops working well above it, and saying "switches off at 1.2 V"
  // under "stops working at 2.7 V" would only raise the question of which.
  const showCutoff =
    cutoffMv !== null && (guide === null || cutoffMv >= guide.deadMv);

  return (
    <SectionCard
      icon={<IconBattery2 size={20} />}
      title={t("Battery")}
      subtitle={t("The voltage of each half's cells")}
      defaultOpen
      summary={
        worst !== null && (
          <SectionSummaryBadge tone={anyLow ? "amber" : "ok"}>
            {worst.text}
          </SectionSummaryBadge>
        )
      }
      actions={
        <button
          className="btn-ghost text-sm flex items-center gap-1.5"
          onClick={() => void settings.loadSettings()}
          disabled={settings.isLoading}
        >
          <IconRefresh size={16} />
          {t("Refresh")}
        </button>
      }
    >
      {settings.error && (
        <p className="mb-3 text-sm text-[var(--color-warning)]">
          {settings.error}
        </p>
      )}

      {readings.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {settings.isLoading
            ? t("Loading…")
            : t("This keyboard does not report its battery level.")}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {readings.map((reading) => (
              <LevelRow key={reading.level.key} reading={reading} />
            ))}
          </div>

          {/* What the numbers mean on this keyboard: which cells, what a new
              one reads, and the voltage it has actually stopped at. This is
              the line the voltage is there for. */}
          {guide && (
            <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
              {t(guide.note)}
            </p>
          )}
          {showCutoff && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {t(
                "Below {{volts}} the firmware switches the keyboard off to protect its cells.",
                { volts: formatVolts(cutoffMv) },
              )}
            </p>
          )}

          {/* Said once, plainly, because a fresh connection shows the bottom
              of the scale and that is the single most confusing thing about
              this panel. On USB the half that is plugged in cannot measure its
              cells at all, so the number is the last one it took on battery,
              and that is said too. */}
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {onUsb
              ? t(
                  "The half connected over USB is powered by it and cannot measure its battery now; its reading is the last one it took while running on battery. A reading at the very bottom of the scale means it has never run on battery since the firmware was written.",
                )
              : t(
                  "The keyboard measures this about once a minute, so a reading at the very bottom of the scale just after connecting means it has not measured yet.",
                )}
          </p>
          {anyLow && (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              {t(
                "A cell this low can still run the keys while failing to run a trackpad — the pointer goes first.",
              )}
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}
