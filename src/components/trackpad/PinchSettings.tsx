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
import * as Switch from "@radix-ui/react-switch";
import { IconLoader2 } from "@tabler/icons-react";
import { useMemo } from "react";
import { InfoTip } from "../InfoTip";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import {
  ONE_HAND_PINCH_KEY,
  PINCH_INVERT_KEY,
  TRACKPAD_SUBSYSTEM_ID,
  readTrackpadToggle,
} from "../../lib/trackpad/settings";

function ToggleRow({
  label,
  info,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  info: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </span>
      <Switch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="relative h-5 w-9 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors data-[state=checked]:border-[var(--color-electric)] data-[state=checked]:bg-[var(--color-electric)]/30 disabled:opacity-50"
      >
        <Switch.Thumb className="block h-3.5 w-3.5 translate-x-[2px] rounded-full bg-[var(--color-text-muted)] transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-[var(--color-electric)]" />
      </Switch.Root>
    </div>
  );
}

export function PinchSettings() {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: TRACKPAD_SUBSYSTEM_ID,
  });

  // Every split side reports its own copy; they are meant to agree, so the
  // first one is as good as any to read through.
  const rows = useMemo(
    () => settings.sections.flatMap((section) => section.settings),
    [settings.sections],
  );
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

  if (!pinch && !invert) {
    // Either still loading, or a keyboard that does not have these. Neither is
    // worth a message: the section simply is not there.
    return settings.isLoading ? (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <IconLoader2 size={14} className="animate-spin" />
        {t("Loading...")}
      </div>
    ) : null;
  }

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
