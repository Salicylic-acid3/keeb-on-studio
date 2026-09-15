/**
 * One listing of the trackpad's custom settings, shared by everything that
 * draws them.
 *
 * These settings live on both halves of a split, because a gesture is
 * classified on the half that owns the sensor. So every listing goes out with
 * source = every side, and on a split that means the central relays the request
 * to the peripheral over Bluetooth and waits for the answer to come back the
 * same way. It is by far the most expensive question this page asks.
 *
 * The pad's scale and the pinch switches used to ask it separately, once each,
 * which meant two relayed round trips the moment the tab mounted for a list
 * that is identical both times. One hook, one listing, both sections read from
 * it.
 *
 * Whether that traffic is also what has been resetting the peripheral is not
 * settled here; halving it is right either way.
 */
import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import { TRACKPAD_SUBSYSTEM_ID } from "../../lib/trackpad/settings";
import { PinchSettings } from "./PinchSettings";
import { ScaleSettings } from "./ScaleSettings";
import { ToggleRow } from "./ToggleRow";

/**
 * The two cards below are tuning, not daily use: once the pad feels right
 * they are opened rarely, and a page of numbers invites fiddling. They sit
 * behind one switch, remembered in this browser.
 */
const ADVANCED_STORAGE_KEY = "trackpadAdvancedSettings";

function readAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The part of the settings hook the two sections use.
 *
 * Named rather than inlined so neither section has to import the hook just to
 * spell its own prop type — which is the thing that made them call it.
 */
export type TrackpadSettingsAccess = Pick<
  ReturnType<typeof useCustomSettings>,
  "isLoading" | "writeSettingToMemory" | "saveSection"
>;

export function TrackpadSettings() {
  const { t } = useLanguage();
  const settings = useCustomSettings({
    subsystemIdentifier: TRACKPAD_SUBSYSTEM_ID,
  });
  const [advanced, setAdvanced] = useState<boolean>(readAdvanced);
  useEffect(() => {
    try {
      localStorage.setItem(ADVANCED_STORAGE_KEY, advanced ? "1" : "0");
    } catch {
      // A browser that refuses storage just forgets the switch on reload.
    }
  }, [advanced]);

  // Each split side reports its own copy of every setting; they are meant to
  // agree, so the sections read whichever arrives first for a given key.
  const rows = useMemo(
    () => settings.sections.flatMap((section) => section.settings),
    [settings.sections],
  );

  if (rows.length === 0) {
    // Either still arriving, or a keyboard without these settings — older
    // firmware, or a build without CONFIG_INPUT_IQS9151_RUNTIME_SETTINGS.
    // Neither deserves a message; the section simply is not there.
    return settings.isLoading ? (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <IconLoader2 size={14} className="animate-spin" />
        {t("Loading...")}
      </div>
    ) : null;
  }

  return (
    <>
      <div className="glass-card p-4">
        <ToggleRow
          label={t("Show advanced settings")}
          info={t(
            "Pointer speed per axis, smoothing, the report interval, touch sensitivity, the ripple map switch, and the pinch and three-finger swipe settings. For tuning; once the pad feels right there is little reason to open it.",
          )}
          checked={advanced}
          onCheckedChange={setAdvanced}
        />
      </div>
      {advanced && (
        <>
          <ScaleSettings settings={settings} rows={rows} />
          <PinchSettings settings={settings} rows={rows} />
        </>
      )}
    </>
  );
}
