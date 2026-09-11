/**
 * The gestures, edited as gestures.
 *
 * These six bindings have always been editable — they are ordinary keymap
 * positions and the keymap editor has always drawn them. It drew them as seven
 * blank keys in a row under the board, with nothing anywhere to say that one of
 * them is the pinch modifier and four of them are swipes. Someone who did not
 * write the firmware had no way to find that out.
 *
 * So this is the same six bindings with their names attached, on the tab where
 * someone thinking about the trackpad already is. It writes through the same
 * setBinding the keymap editor uses, so an edit here and an edit there are the
 * same edit, and the keymap editor stays the place for everything else.
 *
 * The layer tabs are not decoration. Routing a gesture through a key position
 * is what makes it layer-resolved, and layer-resolved is what lets Alt Base
 * give the same pinch a different modifier for the other OS. A gesture editor
 * that only showed Base would hide the entire reason the firmware does this.
 */
import { useMemo, useState } from "react";
import { IconHandFinger, IconPencil } from "@tabler/icons-react";
import type { TrackpadGesture } from "../../lib/trackpad/gestures";
import type { BehaviorDefinition, Layer } from "../../hooks/useKeymap";
import { formatBehaviorBinding } from "../../lib/behaviorMetadata";
import type { KeyboardLayoutType } from "../../lib/keyboardLayouts";
import { useLanguage } from "../../hooks/useLanguage";

export interface GestureSectionProps {
  gestures: TrackpadGesture[];
  layers: Layer[];
  behaviors: Map<number, BehaviorDefinition>;
  /** Key positions the keyboard is pressing right now, from the input stream. */
  highlightedKeys: ReadonlySet<number>;
  /** True when the live key view is on, which is what fills highlightedKeys. */
  liveViewOn: boolean;
  keyboardLayout?: KeyboardLayoutType;
  /** Open the keycode dialog for this layer and position. */
  onEdit: (layerId: number, position: number) => void;
  disabled?: boolean;
}

export function GestureSection({
  gestures,
  layers,
  behaviors,
  highlightedKeys,
  liveViewOn,
  keyboardLayout,
  onEdit,
  disabled = false,
}: GestureSectionProps) {
  const { t } = useLanguage();
  const [layerIndex, setLayerIndex] = useState(0);

  // Clamp rather than trust: the layer list is reloaded from the device and
  // can come back shorter than it was when this tab was last open.
  const layer = layers[Math.min(layerIndex, Math.max(layers.length - 1, 0))];

  const bindingFor = useMemo(
    () => (position: number) => layer?.bindings?.[position],
    [layer],
  );

  if (gestures.length === 0 || !layer) return null;

  return (
    <section className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <IconHandFinger size={16} className="text-[var(--color-cyber)]" />
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {t("Gestures")}
        </h2>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        {t(
          "The keyboard presses a key of its own for each of these. Whatever is bound here is what the gesture does — and because it goes through a layer, Alt Base can give the same gesture a different key for the other OS.",
        )}
      </p>

      {/* Which end of each swipe axis is which depends on how the sensor sits
          in the case, and the two pads are not mounted the same way round. So
          rather than label them with a direction that may be backwards on one
          pad, point at the live view, which cannot be wrong. */}
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        {liveViewOn
          ? t(
              "Swipe on a pad and the row it triggers will light up. The two pads may not agree on which is A and which is B.",
            )
          : t(
              "To find out which swipe is which, turn on the live key view in the Keymap tab and swipe on a pad: the row it triggers lights up.",
            )}
      </p>

      {layers.length > 1 && (
        <div
          className="flex gap-1 mb-3 flex-wrap"
          role="tablist"
          aria-label={t("Layer")}
        >
          {layers.map((candidate, index) => (
            <button
              key={candidate.id}
              role="tab"
              aria-selected={index === layerIndex}
              onClick={() => setLayerIndex(index)}
              className={`px-3 py-1 rounded-lg border text-xs transition-colors ${
                index === layerIndex
                  ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40 text-[var(--color-electric)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-electric)]/40"
              }`}
            >
              {candidate.name || t("Layer {{id}}", { id: index })}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {gestures.map((gesture) => {
          const binding = bindingFor(gesture.position);
          const behavior = binding
            ? (behaviors.get(binding.behaviorId) ?? null)
            : null;
          const active = highlightedKeys.has(gesture.position);

          return (
            <button
              key={gesture.position}
              onClick={() => onEdit(layer.id, gesture.position)}
              disabled={disabled}
              className={`w-full text-left p-3 rounded-lg border transition-colors disabled:opacity-40 ${
                active
                  ? "bg-[var(--color-neon)]/15 border-[var(--color-neon)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text)]">
                    {t(gesture.label)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {t(gesture.detail)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-[var(--color-electric)] truncate max-w-[180px]">
                    {formatBehaviorBinding(binding, behavior, {
                      keyboardLayout,
                    })}
                  </span>
                  <IconPencil
                    size={14}
                    className="text-[var(--color-text-muted)]"
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
