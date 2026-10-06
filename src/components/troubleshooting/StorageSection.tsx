/**
 * How full the keyboard's settings storage is.
 *
 * This card exists because of one failure that has no other symptom: when
 * the settings partition is full, every new save is refused, and a setting
 * changed in the app takes effect until the next reboot and then comes back
 * as it was. There is no error -- the firmware logs one, and nobody reads
 * firmware logs -- so the keyboard looks like it has forgotten how to save.
 * A bar that goes red before that point is the whole purpose here.
 *
 * Shown only when the firmware publishes the two numbers (custom-settings
 * 61f2b6a and later); older firmware gets no card rather than a shrug.
 */
import { useMemo } from "react";
import { IconDatabase, IconRefresh } from "@tabler/icons-react";
import { SectionCard, SectionSummaryBadge } from "./SectionCard";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import {
  STORAGE_SUBSYSTEM_ID,
  formatKb,
  readStorageUsage,
} from "../../lib/storage/usage";

export function StorageSection() {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: STORAGE_SUBSYSTEM_ID,
  });

  const section = settings.sections[0] ?? null;
  const usage = useMemo(
    () => readStorageUsage(section?.settings ?? []),
    [section],
  );

  if (!settings.isAvailable || usage === null) {
    return null;
  }

  return (
    <SectionCard
      icon={<IconDatabase size={20} />}
      title={t("Settings storage")}
      subtitle={t("How much of the space for saved settings is used")}
      defaultOpen={usage.low}
      summary={
        <SectionSummaryBadge tone={usage.low ? "red" : "ok"}>
          {`${usage.usedPercent}%`}
        </SectionSummaryBadge>
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
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${usage.usedPercent}%`,
              background: usage.low
                ? "var(--color-warning)"
                : "var(--color-electric)",
            }}
          />
        </div>
        <span className="text-sm tabular-nums text-[var(--color-text)]">
          {t("{{used}} of {{total}} used", {
            used: formatKb(usage.usedBytes),
            total: formatKb(usage.totalBytes),
          })}
        </span>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {t(
          "Everything the keyboard remembers lives here: the keymap, Bluetooth pairings, every setting in this app, macros, combos and tap dances. The free figure is the storage's own estimate, which keeps some space aside for housekeeping.",
        )}
      </p>
      {usage.low && (
        <p className="mt-2 text-xs text-[var(--color-warning)]">
          {t(
            "Nearly full: new changes will stop being saved and will come back as they were after the next restart. Remove unused macros, combos or tap dances, or update to firmware with a larger settings area.",
          )}
        </p>
      )}
    </SectionCard>
  );
}
