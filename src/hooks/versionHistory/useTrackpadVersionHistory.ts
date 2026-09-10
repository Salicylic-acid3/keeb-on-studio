/**
 * Trackpad tab version history: every runtime input processor's tuning.
 *
 * Input-processor RPCs are persistent write-throughs that take effect
 * immediately, so restoring a version is just a series of writes -- there is
 * no separate Save step for the tab to reconcile.
 *
 * This used to carry a second half: the PMW3610 sensor driver's custom
 * settings. That sensor is not on either supported keyboard, and the driver
 * that is (IQS9151) exposes no Studio RPC, so there is nothing to snapshot.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTabVersionHistory } from "../useTabVersionHistory";
import type { UseTabVersionHistoryReturn } from "../useTabVersionHistory";
import type {
  InputProcessor,
  UseRuntimeInputProcessorReturn,
} from "../useRuntimeInputProcessor";
import type { AxisSnapMode } from "../../proto/zmk/runtime_input_processor/runtime_input_processor";
import type { DiffLabeler } from "../../lib/versionHistory";

/** Bump when the payload shape below changes. */
export const TRACKPAD_SNAPSHOT_SCHEMA_VERSION = 1;
export const TRACKPAD_TAB_ID = "trackpad";

/** The writable half of an input processor, as stored in a snapshot. */
export type ProcessorSnapshot = {
  scaleMultiplier: number;
  scaleDivisor: number;
  rotationDegrees: number;
  tempLayerEnabled: boolean;
  tempLayerLayer: number;
  tempLayerActivationDelayMs: number;
  tempLayerDeactivationDelayMs: number;
  activeLayers: number;
  axisSnapMode: number;
  axisSnapThreshold: number;
  axisSnapTimeoutMs: number;
  xInvert: boolean;
  yInvert: boolean;
  xyToScrollEnabled: boolean;
  xySwapEnabled: boolean;
};

export type TrackpadSnapshot = {
  /** Processor settings keyed by processor id. */
  processors: Record<string, ProcessorSnapshot>;
};

/** Readable names for the processor fields, used by the diff modal. */
const PROCESSOR_FIELD_LABELS: Record<keyof ProcessorSnapshot, string> = {
  scaleMultiplier: "Sensitivity multiplier",
  scaleDivisor: "Sensitivity divisor",
  rotationDegrees: "Rotation (degrees)",
  tempLayerEnabled: "Temporary layer enabled",
  tempLayerLayer: "Temporary layer",
  tempLayerActivationDelayMs: "Temporary layer activation delay (ms)",
  tempLayerDeactivationDelayMs: "Temporary layer deactivation delay (ms)",
  activeLayers: "Active layers",
  axisSnapMode: "Axis snap mode",
  axisSnapThreshold: "Axis snap threshold",
  axisSnapTimeoutMs: "Axis snap timeout (ms)",
  xInvert: "Invert X",
  yInvert: "Invert Y",
  xyToScrollEnabled: "XY to scroll",
  xySwapEnabled: "Swap XY",
};

function toProcessorSnapshot(processor: InputProcessor): ProcessorSnapshot {
  return {
    scaleMultiplier: processor.scaleMultiplier,
    scaleDivisor: processor.scaleDivisor,
    rotationDegrees: processor.rotationDegrees,
    tempLayerEnabled: processor.tempLayerEnabled,
    tempLayerLayer: processor.tempLayerLayer,
    tempLayerActivationDelayMs: processor.tempLayerActivationDelayMs,
    tempLayerDeactivationDelayMs: processor.tempLayerDeactivationDelayMs,
    activeLayers: processor.activeLayers,
    axisSnapMode: processor.axisSnapMode,
    axisSnapThreshold: processor.axisSnapThreshold,
    axisSnapTimeoutMs: processor.axisSnapTimeoutMs,
    xInvert: processor.xInvert,
    yInvert: processor.yInvert,
    xyToScrollEnabled: processor.xyToScrollEnabled,
    xySwapEnabled: processor.xySwapEnabled,
  };
}

