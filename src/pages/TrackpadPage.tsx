import { useState, useRef, useCallback, useContext, useMemo } from "react";
import {
  IconAlertTriangleFilled,
  IconChevronLeft,
  IconChevronRight,
  IconCpu,
  IconLoader2,
  IconPointer,
  IconRefresh,
} from "@tabler/icons-react";
import * as Switch from "@radix-ui/react-switch";
import { useRuntimeInputProcessor } from "../hooks/useRuntimeInputProcessor";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { DocTip } from "../components/DocTip";
import { InfoTip } from "../components/InfoTip";
import { HexIcon } from "../components/brand/HexIcon";
import { processorDoc } from "../i18n/featureDocs";
import { AxisSnapMode } from "../proto/zmk/runtime_input_processor/runtime_input_processor";
import { useDebouncedSave } from "../hooks/useDebouncedSave";
import { MEMORY_WRITE_DEBOUNCE_MS } from "../hooks/useDebouncedMemoryWrite";
import { useLanguage } from "../hooks/useLanguage";
import { ResetVersionMenu } from "../components/versionHistory/ResetVersionMenu";
import { VersionDiffModal } from "../components/versionHistory/VersionDiffModal";
import { useTrackpadVersionHistory } from "../hooks/versionHistory/useTrackpadVersionHistory";
import { useKeymap, type BehaviorBinding } from "../hooks/useKeymap";
import { useInputStream } from "../hooks/useInputStream";
import { useStudioUnlock } from "../hooks/useStudioUnlock";
import { KeyboardLayoutContext } from "../contexts/KeyboardLayoutContext";
import { KeycodeSelector } from "../components/KeycodeSelector";
import { GestureSection } from "../components/trackpad/GestureSection";
import { trackpadGesturesFor } from "../lib/trackpad/gestures";

interface LayerInfo {
  id: number;
  name: string;
}

// Visualizes a processor's "Active on Layers" (filled squares) and its
// auto-track layer target (ringed square) as a compact grid of layer cells.
function LayerGrid({
  layers,
  activeLayers,
  tempLayerEnabled,
  tempLayerLayer,
}: {
  layers: LayerInfo[];
  activeLayers: number;
  tempLayerEnabled: boolean;
  tempLayerLayer: number;
}) {
  const { t } = useLanguage();

  if (layers.length === 0) {
    return (
      <span className="text-[10px] text-[var(--color-text-muted)]">
        {t("Loading layers...")}
      </span>
    );
  }

  // A bitmask of 0 means the processor is active on every layer.
  const allActive = activeLayers === 0;

  return (
    <div className="flex flex-wrap gap-1">
      {layers.map((layer) => {
        const isActive = allActive || (activeLayers & (1 << layer.id)) !== 0;
        const isTemp = tempLayerEnabled && tempLayerLayer === layer.id;
        const label = layer.name || t("Layer {{id}}", { id: layer.id });
        return (
          <span
            key={layer.id}
            title={
              isTemp
                ? t("{{layer}} — temporary layer target", { layer: label })
                : isActive
                  ? t("{{layer}} — active", { layer: label })
                  : t("{{layer}} — inactive", { layer: label })
            }
            className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] font-mono transition-colors ${
              isActive
                ? "border-[var(--color-electric)]/50 bg-[var(--color-electric)]/20 text-[var(--color-electric)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            } ${isTemp ? "ring-2 ring-[var(--color-cyber)]" : ""}`}
          >
            {layer.id}
          </span>
        );
      })}
    </div>
  );
}

/**
 * A yes/no setting on one line: name, an info icon, a switch.
 *
 * The caption under each of these used to be a second line of prose, which is
 * right the first time someone meets the setting and noise every time after.
 * The words are the same words, moved onto the icon.
 */
function ToggleRow({
  label,
  info,
  checked,
  onCheckedChange,
}: {
  label: string;
  info: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5 min-w-0">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="w-11 h-6 flex-shrink-0 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
      >
        <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
      </Switch.Root>
    </div>
  );
}

const SCALING_MIN = 0.01;
const SCALING_MAX = 10;
const SCALING_STEPS = 100;
const SCALING_BUTTON_STEP = 0.05;
const SCALING_PRECISION = 1000;
const ROTATION_MIN = -180;
const ROTATION_MAX = 180;
const ROTATION_STEP = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

function scalingIndexToValue(index: number): number {
  const normalized = clamp(index, 0, SCALING_STEPS) / SCALING_STEPS;
  return SCALING_MIN * (SCALING_MAX / SCALING_MIN) ** normalized;
}

