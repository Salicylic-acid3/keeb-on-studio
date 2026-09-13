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
import {
  CURSOR_DISTANCE_SMOOTHING_KEY,
  CURSOR_GAIN_X_KEY,
  CURSOR_GAIN_Y_KEY,
  CURSOR_SMOOTHING_KEY,
  RESOLUTION_X_KEY,
  RESOLUTION_Y_KEY,
  RIPPLE_PERIOD_X_KEY,
  RIPPLE_PERIOD_Y_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
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

  const commit = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(settings, field, draft, { min: 1, max: 4095 });

  // The shared loading indicator lives in TrackpadSettings.
  if (
    !x &&
    !y &&
    !gainX &&
    !gainY &&
    !smoothing &&
    !distance &&
    !rippleX &&
    !rippleY
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

      {(gainX || gainY || smoothing || distance || rippleX || rippleY) && (
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

          {rippleX && (
            <NumberRow
              label={t("Ripple correction, up and down ({{n}} counts)", {
                n: rippleX.value,
              })}
              info={t(
                "Divides the sensor's positional wave out of every report with no lag — the keyboard learns the wave's shape by itself from the first stroke and keeps it. Enter the wave's period in sensor counts: resolution ÷ (2 × electrodes along this axis), 76 here (1974 ÷ 26). Measure it with the counting tool; a few percent off halves the effect, so nudge by one and feel. 0 turns it off.",
              )}
              field={rippleX}
              step={1}
              disabled={settings.isLoading}
              onCommit={(typed) => void commit(rippleX, typed)}
            />
          )}

          {rippleY && (
            <NumberRow
              label={t("Ripple correction, left and right ({{n}} counts)", {
                n: rippleY.value,
              })}
              info={t(
                "The same correction for the short axis. Leave it at 0 unless the counting tool finds a period there too; on this pad it does not.",
              )}
              field={rippleY}
              step={1}
              disabled={settings.isLoading}
              onCommit={(typed) => void commit(rippleY, typed)}
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
