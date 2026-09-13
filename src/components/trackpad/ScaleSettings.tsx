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
import { useLanguage } from "../../hooks/useLanguage";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import { NumberRow } from "./NumberRow";
import { ToggleRow } from "./ToggleRow";
import {
  CURSOR_DISTANCE_SMOOTHING_KEY,
  CURSOR_REPORT_INTERVAL_KEY,
  CURSOR_GAIN_X_KEY,
  CURSOR_GAIN_Y_KEY,
  CURSOR_SMOOTHING_KEY,
  RESOLUTION_X_KEY,
  RESOLUTION_Y_KEY,
  RIPPLE_AUTO_KEY,
  RIPPLE_PERIOD_SCALE,
  RIPPLE_PERIOD_X_KEY,
  RIPPLE_PERIOD_Y_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  readTrackpadToggle,
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

  const x = readTrackpadNumber(rows, RESOLUTION_X_KEY);
  const y = readTrackpadNumber(rows, RESOLUTION_Y_KEY);
  const gainX = readTrackpadNumber(rows, CURSOR_GAIN_X_KEY);
  const gainY = readTrackpadNumber(rows, CURSOR_GAIN_Y_KEY);
  const smoothing = readTrackpadNumber(rows, CURSOR_SMOOTHING_KEY);
  const distance = readTrackpadNumber(rows, CURSOR_DISTANCE_SMOOTHING_KEY);
  const rippleX = readTrackpadNumber(rows, RIPPLE_PERIOD_X_KEY);
  const rippleY = readTrackpadNumber(rows, RIPPLE_PERIOD_Y_KEY);
  const rippleAuto = readTrackpadToggle(rows, RIPPLE_AUTO_KEY);
  const reportInterval = readTrackpadNumber(rows, CURSOR_REPORT_INTERVAL_KEY);

  const commit = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(settings, field, draft, { min: 1, max: 4095 });
  const commitPeriod = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(
      settings,
      field,
      draft,
      { min: 0, max: 1600 },
      RIPPLE_PERIOD_SCALE,
    );
  const period = (field: TrackpadNumber) =>
    (field.value / RIPPLE_PERIOD_SCALE).toFixed(1);
  const setAuto = async (checked: boolean) => {
    if (!rippleAuto) return;
    await settings.writeSettingToMemory(
      rippleAuto.setting,
      { boolValue: checked },
      { allSources: true },
    );
    await settings.saveSection(rippleAuto.setting.customSubsystemIndex);
  };

  // The shared loading indicator lives in TrackpadSettings.
  if (
    !x &&
    !y &&
    !gainX &&
    !gainY &&
    !smoothing &&
    !distance &&
    !rippleX &&
    !rippleY &&
    !reportInterval
  )
    return null;

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
          "Counts spread across each side of the pad, which is what the firmware compares when it decides which axis a gesture is on. Only the ratio matters: it should match the ratio of the pad's sides, or scrolls, swipes and pinches all lean toward one of them. This does not change pointer speed — that is below.",
        )}
      </p>

      {x && (
        <NumberRow
          label={t("Along the pad (screen vertical)")}
          info={t(
            "The sensor's X axis, which the listener swaps onto the screen's vertical. Set it in proportion to the pad's long side.",
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
            "The sensor's Y axis, which the listener swaps onto the screen's horizontal. Set it in proportion to the pad's short side.",
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

      {(gainX ||
        gainY ||
        smoothing ||
        distance ||
        rippleX ||
        rippleY ||
        reportInterval) && (
        <>
          <div className="border-t border-[var(--color-border)] pt-3">
            <h4 className="text-sm font-medium text-[var(--color-text)]">
              {t("Pointer speed, per axis")}
            </h4>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t(
                "In tenths: 10 leaves an axis alone, 16 makes it 1.6x. This is the pointer, not the gesture detection — the pad scale above does not change cursor speed on this sensor. Raise one and lower the other to shift the balance without changing the overall speed.",
              )}
            </p>
          </div>

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

          {reportInterval && (
            <NumberRow
              label={t("Report at most every {{n}} ms", {
                n: reportInterval.value,
              })}
              info={t(
                "For the half whose pointer crosses the Bluetooth link between the halves. The sensor reports 200 times a second and each report is two notifications, more than the link carries; the rest queue, and a queue is lag — on the pointer, and on that half's key presses, which wait behind it. Movement between reports is added up, so nothing is lost. 15 matches the link; 0 reports every frame, which is right for the half plugged into the computer. Both halves take the same value here, so it is set in the firmware per half and this is for trying.",
              )}
              field={reportInterval}
              step={1}
              disabled={settings.isLoading}
              onCommit={(typed) =>
                void commitTrackpadNumber(settings, reportInterval, typed, {
                  min: 0,
                  max: 100,
                })
              }
            />
          )}

          {rippleAuto && (
            <ToggleRow
              label={t("Find the ripple period by itself")}
              info={t(
                "The keyboard tries a bank of periods and adopts the one whose wave comes out largest — every pad has its own value, to a tenth, and a pad may have no wave at all. Until something is found nothing is corrected, because a correction at the wrong period is a wave of its own; found values are remembered across power cycles and searched again if the pad scale changes. Takes ten or twenty seconds of ordinary strokes on each pad. While this is on, the periods below are ignored. Turn it off to use them by hand.",
              )}
              checked={rippleAuto.enabled}
              disabled={settings.isLoading}
              onCheckedChange={(checked) => void setAuto(checked)}
            />
          )}

          {rippleX && (
            <NumberRow
              label={t("Ripple correction, up and down ({{n}} counts)", {
                n: period(rippleX),
              })}
              info={t(
                "Divides the sensor's positional wave out of every report with no lag — the keyboard learns the wave's shape by itself from the first stroke and keeps it. The wave's period in sensor counts, to a tenth, used only while the search above is off. Geometry says resolution ÷ (2 × electrodes along this axis), 76.0 here (1974 ÷ 26), but the equaliser needs it to within a percent — one count off leaves a third of the wave — and of the two pads measured so far one wanted 75.5 and the other had no wave at all. If no convincing wave is learned at this period, nothing is corrected. Set by hand only with the search off: scan half a count at a time with the waveform tool open. 0 turns it off.",
              )}
              field={rippleX}
              step={0.5}
              scale={RIPPLE_PERIOD_SCALE}
              disabled={settings.isLoading}
              onCommit={(typed) => void commitPeriod(rippleX, typed)}
            />
          )}

          {rippleY && (
            <NumberRow
              label={t("Ripple correction, left and right ({{n}} counts)", {
                n: period(rippleY),
              })}
              info={t(
                "The same correction for the short axis. Leave it at 0 unless the waveform tool finds a period there too; on this pad it does not.",
              )}
              field={rippleY}
              step={0.5}
              scale={RIPPLE_PERIOD_SCALE}
              disabled={settings.isLoading}
              onCommit={(typed) => void commitPeriod(rippleY, typed)}
            />
          )}

          {distance && (
            <NumberRow
              label={t("Ripple smoothing ({{n}} counts)", {
                n: distance.value,
              })}
              info={t(
                "The fallback to the ripple correction above, for when the period cannot be pinned down: averages the pointer over this many counts of finger travel instead, which cancels the wave but costs half the window in lag. 0 is off. For a fault the report smoothing cannot reach: the sensor's reported position is a gentle wave against the true one, and on the long axis it repeats every couple of millimetres and swings the speed more than two to one. Being fixed in distance, it is crossed faster when you move faster, so a report-counted smoother slides off it. Set it to about one ripple period — near 45 for a 2 mm ripple at ~23 counts/mm; measure the period with the counting tool first. The lag is half the window, paid in following distance rather than time.",
              )}
              field={distance}
              step={1}
              disabled={settings.isLoading}
              onCommit={(typed) => void commit(distance, typed)}
            />
          )}
        </>
      )}
    </div>
  );
}