function scalingValueToIndex(value: number): number {
  const clampedValue = clamp(value, SCALING_MIN, SCALING_MAX);
  const normalized =
    Math.log(clampedValue / SCALING_MIN) / Math.log(SCALING_MAX / SCALING_MIN);
  return Math.round(normalized * SCALING_STEPS);
}

function scalingValueToFraction(value: number): {
  multiplier: number;
  divisor: number;
} {
  const multiplier = Math.round(value * SCALING_PRECISION);
  const divisor = SCALING_PRECISION;
  const divisorValue = gcd(multiplier, divisor);
  return {
    multiplier: multiplier / divisorValue,
    divisor: divisor / divisorValue,
  };
}

function scalingValueToButtonStep(value: number, direction: -1 | 1): number {
  const stepCount = Math.round(value / SCALING_BUTTON_STEP) + direction;
  return clamp(stepCount * SCALING_BUTTON_STEP, SCALING_MIN, SCALING_MAX);
}

function formatScalingValue(value: number): string {
  return value.toFixed(2);
}

export function TrackpadPage() {
  const { t } = useLanguage();
  const inputProcessor = useRuntimeInputProcessor();
  const {
    isAvailable,
    processors,
    layers,
    isLoading,
    error,
    loadProcessors,
    setScaling,
    setRotation,
    setTempLayerEnabled,
    setTempLayerLayer,
    setTempLayerActivationDelay,
    setTempLayerDeactivationDelay,
    setActiveLayers,
    setAxisSnapMode,
    setAxisSnapThreshold,
    setAxisSnapTimeout,
    setXInvert,
    setYInvert,
    setXyToScrollEnabled,
    setXySwapEnabled,
  } = inputProcessor;

  // Version history over the processor tuning. Processor writes are
  // persistent write-throughs and the tab has no firmware-default RPC, so the
  // menu offers captured versions only.
  const versionHistory = useTrackpadVersionHistory({
    inputProcessor,
    isLoaded: !isLoading && (!isAvailable || processors.length > 0),
    t,
  });

  // --- Gestures -----------------------------------------------------------
  // The keymap is loaded here rather than shared from the keymap tab, which is
  // how every other consumer of useKeymap in this app works. It costs a read
  // when this tab opens; the fast-keymap subsystem makes that cheap, and the
  // alternative is a cross-tab cache with its own staleness to get wrong.
  const keymap = useKeymap();
  const inputStream = useInputStream();
  const keyboardLayoutContext = useContext(KeyboardLayoutContext);
  const { runWithUnlock } = useStudioUnlock();

  const activeLayout =
    keymap.physicalLayouts?.layouts?.[keymap.physicalLayouts.activeLayoutIndex];
  const gestures = useMemo(
    () => trackpadGesturesFor(activeLayout?.name, activeLayout?.keys?.length),
    [activeLayout],
  );

  /** Which gesture binding the dialog is open on, or null. */
  const [editing, setEditing] = useState<{
    layerId: number;
    position: number;
  } | null>(null);

  const editingBinding = useMemo(() => {
    if (!editing) return null;
    const layer = keymap.keymap?.layers.find((l) => l.id === editing.layerId);
    return layer?.bindings?.[editing.position] ?? null;
  }, [editing, keymap.keymap?.layers]);

  const handleEditGesture = useCallback(
    (layerId: number, position: number) => setEditing({ layerId, position }),
    [],
  );

  const handleGestureBindingSelect = useCallback(
    (binding: BehaviorBinding) => {
      const target = editing;
      setEditing(null);
      if (!target) return;
      void runWithUnlock(() =>
        keymap.setBinding(target.layerId, target.position, binding),
      );
    },
    [editing, keymap, runWithUnlock],
  );

  // Selected processor index
  const [selectedProcessorIndex, setSelectedProcessorIndex] = useState(0);

  // Rotation enabled state
  const [rotationEnabled, setRotationEnabled] = useState(false);

  // Active layers mode: "all" or "specific"
  const [activeLayersMode, setActiveLayersMode] = useState<"all" | "specific">(
    "all",
  );

  // Debounced save hooks for each field
  const scalingMultiplierSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const scalingDivisorSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const rotationSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const tempLayerEnabledSave = useDebouncedSave<boolean>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const tempLayerLayerSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const tempLayerActivationDelaySave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const tempLayerDeactivationDelaySave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const activeLayersSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const axisSnapModeSave = useDebouncedSave<AxisSnapMode>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const axisSnapThresholdSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const axisSnapTimeoutSave = useDebouncedSave<number>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const xInvertSave = useDebouncedSave<boolean>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const yInvertSave = useDebouncedSave<boolean>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const xyToScrollEnabledSave = useDebouncedSave<boolean>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });
  const xySwapEnabledSave = useDebouncedSave<boolean>({
    delay: MEMORY_WRITE_DEBOUNCE_MS,
  });

  // Track previous processor to detect changes and reset pending state
  const previousProcessorRef = useRef<string | null>(null);

  // Get the selected processor
  const processor = processors[selectedProcessorIndex] || null;

  // Reset pending state when processor changes
  const currentProcessorName = processor?.name || null;
  if (previousProcessorRef.current !== currentProcessorName) {
    previousProcessorRef.current = currentProcessorName;
    scalingMultiplierSave.reset();
    scalingDivisorSave.reset();
    rotationSave.reset();
    tempLayerEnabledSave.reset();
    tempLayerLayerSave.reset();
    tempLayerActivationDelaySave.reset();
    tempLayerDeactivationDelaySave.reset();
    activeLayersSave.reset();
    axisSnapModeSave.reset();
    axisSnapThresholdSave.reset();
    axisSnapTimeoutSave.reset();
    xInvertSave.reset();
    yInvertSave.reset();
    xyToScrollEnabledSave.reset();
    xySwapEnabledSave.reset();
    setRotationEnabled(processor?.rotationDegrees !== 0);
    setActiveLayersMode(processor?.activeLayers === 0 ? "all" : "specific");
  }

  // Calculate display values with pending states
  const displayScalingMultiplier =
    scalingMultiplierSave.pendingValue ?? processor?.scaleMultiplier ?? 1;
  const displayScalingDivisor =
    scalingDivisorSave.pendingValue ?? processor?.scaleDivisor ?? 1;
  const displayRotation =
    rotationSave.pendingValue ?? processor?.rotationDegrees ?? 0;
  const displayTempLayerEnabled =
    tempLayerEnabledSave.pendingValue ?? processor?.tempLayerEnabled ?? false;
  const displayTempLayerLayer =
    tempLayerLayerSave.pendingValue ?? processor?.tempLayerLayer ?? 0;
  const displayTempLayerActivationDelay =
    tempLayerActivationDelaySave.pendingValue ??
    processor?.tempLayerActivationDelayMs ??
    100;
  const displayTempLayerDeactivationDelay =
    tempLayerDeactivationDelaySave.pendingValue ??
    processor?.tempLayerDeactivationDelayMs ??
    500;
  const displayActiveLayers =
    activeLayersSave.pendingValue ?? processor?.activeLayers ?? 0;
  const displayAxisSnapMode =
    axisSnapModeSave.pendingValue ??
    processor?.axisSnapMode ??
    AxisSnapMode.AXIS_SNAP_MODE_NONE;
  const displayAxisSnapThreshold =
    axisSnapThresholdSave.pendingValue ?? processor?.axisSnapThreshold ?? 50;
  const displayAxisSnapTimeout =
    axisSnapTimeoutSave.pendingValue ?? processor?.axisSnapTimeoutMs ?? 200;
  const displayXInvert =
    xInvertSave.pendingValue ?? processor?.xInvert ?? false;
  const displayYInvert =
    yInvertSave.pendingValue ?? processor?.yInvert ?? false;
  const displayXyToScrollEnabled =
    xyToScrollEnabledSave.pendingValue ?? processor?.xyToScrollEnabled ?? false;
  const displayXySwapEnabled =
    xySwapEnabledSave.pendingValue ?? processor?.xySwapEnabled ?? false;

  // Calculate final scaling value (multiplier/divisor)
  const finalScalingValue =
    displayScalingDivisor !== 0
      ? displayScalingMultiplier / displayScalingDivisor
      : 1;
  const scalingSliderIndex = scalingValueToIndex(finalScalingValue);

  // Handler functions using useDebouncedSave
  const handleScalingValueChange = (value: number) => {
    if (!processor) return;
    const { multiplier, divisor } = scalingValueToFraction(value);
    scalingMultiplierSave.cancel();
    scalingDivisorSave.cancel();
    scalingMultiplierSave.setPendingValue(multiplier, async () => {
      await setScaling(processor.id, multiplier, divisor);
    });
    scalingDivisorSave.setPendingValue(divisor, async () => {
      // Multiplier save writes both values together.
    });
  };

  const handleScalingSliderChange = (index: number) => {
    handleScalingValueChange(scalingIndexToValue(index));
  };

  const handleScalingStepChange = (direction: -1 | 1) => {
    handleScalingValueChange(
      scalingValueToButtonStep(finalScalingValue, direction),
    );
  };

  const handleRotationEnabledChange = (enabled: boolean) => {
    setRotationEnabled(enabled);
    if (!enabled && processor) {
      rotationSave.setPendingValue(0, async () => {
        await setRotation(processor.id, 0);
      });
    }
  };

  const handleRotationChange = (degrees: number) => {
    if (!processor) return;
    const clampedDegrees = clamp(degrees, ROTATION_MIN, ROTATION_MAX);
    rotationSave.setPendingValue(clampedDegrees, async (value) => {
      await setRotation(processor.id, value);
    });
  };

  const handleTempLayerEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    tempLayerEnabledSave.setPendingValue(enabled, async (value) => {
      await setTempLayerEnabled(processor.id, value);
    });
  };

  const handleTempLayerLayerChange = (layer: number) => {
    if (!processor) return;
    tempLayerLayerSave.setPendingValue(layer, async (value) => {
      await setTempLayerLayer(processor.id, value);
    });
  };

  const handleTempLayerActivationDelayChange = (delayMs: number) => {
    if (!processor) return;
    tempLayerActivationDelaySave.setPendingValue(delayMs, async (value) => {
      await setTempLayerActivationDelay(processor.id, value);
    });
  };

  const handleTempLayerDeactivationDelayChange = (delayMs: number) => {
    if (!processor) return;
    tempLayerDeactivationDelaySave.setPendingValue(delayMs, async (value) => {
      await setTempLayerDeactivationDelay(processor.id, value);
    });
  };

  const handleActiveLayersModeChange = (mode: "all" | "specific") => {
    setActiveLayersMode(mode);
    if (mode === "all" && processor) {
      // Set bitmask to 0 for all layers
      activeLayersSave.setPendingValue(0, async () => {
        await setActiveLayers(processor.id, 0);
      });
    }
  };

  const handleLayerToggle = (layerId: number) => {
    if (!processor) return;
    const currentBitmask = displayActiveLayers;
    const layerBit = 1 << layerId;
    const newBitmask =
      (currentBitmask & layerBit) !== 0
        ? currentBitmask & ~layerBit // Clear bit
        : currentBitmask | layerBit; // Set bit

    activeLayersSave.setPendingValue(newBitmask, async (value) => {
      await setActiveLayers(processor.id, value);
    });
  };

  const handleAxisSnapEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    // When enabling, default to Y axis snap
    const newMode = enabled
      ? AxisSnapMode.AXIS_SNAP_MODE_Y
      : AxisSnapMode.AXIS_SNAP_MODE_NONE;
    axisSnapModeSave.setPendingValue(newMode, async (value) => {
      await setAxisSnapMode(processor.id, value);
    });
  };

  const handleAxisSnapModeChange = (mode: AxisSnapMode) => {
    if (!processor) return;
    axisSnapModeSave.setPendingValue(mode, async (value) => {
      await setAxisSnapMode(processor.id, value);
    });
  };

  const handleAxisSnapThresholdChange = (threshold: number) => {
    if (!processor) return;
    axisSnapThresholdSave.setPendingValue(threshold, async (value) => {
      await setAxisSnapThreshold(processor.id, value);
    });
  };

  const handleAxisSnapTimeoutChange = (timeoutMs: number) => {
    if (!processor) return;
    axisSnapTimeoutSave.setPendingValue(timeoutMs, async (value) => {
      await setAxisSnapTimeout(processor.id, value);
    });
  };

  const handleXInvertChange = (invert: boolean) => {
    if (!processor) return;
    xInvertSave.setPendingValue(invert, async (value) => {
      await setXInvert(processor.id, value);
    });
  };

  const handleYInvertChange = (invert: boolean) => {
    if (!processor) return;
    yInvertSave.setPendingValue(invert, async (value) => {
      await setYInvert(processor.id, value);
    });
  };

  const handleXyToScrollEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    xyToScrollEnabledSave.setPendingValue(enabled, async (value) => {
      await setXyToScrollEnabled(processor.id, value);
    });
  };

  const handleXySwapEnabledChange = (enabled: boolean) => {
    if (!processor) return;
    xySwapEnabledSave.setPendingValue(enabled, async (value) => {
      await setXySwapEnabled(processor.id, value);
    });
  };

  const handleSelectProcessor = (index: number) => {
    setSelectedProcessorIndex(index);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <HexIcon>
            <IconPointer size={24} className="text-[var(--color-electric)]" />
          </HexIcon>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              {t("Trackpad Settings")}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Adjust sensitivity and behavior via runtime input processor")}
            </p>
          </div>
          {isAvailable && (
            <div className="ml-auto">
              <ResetVersionMenu
                label={t("Versions")}
                versions={versionHistory.versions}
                onSelectVersion={versionHistory.selectVersion}
                disabled={isLoading}
                isBusy={versionHistory.isBusy}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 desktop:grid-cols-[300px_1fr] gap-4 min-w-0">
          {/* Left: selectable lists */}
          <div className="space-y-4">
            {/* Processors */}
            <section className="glass-card p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <IconCpu size={16} className="text-[var(--color-cyber)]" />
                  <h2 className="text-sm font-medium text-[var(--color-text)]">
                    {t("Processors")}
                  </h2>
                  <DocTip content={processorDoc(t)} />
                </div>
                <div className="flex items-center gap-1">
                  {isLoading && (
                    <IconLoader2
                      size={14}
                      className="animate-spin text-[var(--color-electric)]"
                    />
                  )}
                  {/* The page keeps its state across tab switches, so re-reading
                      the processor list is an explicit action. */}
                  <button
                    className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-electric)] disabled:opacity-40 transition-colors"
                    onClick={() => void loadProcessors()}
                    disabled={isLoading}
                    title={t("Reload")}
                    aria-label={t("Reload processors")}
                  >
                    <IconRefresh size={15} />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {processors.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                    {isLoading ? t("Loading...") : t("No processors found")}
                  </p>
                ) : (
                  processors.map((p, index) => {
                    const isSelectedProcessor =
                      selectedProcessorIndex === index;
                    // Reflect pending (unsaved) edits for the processor
                    // currently loaded into the detail pane; other rows show
                    // their persisted values.
                    const isEditing = selectedProcessorIndex === index;
                    const rowActiveLayers = isEditing
                      ? displayActiveLayers
                      : p.activeLayers;
                    const rowTempEnabled = isEditing
                      ? displayTempLayerEnabled
                      : p.tempLayerEnabled;
                    const rowTempLayer = isEditing
                      ? displayTempLayerLayer
                      : p.tempLayerLayer;
                    return (
                      <button
                        key={`${p.id}-${p.name}-${index}`}
                        onClick={() => handleSelectProcessor(index)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelectedProcessor
                            ? "bg-[var(--color-electric)]/10 border-[var(--color-electric)]/40"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-electric)]/40"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="block text-sm font-medium text-[var(--color-text)] truncate flex-1">
                            {p.name || t("Processor {{id}}", { id: p.id })}
                          </span>
                        </div>
                        <LayerGrid
                          layers={layers}
                          activeLayers={rowActiveLayers}
                          tempLayerEnabled={rowTempEnabled}
                          tempLayerLayer={rowTempLayer}
                        />
                      </button>
                    );
                  })
                )}
              </div>
              {processors.length > 0 && layers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded border border-[var(--color-electric)]/50 bg-[var(--color-electric)]/20" />
                    {t("Active on layer")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded border border-[var(--color-border)] ring-2 ring-[var(--color-cyber)]" />
                    {t("Temp layer")}
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* Right: detail pane for the selected item */}
          <div className="min-w-0">
            {!isAvailable && !isLoading && !error && (
              <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
                <div className="p-2">
                  <IconAlertTriangleFilled size={24} className="text-red-500" />
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t(
                    "Runtime input processor subsystem is not available for your keyboard.",
                  )}
                  <br />
                  {t("Make sure your firmware has the {{module}} enabled.", {
                    module: "cormoran/zmk-module-runtime-input-processor",
                  })}
                  <a
                    href="https://github.com/cormoran/zmk-module-runtime-input-processor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-electric)] underline mx-1"
                  >
                    cormoran/zmk-module-runtime-input-processor
                  </a>
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{t(error)}</p>
              </div>
            )}

            {/* Loading state */}
            {isLoading && !processor && (
              <LoadingIndicator
                className="mb-6"
                label={t("Loading trackpad settings...")}
              />
            )}

            {/* No processor found */}
            {!isLoading && !processor && !error && (
              <div className="mb-6 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t(
                    "No runtime input processor found. Make sure your firmware has the runtime input processor module enabled.",
                  )}
                </p>
              </div>
            )}

            {/* Settings */}
            {processor && (
              <div className="space-y-6">
                {/* Active Layers Selection */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                        {t("Active on Layers")}
                        <InfoTip
                          text={t(
                            "Configure which layers this processor is active on",
                          )}
                        />
                      </h3>
                    </div>
                    <div className="flex-shrink-0">
                      <Switch.Root
                        aria-label={t("Active on Layers")}
                        checked={activeLayersMode === "specific"}
                        onCheckedChange={(checked) =>
                          handleActiveLayersModeChange(
                            checked ? "specific" : "all",
                          )
                        }
                        className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                      >
                        <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                      </Switch.Root>
                    </div>
                  </div>

                  {activeLayersMode === "specific" && (
                    <div className="space-y-2 mt-4">
                      {layers.length > 0 ? (
                        layers.map((layer) => {
                          const isChecked =
                            (displayActiveLayers & (1 << layer.id)) !== 0;
                          return (
                            <label
                              key={layer.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-border)]/50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleLayerToggle(layer.id)}
                                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-electric)] focus:ring-[var(--color-electric)] focus:ring-offset-0 cursor-pointer"
                              />
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                {layer.name ||
                                  t("Layer {{id}}", { id: layer.id })}
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t("Loading layers...")}
                        </p>
                      )}
                    </div>
                  )}

                  {activeLayersMode === "all" && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-4">
                      {t("Processor is active on all layers")}
                    </p>
                  )}
                </div>

                {/* Scaling Setting */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                        {t("Scaling")}
                        <InfoTip
                          text={t("Adjust sensitivity from 0.01x to 10x")}
                        />
                      </h3>
                    </div>
                    <span className="text-lg font-mono text-[var(--color-electric)]">
                      {formatScalingValue(finalScalingValue)}x
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={t("Decrease scaling")}
                      onClick={() => handleScalingStepChange(-1)}
                      disabled={finalScalingValue <= SCALING_MIN}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <IconChevronLeft size={18} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <input
                        type="range"
                        aria-label={t("Scaling")}
                        min={0}
                        max={SCALING_STEPS}
                        step={1}
                        value={scalingSliderIndex}
                        onChange={(e) =>
                          handleScalingSliderChange(Number(e.target.value))
                        }
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer
                    bg-[var(--color-border)]
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[var(--color-electric)]
                    [&::-moz-range-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                      />
                      <div className="mt-2 flex justify-between text-xs text-[var(--color-text-muted)]">
                        <span>{formatScalingValue(SCALING_MIN)}x</span>
                        <span>{SCALING_MAX}x</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={t("Increase scaling")}
                      onClick={() => handleScalingStepChange(1)}
                      disabled={finalScalingValue >= SCALING_MAX}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <IconChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {/* Auto-Track Layer */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                        {t("Auto-Track Layer")}
                        <InfoTip
                          text={t(
                            "Auto-activate layer when the trackpad is in use",
                          )}
                        />
                      </h3>
                    </div>
                    <div className="flex-shrink-0">
                      <Switch.Root
                        aria-label={t("Auto-Track Layer")}
                        checked={displayTempLayerEnabled}
                        onCheckedChange={handleTempLayerEnabledChange}
                        className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                      >
                        <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                      </Switch.Root>
                    </div>
                  </div>

                  {displayTempLayerEnabled && (
                    <div className="space-y-4 mt-6">
                      {/* Layer Selection */}
                      <div>
                        <label className="text-sm text-[var(--color-text-secondary)] mb-3 block">
                          {t("Target Layer")}
                        </label>
                        {layers.length > 0 ? (
                          <select
                            value={displayTempLayerLayer}
                            onChange={(e) =>
                              handleTempLayerLayerChange(Number(e.target.value))
                            }
                            className="w-full px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm cursor-pointer hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-electric)] transition-colors"
                          >
                            {layers.map((layer) => (
                              <option key={layer.id} value={layer.id}>
                                {layer.name ||
                                  t("Layer {{id}}", { id: layer.id })}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {t("Loading layers...")}
                          </p>
                        )}
                      </div>

                      {/* Activation Delay */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-[var(--color-text-secondary)]">
                            {t("Activation Delay")}
                          </label>
                          <span className="text-sm font-mono text-[var(--color-electric)]">
                            {displayTempLayerActivationDelay}ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1000}
                          step={50}
                          value={displayTempLayerActivationDelay}
                          onChange={(e) =>
                            handleTempLayerActivationDelayChange(
                              Number(e.target.value),
                            )
                          }
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer
                      bg-[var(--color-border)]
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-[var(--color-electric)]
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                        />
                        <p className="text-xs text-[var(--color-text-muted)] mt-2">
                          {t(
                            "Delay before activating layer when the trackpad moves",
                          )}
                        </p>
                      </div>

                      {/* Deactivation Delay */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-[var(--color-text-secondary)]">
                            {t("Deactivation Delay")}
                          </label>
                          <span className="text-sm font-mono text-[var(--color-electric)]">
                            {displayTempLayerDeactivationDelay}ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={2000}
                          step={100}
                          value={displayTempLayerDeactivationDelay}
                          onChange={(e) =>
                            handleTempLayerDeactivationDelayChange(
                              Number(e.target.value),
                            )
                          }
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer
                      bg-[var(--color-border)]
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-[var(--color-electric)]
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                        />
                        <p className="text-xs text-[var(--color-text-muted)] mt-2">
                          {t(
                            "Delay before deactivating layer when the trackpad stops",
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Everything about which way the pad's movement points.
                    This was five cards — Axis Inversion, Code Mapping, Sensor
                    Rotation, Axis Snapping — each with a heading, a caption and
                    in two cases two switches carrying captions of their own:
                    a dozen lines of prose for what is really one question asked
                    six ways. They are one card now, with the four plain
                    switches first and the two that open into something below a
                    hairline. The explanations are not gone; they are on the
                    info icons, which is where an explanation you have already
                    read belongs. */}
                <div className="glass-card p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                      {t("Axes")}
                      <InfoTip
                        text={t("How movement on the pad reaches the computer")}
                      />
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-3">
                    <ToggleRow
                      label={t("Invert X Axis")}
                      info={t("Reverse horizontal movement direction")}
                      checked={displayXInvert}
                      onCheckedChange={handleXInvertChange}
                    />
                    <ToggleRow
                      label={t("Invert Y Axis")}
                      info={t("Reverse vertical movement direction")}
                      checked={displayYInvert}
                      onCheckedChange={handleYInvertChange}
                    />
                    <ToggleRow
                      label={t("XY-to-Scroll")}
                      info={t("Map X/Y movement to horizontal/vertical scroll")}
                      checked={displayXyToScrollEnabled}
                      onCheckedChange={handleXyToScrollEnabledChange}
                    />
                    <ToggleRow
                      label={t("XY-Swap")}
                      info={t("Swap X and Y axes")}
                      checked={displayXySwapEnabled}
                      onCheckedChange={handleXySwapEnabledChange}
                    />
                  </div>
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                          {t("Pad Rotation")}
                          <InfoTip
                            text={t(
                              "Rotate input for different mounting angles",
                            )}
                          />
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-mono text-[var(--color-electric)]">
                          {displayRotation}°
                        </span>
                        <div className="flex-shrink-0">
                          <Switch.Root
                            aria-label={t("Pad Rotation")}
                            checked={rotationEnabled}
                            onCheckedChange={handleRotationEnabledChange}
                            className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                          >
                            <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                          </Switch.Root>
                        </div>
                      </div>
                    </div>

                    {rotationEnabled && (
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={t("Decrease rotation")}
                          onClick={() =>
                            handleRotationChange(
                              displayRotation - ROTATION_STEP,
                            )
                          }
                          disabled={displayRotation <= ROTATION_MIN}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <IconChevronLeft size={18} />
                        </button>

                        {/* Slider centered at 0, ranging from -180 to +180 */}
                        <div className="min-w-0 flex-1">
                          <input
                            type="range"
                            aria-label={t("Rotation angle")}
                            min={ROTATION_MIN}
                            max={ROTATION_MAX}
                            step={ROTATION_STEP}
                            value={displayRotation}
                            onChange={(e) =>
                              handleRotationChange(Number(e.target.value))
                            }
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                        bg-[var(--color-border)]
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-[var(--color-electric)]
                        [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                          />
                          <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                            <span>-180°</span>
                            <span>0°</span>
                            <span>+180°</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={t("Increase rotation")}
                          onClick={() =>
                            handleRotationChange(
                              displayRotation + ROTATION_STEP,
                            )
                          }
                          disabled={displayRotation >= ROTATION_MAX}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <IconChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5">
                          {t("Axis Snapping")}
                          <InfoTip
                            text={t(
                              "Constrain movement to a single axis for precision scrolling",
                            )}
                          />
                        </h4>
                      </div>
                      <div className="flex-shrink-0">
                        <Switch.Root
                          aria-label={t("Axis Snapping")}
                          checked={
                            displayAxisSnapMode !==
                            AxisSnapMode.AXIS_SNAP_MODE_NONE
                          }
                          onCheckedChange={handleAxisSnapEnabledChange}
                          className="w-11 h-6 rounded-full relative data-[state=checked]:bg-[var(--color-electric)] bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors cursor-pointer"
                        >
                          <Switch.Thumb className="block w-5 h-5 rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5 will-change-transform bg-white border border-[var(--color-border)]" />
                        </Switch.Root>
                      </div>
                    </div>

                    {displayAxisSnapMode !==
                      AxisSnapMode.AXIS_SNAP_MODE_NONE && (
                      <div className="space-y-4 mt-6">
                        {/* Axis Selection */}
                        <div>
                          <label className="text-sm text-[var(--color-text-secondary)] mb-3 block">
                            {t("Snap Axis")}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() =>
                                handleAxisSnapModeChange(
                                  AxisSnapMode.AXIS_SNAP_MODE_Y,
                                )
                              }
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                displayAxisSnapMode ===
                                AxisSnapMode.AXIS_SNAP_MODE_Y
                                  ? "bg-[var(--color-electric)] text-white"
                                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                              }`}
                            >
                              {t("Y Axis (Vertical)")}
                            </button>
                            <button
                              onClick={() =>
                                handleAxisSnapModeChange(
                                  AxisSnapMode.AXIS_SNAP_MODE_X,
                                )
                              }
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                displayAxisSnapMode ===
                                AxisSnapMode.AXIS_SNAP_MODE_X
                                  ? "bg-[var(--color-electric)] text-white"
                                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                              }`}
                            >
                              {t("X Axis (Horizontal)")}
                            </button>
                          </div>
                        </div>
                        {/* Snap Threshold */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-[var(--color-text-secondary)]">
                              {t("Snap Threshold")}
                            </label>
                            <span className="text-sm font-mono text-[var(--color-electric)]">
                              {displayAxisSnapThreshold}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1000}
                            step={1}
                            value={displayAxisSnapThreshold}
                            onChange={(e) =>
                              handleAxisSnapThresholdChange(
                                Number(e.target.value),
                              )
                            }
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                        bg-[var(--color-border)]
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-[var(--color-electric)]
                        [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                          />
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            {t("Threshold for unsnapping from the locked axis")}
                          </p>
                        </div>

                        {/* Snap Timeout */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-[var(--color-text-secondary)]">
                              {t("Snap Timeout")}
                            </label>
                            <span className="text-sm font-mono text-[var(--color-electric)]">
                              {displayAxisSnapTimeout}ms
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={600}
                            step={50}
                            value={displayAxisSnapTimeout}
                            onChange={(e) =>
                              handleAxisSnapTimeoutChange(
                                Number(e.target.value),
                              )
                            }
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer
                        bg-[var(--color-border)]
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-[var(--color-electric)]
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--color-electric)]
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-[var(--color-electric)]
                        [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:shadow-[0_0_8px_var(--color-electric)]"
                          />
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            {t("Time window for threshold check")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Below the processor tuning, because it answers a different question:
            the tuning is how the pad feels, this is what a gesture does. Only
            drawn for a keyboard whose gesture positions we know — see
            gestures.ts for why that has to be checked rather than assumed. */}
        {gestures.length > 0 && (
          <div className="mt-4">
            <GestureSection
              gestures={gestures}
              layers={keymap.keymap?.layers ?? []}
              behaviors={keymap.behaviors}
              highlightedKeys={inputStream.highlightedKeys}
              liveViewOn={inputStream.isEnabled}
              keyboardLayout={keyboardLayoutContext.layout}
              onEdit={handleEditGesture}
              disabled={keymap.isLoading}
            />
          </div>
        )}
      </div>

      {/* Restore-a-version diff modal (opened from the versions dropdown) */}
      <VersionDiffModal
        {...versionHistory.diffModalProps}
        labeler={versionHistory.labeler}
      />

      {/* The same dialog the keymap editor uses. A gesture binding is an
          ordinary binding, so it deserves the whole behavior picker rather
          than a cut-down one that would quietly rule out a macro or a mod-tap. */}
      <KeycodeSelector
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSelect={handleGestureBindingSelect}
        currentBinding={editingBinding}
        behaviors={keymap.behaviors}
        layers={keymap.keymap?.layers ?? []}
        keyboardLayout={keyboardLayoutContext.layout}
      />
    </div>
  );
}
