/**
 * The one-pad pinch, as two switches.
 *
 * Whether two fingers on one pad should pinch, and which way it should zoom,
 * are the owner's questions and not the board's. On a small pad the pinch is
 * hard to tell from a two-finger scroll and the two-handed zoom already does
 * the job; on a larger one it may be the better gesture. The direction is the
 * host's convention, and the same spread means opposite things on different
 * desktops. Neither has an answer the firmware can know.
 *
 * They were build switches until firmware v0.7.4, which meant a rebuild, a
 * flash and a keymap reset to answer a question you can answer by trying it.
 *
 * Nothing is drawn for a keyboard that does not publish them: older firmware,
 * or a build without CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS. A switch that does
 * nothing is worse than no switch, because it teaches the wrong thing about
 * what the keyboard can do.
 *
 * Writes go to every split side at once. The two halves classify gestures
 * independently, each reading its own copy of the setting, and one pad
 * pinching while the other does not is a keyboard behaving inconsistently
 * rather than a keyboard configured two ways.
 */
import { ToggleRow } from "./ToggleRow";
import { useLanguage } from "../../hooks/useLanguage";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import {
  ONE_HAND_PINCH_KEY,
  PINCH_INVERT_KEY,
  readTrackpadToggle,
} from "../../lib/trackpad/settings";

export function PinchSettings({
  settings,
  rows,
}: {
  settings: TrackpadSettingsAccess;
  rows: readonly Setting[];
}) {
  const { t } = useLanguage();

  // Every split side reports its own copy; they are meant to agree, so the
  // first one is as good as any to read through.
  const pinch = readTrackpadToggle(rows, ONE_HAND_PINCH_KEY);
  const invert = readTrackpadToggle(rows, PINCH_INVERT_KEY);

  /*
   * Written and then saved, rather than left as an unsaved change with a Save
   * button beside it. The generic settings pane has that button because it
   * edits many values at once and a batch is worth reviewing; a switch is not
   * a batch. Someone who flips it and unplugs the keyboard means it, and a
   * setting that quietly reverted on the next boot would read as a bug.
   */
  const setToggle = async (
    toggle: NonNullable<typeof pinch>,
    checked: boolean,
  ) => {
    await settings.writeSettingToMemory(
      toggle.setting,
      { boolValue: checked },
      { allSources: true },
    );
    await settings.saveSection(toggle.setting.customSubsystemIndex);
  };

  // Nothing to draw for a keyboard that does not have these. The shared
  // loading indicator lives in TrackpadSettings.
  if (!pinch && !invert) return null;

  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("One-pad pinch")}
      </h3>

      {pinch && (
        <ToggleRow
          label={t("Pinch with two fingers on one pad")}
          info={t(
            "Two fingers closing or spreading on a single pad zooms. On a small pad this is easy to confuse with a two-finger scroll, and the two-handed zoom — one finger on each pad — does the same job without the ambiguity. Off by default for that reason.",
          )}
          checked={pinch.enabled}
          disabled={settings.isLoading}
          onCheckedChange={(checked) => void setToggle(pinch, checked)}
        />
      )}

      {invert && (
        <ToggleRow
          label={t("Reverse the pinch direction")}
          info={t(
            "Spreading the fingers zooms out instead of in. Which way round is right is the host's convention rather than anything about the pad, so there is no setting that is correct on every machine.",
          )}
          checked={invert.enabled}
          // Settable while the pinch itself is off. Greying it out was meant to
          // say "this does nothing right now", but it also means you cannot set
          // the direction before turning the gesture on — so you turn it on,
          // find it backwards, and go back for a second switch. The setting is
          // stored either way; let it be chosen either way.
          disabled={settings.isLoading}
          onCheckedChange={(checked) => void setToggle(invert, checked)}
        />
      )}
    </div>
  );
}
