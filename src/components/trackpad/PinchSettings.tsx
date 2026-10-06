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
import type { Layer } from "../../hooks/useKeymap";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { TrackpadSettingsAccess } from "./TrackpadSettings";
import { NumberRow } from "./NumberRow";
import {
  FINGER_SPLIT_KEY,
  SWIPE2_LAYERS_KEY,
  ONE_HAND_PINCH_KEY,
  PINCH_INVERT_KEY,
  SWIPE2_THRESHOLD_KEY,
  SWIPE3_THRESHOLD_X_KEY,
  SWIPE3_THRESHOLD_Y_KEY,
  commitTrackpadNumber,
  readTrackpadNumber,
  readTrackpadToggle,
  sidesDisagree,
} from "../../lib/trackpad/settings";

export function PinchSettings({
  settings,
  rows,
  layers = [],
}: {
  settings: TrackpadSettingsAccess;
  rows: readonly Setting[];
  /** The keymap's layers, for the per-layer horizontal swipe switches. */
  layers?: Layer[];
}) {
  const { t } = useLanguage();

  // Every split side reports its own copy; they are meant to agree, so the
  // first one is as good as any to read through.
  const pinch = readTrackpadToggle(rows, ONE_HAND_PINCH_KEY);
  const invert = readTrackpadToggle(rows, PINCH_INVERT_KEY);
  const swipeX = readTrackpadNumber(rows, SWIPE3_THRESHOLD_X_KEY);
  const swipeY = readTrackpadNumber(rows, SWIPE3_THRESHOLD_Y_KEY);
  const swipe2Distance = readTrackpadNumber(rows, SWIPE2_THRESHOLD_KEY);
  const fingerSplit = readTrackpadNumber(rows, FINGER_SPLIT_KEY);
  const swipe2Layers = readTrackpadNumber(rows, SWIPE2_LAYERS_KEY);

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

  /*
   * One bit per layer id; -1 is every layer. Written to both halves like the
   * switches above, though only the half with the keymap can act on it: the
   * other half does not know which layer is active and always swipes.
   */
  const swipe2Mask = swipe2Layers?.value ?? -1;
  const swipe2On = (layerId: number) => (swipe2Mask & (1 << layerId)) !== 0;
  const setSwipe2 = async (layerId: number, checked: boolean) => {
    if (!swipe2Layers) return;
    const next = checked
      ? swipe2Mask | (1 << layerId)
      : swipe2Mask & ~(1 << layerId);
    await settings.writeSettingToMemory(
      swipe2Layers.setting,
      { int32Value: next | 0 },
      { allSources: true },
    );
    await settings.saveSection(swipe2Layers.setting.customSubsystemIndex);
  };

  // Nothing to draw for a keyboard that does not have these. The shared
  // loading indicator lives in TrackpadSettings.
  if (
    !pinch &&
    !invert &&
    !swipeX &&
    !swipeY &&
    !swipe2Distance &&
    !fingerSplit &&
    !swipe2Layers
  )
    return null;

  return (
    <div className="glass-card space-y-3 p-4">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("One-pad pinch")}
      </h3>

      <div className="setting-grid">
        {pinch && (
          <ToggleRow
            label={t("Pinch with two fingers on one pad")}
            info={t(
              "Two fingers closing or spreading on one pad zooms. On a small pad this is easy to confuse with two-finger scrolling, and zooming with one finger on each pad does the same job without the confusion — so this is off by default.",
            )}
            checked={pinch.enabled}
            disagree={sidesDisagree(pinch)}
            disabled={settings.isLoading}
            onCheckedChange={(checked) => void setToggle(pinch, checked)}
          />
        )}

        {invert && (
          <ToggleRow
            label={t("Reverse the pinch direction")}
            info={t(
              "Reverses the zoom direction, for both the one-pad pinch and the one-finger-on-each-pad zoom. Which way is right depends on the computer.",
            )}
            checked={invert.enabled}
            disagree={sidesDisagree(invert)}
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

      {/* The two swipes are different gestures with different consequences
          for scrolling, so they sit under one heading but keep their own
          names. Two fingers sideways is either a swipe or a horizontal
          scroll, never both, and that choice also decides whether a scroll
          is held to one axis. Three fingers never scroll. */}
      {(swipe2Layers || swipe2Distance || swipeX || swipeY) && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <h4 className="text-sm font-medium text-[var(--color-text)]">
            {t("Swipes")}
          </h4>
        </div>
      )}

      {(swipe2Layers || swipe2Distance) && (
        <div className="setting-grid">
          <div>
            <h5 className="text-sm text-[var(--color-text)]">
              {t("Two-finger horizontal swipe")}
            </h5>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t(
                "On a layer with the switch on, moving two fingers sideways is a swipe (bound as a key on the trackpad tab), and a scroll that starts there is held to the axis it started on, so it does not drift sideways. With the switch off, two fingers scroll sideways and diagonally as well as up and down. Both pads follow the layer (ClickBoard ErgoTrack firmware 828af41 or later; before that, only the half connected to the computer did).",
              )}
            </p>
          </div>
          {swipe2Layers &&
            layers.map((layer, index) => (
              <ToggleRow
                key={layer.id}
                label={t("Swipe on {{layer}}", {
                  layer: layer.name || t("Layer {{id}}", { id: index }),
                })}
                info={t(
                  "On: two fingers sideways is a swipe and scrolling stays on one axis. Off: two fingers scroll sideways and diagonally on this layer.",
                )}
                checked={swipe2On(layer.id)}
                disagree={sidesDisagree(swipe2Layers)}
                disabled={settings.isLoading}
                onCheckedChange={(checked) => void setSwipe2(layer.id, checked)}
              />
            ))}
          {swipe2Distance && (
            <NumberRow
              label={t("Swipe distance ({{n}} counts)", {
                n: swipe2Distance.value,
              })}
              info={t(
                "How far sideways two fingers travel before it is a swipe, in sensor counts (about 23 to the millimetre). Lower if swipes are missed, raise if they fire while you meant to scroll.",
              )}
              field={swipe2Distance}
              step={10}
              disabled={settings.isLoading}
              onCommit={(typed) =>
                void commitTrackpadNumber(settings, swipe2Distance, typed, {
                  min: 1,
                  max: 1000,
                })
              }
            />
          )}
        </div>
      )}

      {(swipeX || swipeY) && (
        <div className="setting-grid">
          <div>
            <h5 className="text-sm text-[var(--color-text)]">
              {t("Three-finger swipe")}
            </h5>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t(
                "Three fingers moving in any of the four directions is a swipe (bound as keys on the trackpad tab); they never scroll. These are how far they travel before it counts, in sensor counts (about 23 to the millimetre). Lower if swipes are missed, raise if they fire while you meant to hold.",
              )}
            </p>
          </div>

          {swipeX && (
            <NumberRow
              label={t("Up and down ({{n}} counts)", { n: swipeX.value })}
              info={t(
                "Along the long side of the pad, where three fingers have room to travel.",
              )}
              field={swipeX}
              step={10}
              disabled={settings.isLoading}
              onCommit={(typed) =>
                void commitTrackpadNumber(settings, swipeX, typed, {
                  min: 1,
                  max: 1000,
                })
              }
            />
          )}

          {swipeY && (
            <NumberRow
              label={t("Left and right ({{n}} counts)", { n: swipeY.value })}
              info={t(
                "Across the short side of the pad. Three fingers fill most of it, so this is set lower than the other.",
              )}
              field={swipeY}
              step={10}
              disabled={settings.isLoading}
              onCommit={(typed) =>
                void commitTrackpadNumber(settings, swipeY, typed, {
                  min: 1,
                  max: 1000,
                })
              }
            />
          )}
        </div>
      )}

      {fingerSplit && (
        <div className="border-t border-[var(--color-border)] pt-3">
          <h4 className="text-sm font-medium text-[var(--color-text)]">
            {t("Finger detection")}
          </h4>
        </div>
      )}
      {fingerSplit && (
        <div className="setting-grid">
          <NumberRow
            label={t("Telling two fingers apart ({{n}})", {
              n: fingerSplit.value,
            })}
            info={t(
              "The sensor's own finger split factor: how readily one touched area is taken for two fingers. Higher splits more readily, 0 never splits, 3 is the sensor's default. It only matters when the fingers are nearly touching each other; two fingers with a gap between them are always two. If a close two-finger scroll does not start, raise it one step at a time; if one finger sometimes counts as two, lower it.",
            )}
            field={fingerSplit}
            step={1}
            disabled={settings.isLoading}
            onCommit={(typed) =>
              void commitTrackpadNumber(settings, fingerSplit, typed, {
                min: 0,
                max: 255,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
