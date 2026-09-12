/**
 * The sensor's own low-speed filter, as six numbers.
 *
 * Everything else on this page acts on what the sensor has already reported.
 * This is what it does before reporting: below a speed threshold a position
 * filter holds the finger where it was, and below a movement threshold the
 * report is dropped altogether. On a pad whose long axis has fewer electrodes
 * per millimetre that is where "the pointer stops on each electrode, then
 * jumps" comes from, and no amount of smoothing afterwards can put back a
 * report the sensor never sent.
 *
 * The values are the sensor's raw register contents and the sensor's manual is
 * the only real documentation. The info tips say which direction to turn each
 * one; the keyboard keeps whatever is chosen, and the compiled-in default is
 * always one reset away.
 *
 * Nothing is drawn for a keyboard that does not publish these.
 */
import { useLanguage } from "../../hooks/useLanguage";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import { NumberRow } from "./NumberRow";
import {
  FILTER_BOTTOM_BETA_KEY,
  FILTER_BOTTOM_SPEED_KEY,
  FILTER_STATIC_BETA_KEY,
  FILTER_TOP_SPEED_KEY,
  JITTER_DELTA_KEY,
  STATIONARY_THRESHOLD_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  type TrackpadNumber,
} from "../../lib/trackpad/settings";

export function FilterSettings({
  settings,
  rows,
}: {
  settings: TrackpadSettingsAccess;
  rows: readonly Setting[];
}) {
  const { t } = useLanguage();

  const stationary = readTrackpadNumber(rows, STATIONARY_THRESHOLD_KEY);
  const jitter = readTrackpadNumber(rows, JITTER_DELTA_KEY);
  const bottomSpeed = readTrackpadNumber(rows, FILTER_BOTTOM_SPEED_KEY);
  const topSpeed = readTrackpadNumber(rows, FILTER_TOP_SPEED_KEY);
  const bottomBeta = readTrackpadNumber(rows, FILTER_BOTTOM_BETA_KEY);
  const staticBeta = readTrackpadNumber(rows, FILTER_STATIC_BETA_KEY);

  const fields = [
    stationary,
    jitter,
    bottomSpeed,
    topSpeed,
    bottomBeta,
    staticBeta,
  ];
  if (fields.every((field) => field === null)) return null;

  const commit = (field: TrackpadNumber, draft: string) =>
    commitTrackpadNumber(settings, field, draft, { min: 0, max: 255 });

  // Ordered by how likely each is to be the knob that helps, not by register
  // address: the two thresholds first, the filter strengths after.
  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("Sensor filter (advanced)")}
      </h3>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "What the sensor does before it reports anything. If one axis stops and jumps while the other glides, the fix is here, not in smoothing: a report the sensor suppressed cannot be smoothed. Change one value at a time and try a slow drag after each.",
        )}
      </p>

      {stationary && (
        <NumberRow
          label={t("Stationary threshold")}
          info={t(
            "Movement per report below this is treated as a finger holding still and not reported at all. The first thing to lower when slow movement on one axis comes out as stops and jumps; 0 reports everything.",
          )}
          field={stationary}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(stationary, typed)}
        />
      )}

      {jitter && (
        <NumberRow
          label={t("Jitter filter delta")}
          info={t(
            "Movement smaller than this is treated as noise. Lower it to let small movements through; raise it if the pointer wanders while the finger holds still.",
          )}
          field={jitter}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(jitter, typed)}
        />
      )}

      {bottomSpeed && (
        <NumberRow
          label={t("Filter bottom speed")}
          info={t(
            "Below this speed the position filter is at its strongest. Lowering it lets slow movement through with less filtering.",
          )}
          field={bottomSpeed}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(bottomSpeed, typed)}
        />
      )}

      {topSpeed && (
        <NumberRow
          label={t("Filter top speed")}
          info={t(
            "Above this speed the position filter is off. Between the two speeds it fades from the bottom strength to none.",
          )}
          field={topSpeed}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(topSpeed, typed)}
        />
      )}

      {bottomBeta && (
        <NumberRow
          label={t("Filter strength at low speed")}
          info={t(
            "How hard the position filter holds the finger where it was when moving slowly. Try both directions: less means smaller, more frequent steps; more means the finger is held longer and then released in a bigger step.",
          )}
          field={bottomBeta}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(bottomBeta, typed)}
        />
      )}

      {staticBeta && (
        <NumberRow
          label={t("Filter strength when still")}
          info={t(
            "The filter applied to a finger the sensor has decided is holding still. Lower it if the pointer lags behind when a stationary finger starts to move again.",
          )}
          field={staticBeta}
          step={1}
          disabled={settings.isLoading}
          onCommit={(typed) => void commit(staticBeta, typed)}
        />
      )}
    </div>
  );
}
