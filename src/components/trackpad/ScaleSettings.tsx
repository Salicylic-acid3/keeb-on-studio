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
  TAP_DEAD_ZONE_KEY,
  LIFT_GUARD_KEY,
  TOUCH_CLEAR_THRESHOLD_KEY,
  TOUCH_SET_THRESHOLD_KEY,
  TOUCH_THRESHOLD_HYSTERESIS,
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
  const tapDeadZone = readTrackpadNumber(rows, TAP_DEAD_ZONE_KEY);
  const liftGuard = readTrackpadNumber(rows, LIFT_GUARD_KEY);
  const touchSet = readTrackpadNumber(rows, TOUCH_SET_THRESHOLD_KEY);
  const touchClear = readTrackpadNumber(rows, TOUCH_CLEAR_THRESHOLD_KEY);
  // One box per half: the interval paces a Bluetooth link that only the
  // peripheral's pointer crosses, so the halves are meant to differ here.
  const reportIntervals = readTrackpadNumberPerSide(
    rows,
    CURSOR_REPORT_INTERVAL_KEY,
  );

  const commit = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(settings, field, draft, { min: 1, max: 4095 });
  // One box, two registers: the clear threshold follows the set one a fixed
  // step below, so the hysteresis between them never has to be thought about.
  const commitTouch = async (draft: string) => {
    if (!touchSet || !touchClear) return;
    const typed = Number.parseInt(draft, 10);
    if (!Number.isFinite(typed)) return;
    const set = Math.min(255, Math.max(TOUCH_THRESHOLD_HYSTERESIS + 1, typed));
    const clear = set - TOUCH_THRESHOLD_HYSTERESIS;
    if (set === touchSet.value && clear === touchClear.value) return;
    await settings.writeSettingToMemory(
      touchSet.setting,
      { int32Value: set },
      { allSources: true },
    );
    await settings.writeSettingToMemory(
      touchClear.setting,
      { int32Value: clear },
      { allSources: true },
    );
    await settings.saveSection(touchSet.setting.customSubsystemIndex);
  };
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
          "In tenths: 10 leaves the axis as it is, 16 makes it 1.6×. Raise one and lower the other to change the up/down vs left/right balance without changing the overall speed.",
        )}
      </p>

      {gainX && (
        <NumberRow
          label={t("Up and down (×{{factor}})", {
            factor: (gainX.value / 10).toFixed(1),
          })}
          info={t(
            "The long side of the pad. It usually wants a somewhat higher number than the short side.",
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
            "The short side of the pad. If the pointer is already fast enough overall, lower this rather than raising the other.",
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
            "Smooths slow, careful movement by spreading each move over this many reports. The cost is lag: the pointer trails your finger by about this many reports. 1 is off; 2 is a good balance; 5 and above feel clearly laggy.",
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
              ? t(
                  "Report at most every {{n}} ms — half connected to the computer",
                  {
                    n: field.value,
                  },
                )
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
                  "How often this half sends pointer movement to the computer. 0 sends every sensor frame (200 a second). Over USB leave it at 0. Over Bluetooth some computers cannot take 200 a second, and the pointer falls further behind the longer you keep moving — Windows did this, and 6 fixed it; a Mac was fine at 0. Movement between reports is added up, so nothing is lost; higher only makes the pointer coarser. This box changes this half only.",
                )
              : t(
                  "This half's movement goes to the other half over Bluetooth before it reaches the computer. That link carries fewer reports than the sensor makes, so sending every frame makes the pointer — and this half's keys — lag. 8 matches the link between the halves; lower is finer but risks lag, higher is coarser. Movement between reports is added up, so nothing is lost. This box changes this half only.",
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

      {tapDeadZone && (
        <NumberRow
          label={t("Tap dead zone ({{n}} counts)", { n: tapDeadZone.value })}
          info={t(
            "Stops a tap from nudging the pointer. For a moment after the finger lands, movement within this distance of the landing point is ignored (about 23 counts to a millimetre). Raise it if taps still move the pointer. 20 is the default; 0 turns it off.",
          )}
          field={tapDeadZone}
          step={2}
          disabled={settings.isLoading}
          onCommit={(typed) =>
            void commitTrackpadNumber(settings, tapDeadZone, typed, {
              min: 0,
              max: 200,
            })
          }
        />
      )}

      {liftGuard && (
        <NumberRow
          label={t("Lift guard ({{n}} frames)", { n: liftGuard.value })}
          info={t(
            "Stops the pointer from jumping as the finger leaves the pad, which makes clicks on small targets miss. After the finger has paused, the first few frames of movement are held back and thrown away if the finger lifts right after them; a real stroke goes through unchanged after that. 2 is the default (about 10 ms of the start of a stroke after a pause). Raise it if the pointer still jumps on lift; 0 turns it off.",
          )}
          field={liftGuard}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) =>
            void commitTrackpadNumber(settings, liftGuard, typed, {
              min: 0,
              max: 8,
            })
          }
        />
      )}

      {touchSet && touchClear && (
        <NumberRow
          label={t("Touch threshold ({{n}})", { n: touchSet.value })}
          info={t(
            "How light a touch counts. Lower is more sensitive and movement gets smoother, but too low and a resting palm or a hovering finger registers too. Higher is less sensitive, and too high makes the pointer move in steps. 34 is the starting point here; try steps of 4.",
          )}
          field={touchSet}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commitTouch(typed)}
        />
      )}

      {rippleMap && (
        <ToggleRow
          label={t("Correct the ripple with a map of the pad")}
          info={t(
            "Evens out a pattern where the pointer slows and hurries at fixed spots on the pad. Leave it on; turn it off only to compare.",
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
