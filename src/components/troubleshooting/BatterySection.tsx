/**
 * Each half's battery, on the page people open when something is wrong.
 *
 * It is here rather than in a status bar deliberately. A battery percentage
 * is not something to watch while typing; it is something to check when the
 * keyboard is dropping keys or a trackpad has gone quiet, and this is the
 * page for that. A capacitive trackpad draws far more than a key matrix, so
 * on a cell that is on its way out the pointer dies first and the keys keep
 * working — which reads as a firmware fault right up until you see the
 * number.
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
  readBatteryLevels,
  type BatteryLevel,
} from "../../lib/battery/levels";

/** Below this a cell is close enough to done to say so. */
const LOW_PERCENT = 20;

export interface BatterySectionProps {
  /** The keyboard's reported name, used to say which half is which. */
  deviceName?: string | null;
}

function barColor(percent: number) {
  if (percent <= LOW_PERCENT) return "var(--color-warning)";
  return "var(--color-electric)";
}

function LevelRow({ level }: { level: BatteryLevel }) {
  const { t } = useLanguage();
  const percent = Math.max(0, Math.min(100, level.percent));

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-[var(--color-text-secondary)]">
        {level.label ? t(level.label) : level.key}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${percent}%`, background: barColor(percent) }}
        />
      </div>
      <span className="w-12 text-right text-sm tabular-nums text-[var(--color-text)]">
        {percent}%
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
  const levels = useMemo(
    () => readBatteryLevels(section?.settings ?? [], deviceName),
    [section, deviceName],
  );

  if (!settings.isAvailable) {
    return null;
  }

  // The lowest reading, shown in the header. This section starts open and a
  // battery is a glance rather than a report, but the badge is what carries
  // the number once someone collapses it.
  const lowest = levels.reduce<number | null>(
    (min, level) =>
      min === null ? level.percent : Math.min(min, level.percent),
    null,
  );

  return (
    <SectionCard
      icon={<IconBattery2 size={20} />}
      title={t("Battery")}
      subtitle={t("How much charge each half has left")}
      defaultOpen
      summary={
        lowest !== null && (
          <SectionSummaryBadge tone={lowest <= LOW_PERCENT ? "amber" : "ok"}>
            {`${lowest}%`}
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

      {levels.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {settings.isLoading
            ? t("Loading…")
            : t("This keyboard does not report its battery level.")}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {levels.map((level) => (
              <LevelRow key={level.key} level={level} />
            ))}
          </div>
          {/* Said once, plainly, because a fresh connection shows 0% and that
              is the single most confusing thing about this panel. */}
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            {t(
              "The keyboard measures this about once a minute, so 0% just after connecting means it has not measured yet.",
            )}
          </p>
          {levels.some((level) => level.percent <= LOW_PERCENT) && (
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
