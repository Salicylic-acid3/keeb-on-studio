/**
 * The pointer: how fast it moves along each axis of the pad, how its reports
 * are paced, and the one switch of the ripple correction.
 *
 * This card once carried the whole tuning bench -- the pad's scale, the
 * ripple period search with its per-half findings, the distance smoother, the
 * map's learned counts. That was right while the ripple was being chased and
 * wrong once it was caught (a touch threshold, in the end): a screen of
 * fields nobody should touch invites touching them. The firmware still keeps
 * every one of those settings, and the generic settings page still lists
 * them; this card shows what a person using the keyboard has a reason to
 * change.
 *
 * Nothing is drawn for a keyboard that does not publish these: older firmware,
 * or a build without CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS.
 */
import { useLanguage } from "../../hooks/useLanguage";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import { NumberRow } from "./NumberRow";
import { ToggleRow } from "./ToggleRow";
import {
  CURSOR_REPORT_INTERVAL_KEY,
  CURSOR_GAIN_X_KEY,
  CURSOR_GAIN_Y_KEY,
  CURSOR_SMOOTHING_KEY,
  RIPPLE_MAP_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  readTrackpadNumberPerSide,
  readTrackpadToggle,
  sidesDisagree,
  type TrackpadNumber,
} from "../../lib/trackpad/settings";

export function ScaleSettings({
  settings,
  rows,
}: {
  settings: TrackpadSettingsAccess;
  rows: readonly Setting[];
}) {
  const { t } = useLanguage();

  const gainX = readTrackpadNumber(rows, CURSOR_GAIN_X_KEY);
  const gainY = readTrackpadNumber(rows, CURSOR_GAIN_Y_KEY);
  const smoothing = readTrackpadNumber(rows, CURSOR_SMOOTHING_KEY);
  const rippleMap = readTrackpadToggle(rows, RIPPLE_MAP_KEY);
  // One box per half: the interval paces a Bluetooth link that only the
  // peripheral's pointer crosses, so the halves are meant to differ here.
  const reportIntervals = readTrackpadNumberPerSide(
    rows,
    CURSOR_REPORT_INTERVAL_KEY,
  );

  const commit = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(settings, field, draft, { min: 1, max: 4095 });
  const setToggle = async (
    toggle: NonNullable<typeof rippleMap>,
    checked: boolean,
  ) => {
    await settings.writeSettingToMemory(
      toggle.setting,
      { boolValue: checked },
      { allSources: true },
    );
    await settings.saveSection(toggle.setting.customSubsystemIndex);
  };

  // The shared loading indicator lives in TrackpadSettings.
  if (!gainX && !gainY && !smoothing && reportIntervals.length === 0)
    return null;

  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("Pointer speed, per axis")}
      </h3>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "In tenths: 10 leaves an axis alone, 16 makes it 1.6x. Raise one and lower the other to shift the balance without changing the overall speed.",
        )}
      </p>

      {gainX && (
        <NumberRow
          label={t("Up and down (×{{factor}})", {
            factor: (gainX.value / 10).toFixed(1),
          })}
          info={t(
            "The long side of the pad. It usually wants more than the ratio of the sides suggests, because you cannot sweep the full length in one stroke the way you can across — so matching millimetres still feels reluctant.",
          )}
          field={gainX}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(gainX, typed)}
        />
      )}

      {gainY && (
        <NumberRow
          label={t("Left and right (×{{factor}})", {
            factor: (gainY.value / 10).toFixed(1),
          })}
          info={t(
            "The short side of the pad. Lower this instead of raising the other axis if the pointer is already fast enough overall.",
          )}
          field={gainY}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(gainY, typed)}
        />
      )}

      {smoothing && (
        <NumberRow
          label={t("Smoothing ({{n}} reports)", { n: smoothing.value })}
          info={t(
            "Spreads each movement across this many reports instead of emitting it at once. 1 is off. Needed once an axis is amplified: the pad reports whole counts, so a slow drag arrives as 1, 0, 1, 0, and multiplying that leaves the gaps in place and makes the steps bigger. Draining a fraction per report fills the gaps. Costs exactly this many reports of lag and no more.",
          )}
          field={smoothing}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(smoothing, typed)}
        />
      )}

      {reportIntervals.map((field, index) => (
        <NumberRow
          key={field.setting.source}
          label={
            index === 0
              ? t("Report at most every {{n}} ms — plugged-in half", {
                  n: field.value,
                })
              : reportIntervals.length > 2
                ? t("Report at most every {{n}} ms — wireless half {{i}}", {
                    n: field.value,
                    i: index,
                  })
                : t("Report at most every {{n}} ms — wireless half", {
                    n: field.value,
                  })
          }
          info={
            index === 0
              ? t(
                  "This half is on the computer's cable, so there is no link to pace: 0 reports every sensor frame, 200 a second, and anything above it only makes the pointer coarser and later. This box changes this half only.",
                )
              : t(
                  "This half's pointer crosses the Bluetooth link between the halves. The sensor reports 200 times a second and each report is two notifications, more than the link carries; the rest queue, and a queue is lag — on the pointer, and on this half's key presses, which wait behind it. Movement between reports is added up, so nothing is lost. 8 matches the link's 7.5 ms cadence; lower is finer but risks the queue, higher is coarser. This box changes this half only.",
                )
          }
          field={field}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) =>
            void commitTrackpadNumber(
              settings,
              field,
              typed,
              { min: 0, max: 100 },
              1,
              false,
            )
          }
        />
      ))}

      {rippleMap && (
        <ToggleRow
          label={t("Correct the ripple with a map of the pad")}
          info={t(
            "The pointer can slow and hurry in a pattern fixed to the pad — the sensor's reported position is a gentle wave against the true one. With this on, the keyboard learns a table of positions along each axis from ordinary strokes and divides the wave out of every report. Leave it on; turn it off only to compare.",
          )}
          checked={rippleMap.enabled}
          disagree={sidesDisagree(rippleMap)}
          disabled={settings.isLoading}
          onCheckedChange={(checked) => void setToggle(rippleMap, checked)}
        />
      )}
    </div>
  );
}