export interface UseTrackpadVersionHistoryOptions {
  inputProcessor: UseRuntimeInputProcessorReturn;
  /** True once the processors have been read. */
  isLoaded: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface UseTrackpadVersionHistoryReturn extends UseTabVersionHistoryReturn<TrackpadSnapshot> {
  labeler: DiffLabeler;
}

export function useTrackpadVersionHistory({
  inputProcessor,
  isLoaded,
  t,
}: UseTrackpadVersionHistoryOptions): UseTrackpadVersionHistoryReturn {
  // Declared before useTabVersionHistory so the refs are current by the time
  // its capture effect runs.
  const processorRef = useRef(inputProcessor);
  useEffect(() => {
    processorRef.current = inputProcessor;
  });

  const collect = useCallback(async (): Promise<TrackpadSnapshot | null> => {
    const processors = processorRef.current;
    if (!processors.isAvailable) return null;

    return {
      processors: Object.fromEntries(
        processors.processors.map((processor) => [
          String(processor.id),
          toProcessorSnapshot(processor),
        ]),
      ),
    };
  }, []);

  const apply = useCallback(async (snapshot: TrackpadSnapshot) => {
    const read = () => processorRef.current;

    for (const [rawId, wanted] of Object.entries(snapshot.processors)) {
      const id = Number(rawId);
      const have = read().processors.find((processor) => processor.id === id);
      // A processor that no longer exists (different firmware) is skipped
      // rather than guessed at.
      if (!have) continue;
      const current = toProcessorSnapshot(have);

      if (
        current.scaleMultiplier !== wanted.scaleMultiplier ||
        current.scaleDivisor !== wanted.scaleDivisor
      ) {
        await read().setScaling(
          id,
          wanted.scaleMultiplier,
          wanted.scaleDivisor,
        );
      }
      if (current.rotationDegrees !== wanted.rotationDegrees) {
        await read().setRotation(id, wanted.rotationDegrees);
      }
      if (current.tempLayerEnabled !== wanted.tempLayerEnabled) {
        await read().setTempLayerEnabled(id, wanted.tempLayerEnabled);
      }
      if (current.tempLayerLayer !== wanted.tempLayerLayer) {
        await read().setTempLayerLayer(id, wanted.tempLayerLayer);
      }
      if (
        current.tempLayerActivationDelayMs !== wanted.tempLayerActivationDelayMs
      ) {
        await read().setTempLayerActivationDelay(
          id,
          wanted.tempLayerActivationDelayMs,
        );
      }
      if (
        current.tempLayerDeactivationDelayMs !==
        wanted.tempLayerDeactivationDelayMs
      ) {
        await read().setTempLayerDeactivationDelay(
          id,
          wanted.tempLayerDeactivationDelayMs,
        );
      }
      if (current.activeLayers !== wanted.activeLayers) {
        await read().setActiveLayers(id, wanted.activeLayers);
      }
      if (current.axisSnapMode !== wanted.axisSnapMode) {
        await read().setAxisSnapMode(id, wanted.axisSnapMode as AxisSnapMode);
      }
      if (current.axisSnapThreshold !== wanted.axisSnapThreshold) {
        await read().setAxisSnapThreshold(id, wanted.axisSnapThreshold);
      }
      if (current.axisSnapTimeoutMs !== wanted.axisSnapTimeoutMs) {
        await read().setAxisSnapTimeout(id, wanted.axisSnapTimeoutMs);
      }
      if (current.xInvert !== wanted.xInvert) {
        await read().setXInvert(id, wanted.xInvert);
      }
      if (current.yInvert !== wanted.yInvert) {
        await read().setYInvert(id, wanted.yInvert);
      }
      if (current.xyToScrollEnabled !== wanted.xyToScrollEnabled) {
        await read().setXyToScrollEnabled(id, wanted.xyToScrollEnabled);
      }
      if (current.xySwapEnabled !== wanted.xySwapEnabled) {
        await read().setXySwapEnabled(id, wanted.xySwapEnabled);
      }
    }
  }, []);

  const history = useTabVersionHistory<TrackpadSnapshot>({
    tabId: TRACKPAD_TAB_ID,
    schemaVersion: TRACKPAD_SNAPSHOT_SCHEMA_VERSION,
    collect,
    apply,
    isLoaded,
    enabled: inputProcessor.isAvailable,
  });

  const processorNames = useMemo(
    () =>
      new Map(
        inputProcessor.processors.map((processor) => [
          String(processor.id),
          processor.name,
        ]),
      ),
    [inputProcessor.processors],
  );

  const labeler = useMemo<DiffLabeler>(
    () => ({
      label(path) {
        if (path[0] !== "processors") return null;
        const name =
          processorNames.get(path[1]) ?? t("Processor {{id}}", { id: path[1] });
        const field =
          PROCESSOR_FIELD_LABELS[path[2] as keyof ProcessorSnapshot];
        return field ? `${name} › ${t(field)}` : name;
      },
    }),
    [processorNames, t],
  );

  return { ...history, labeler };
}
