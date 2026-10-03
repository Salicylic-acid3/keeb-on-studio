/**
 * The single-finger tap: whether it clicks, and how strict it is.
 *
 * A trackpad set into a keyboard is also where the hand rests between keys,
 * and every brush of it that fits the tap window is a click somewhere on the
 * screen. The window and the switch were build-time until zmk-driver-iqs9151
 * 838755fe; a keyboard that does not publish them draws nothing here.
 *
 * Outside the advanced section on purpose: turning the tap off, or making it
 * stricter, is a daily-use decision, not tuning. Writes go to every split side,
 * like the other gesture switches, because each half classifies its own pad.
 */
import { ToggleRow } from "./ToggleRow";
import { NumberRow } from "./NumberRow";
import { useLanguage } from "../../hooks/useLanguage";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import {
  TAP1_ENABLE_KEY,
  TAP1_MAX_MS_KEY,
  TAP1_MOVE_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  readTrackpadToggle,
  sidesDisagree,
} from "../../lib/trackpad/settings";

export function TapSettings({
  settings,
  rows,
}: {
  settings: TrackpadSettingsAccess;
  rows: readonly Setting[];
}) {
  const { t } = useLanguage();
  const enabled = readTrackpadToggle(rows, TAP1_ENABLE_KEY);
  const maxMs = readTrackpadNumber(rows, TAP1_MAX_MS_KEY);
  const move = readTrackpadNumber(rows, TAP1_MOVE_KEY);

  if (!enabled && !maxMs && !move) return null;

  const setEnabled = async (checked: boolean) => {
    if (!enabled) return;
    await settings.writeSettingToMemory(
      enabled.setting,
      { boolValue: checked },
      { allSources: true },
    );
    await settings.saveSection(enabled.setting.customSubsystemIndex);
  };

  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("Tap to click")}
      </h3>

      {enabled && (
        <ToggleRow
          label={t("A quick touch with one finger clicks")}
          info={t(
            "Off: tapping the pad does nothing; clicks come from the switches only. Turn it off if the pad gets brushed while typing and clicks where you did not mean to.",
          )}
          checked={enabled.enabled}
          disagree={sidesDisagree(enabled)}
          disabled={settings.isLoading}
          onCheckedChange={(checked) => void setEnabled(checked)}
        />
      )}

      {maxMs && (
        <NumberRow
          label={t("Longest touch that is a tap ({{n}} ms)", {
            n: maxMs.value,
          })}
          info={t(
            "A finger held down longer than this is not a tap. Lower it if the pad clicks when you only meant to rest a finger on it; 250 is the default, 120 to 150 is strict.",
          )}
          field={maxMs}
          step={10}
          disabled={settings.isLoading || enabled?.enabled === false}
          onCommit={(typed) =>
            void commitTrackpadNumber(settings, maxMs, typed, {
              min: 1,
              max: 1000,
            })
          }
        />
      )}

      {move && (
        <NumberRow
          label={t("Farthest a tap may move ({{n}} counts)", { n: move.value })}
          info={t(
            "A finger that moves further than this while down is a stroke, not a tap (about 23 counts to the millimetre). Lower it if brushing the pad clicks; 50 is the default, 20 to 30 is strict.",
          )}
          field={move}
          step={5}
          disabled={settings.isLoading || enabled?.enabled === false}
          onCommit={(typed) =>
            void commitTrackpadNumber(settings, move, typed, {
              min: 1,
              max: 1000,
            })
          }
        />
      )}
    </div>
  );
}
