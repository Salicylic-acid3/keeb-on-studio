import { LAYER_UNSET, LAYER_OS_DETECTION } from "../lib/osDetection";
import { layerLabel } from "../hooks/useLayerNames";
import { useLanguage } from "../hooks/useLanguage";

interface LayerSelectProps {
  value: number;
  /** The layer indices to offer, in order. */
  layerIndices: number[];
  layerNames: string[];
  /** Whether to offer the "Follow OS detection" sentinel option (-2). Endpoints only. */
  allowOsDetection?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
}

/**
 * A default-layer picker.
 *
 * Only the layers that can be a default layer are offered -- the base pair,
 * on these keyboards -- and there is no "Not set": the firmware treats an
 * unset endpoint as "the keymap's default layer" and an unset OS entry the
 * same way, which is one of the offered options, so a stored -1 is shown as
 * what it does rather than as a fourth state nobody chose.
 */
export function LayerSelect({
  value,
  layerIndices,
  layerNames,
  allowOsDetection = false,
  disabled = false,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: LayerSelectProps) {
  const { t } = useLanguage();

  // A value nothing offers (unset, or a layer outside the pair) shows as
  // what the firmware resolves it to: OS detection where that is offered
  // (an endpoint's natural default), otherwise the first layer.
  const offered = new Set<number>(layerIndices);
  if (allowOsDetection) offered.add(LAYER_OS_DETECTION);
  const shown = offered.has(value)
    ? value
    : allowOsDetection
      ? LAYER_OS_DETECTION
      : (layerIndices[0] ?? LAYER_UNSET);

  return (
    <select
      className={`select-field text-sm w-full tablet:w-56 ${className}`}
      value={shown}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
    >
      {allowOsDetection && (
        <option value={LAYER_OS_DETECTION}>{t("Follow OS detection")}</option>
      )}
      {layerIndices.map((index) => (
        <option key={index} value={index}>
          {layerLabel(layerNames, index)}
        </option>
      ))}
    </select>
  );
}
