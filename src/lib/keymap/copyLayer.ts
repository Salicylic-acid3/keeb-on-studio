/**
 * Filling Alt Base from Base.
 *
 * Alt Base exists so the same keyboard can behave differently on a second OS
 * (it is what the trackpad's per-OS settings key off, `layers = <1>`). Only a
 * few keys actually differ, but the layer starts as transparent all the way
 * across, so building it means re-entering the whole base layout by hand
 * before changing the handful that matter.
 *
 * The copy is offered on that layer alone. Every other layer is transparent
 * on purpose -- a symbol or function layer that fell through to the base
 * letters would be wrong, not convenient -- so a general "copy this layer
 * onto that one" would mostly be a way to ruin a layer by accident.
 *
 * The planning lives here rather than in the component because two of its
 * decisions are worth testing directly: which keys are written at all (each
 * one is a separate round trip, and over BLE that is the difference between
 * a moment and a wait), and how many of them destroy something the user put
 * there (which is what the confirmation has to be honest about).
 */
import type {
  BehaviorBinding,
  BehaviorDefinition,
} from "../../hooks/useKeymap";

/** The layer copied from. */
export const BASE_LAYER_NAME = "Base";

/**
 * The layer copied to.
 *
 * Matched by name because that is what identifies it -- Alt Base is the
 * second layer on ClickBoard ErgoTrack today, but layer 1 means nothing in
 * particular on a keyboard that does not have one. The cost is that renaming
 * the layer in Studio takes the button away; that is visible and reversible,
 * where a position-based rule would silently offer the copy on some unrelated
 * layer of a future keyboard.
 */
export const ALT_BASE_LAYER_NAME = "Alt Base";

/** Display names ZMK uses for the transparent behavior. */
const TRANSPARENT_NAMES = ["Trans", "Transparent"];

export interface CopyableLayer {
  id: number;
  name: string;
  bindings: BehaviorBinding[];
}

export interface CopyWrite {
  keyPosition: number;
  binding: BehaviorBinding;
}

export interface CopyPlan {
  /** The keys to write, in key order. Keys already matching are left out. */
  writes: CopyWrite[];
  /**
   * How many of those writes replace something that is not transparent --
   * i.e. work the user did on this layer that the copy would destroy.
   */
  overwrites: number;
  /** Keys already holding what Base holds. Nothing is sent for these. */
  unchanged: number;
}

function sameBinding(a: BehaviorBinding | undefined, b: BehaviorBinding) {
  return (
    a !== undefined &&
    a.behaviorId === b.behaviorId &&
    a.param1 === b.param1 &&
    a.param2 === b.param2
  );
}

/** Whether the copy should be offered while this layer is selected. */
export function isAltBaseLayer(layer: { name?: string } | null | undefined) {
  return (layer?.name ?? "") === ALT_BASE_LAYER_NAME;
}

/** The layer to copy from: the one named Base, else the first. */
export function findBaseLayer<T extends { name?: string }>(
  layers: readonly T[],
): T | null {
  return (
    layers.find((layer) => (layer.name ?? "") === BASE_LAYER_NAME) ??
    layers[0] ??
    null
  );
}

/**
 * The transparent behavior's id on this device, or null if it has none.
 *
 * Behavior ids are device-local, so the only stable handle is the name --
 * the same reason saved keymaps store behaviors by name rather than id.
 */
export function findTransparentBehaviorId(
  behaviors: Map<number, BehaviorDefinition>,
): number | null {
  for (const [id, behavior] of behaviors) {
    if (TRANSPARENT_NAMES.includes(behavior.displayName ?? "")) {
      return id;
    }
  }
  return null;
}

/**
 * What copying Base onto this layer would do.
 *
 * @param transparentBehaviorId the device's transparent behavior, or null when
 *   it has none. Null makes every replaced key count as an overwrite, which
 *   errs toward asking the user rather than quietly discarding their work.
 */
export function planCopyFromBase(
  base: CopyableLayer,
  target: CopyableLayer,
  transparentBehaviorId: number | null,
): CopyPlan {
  const writes: CopyWrite[] = [];
  let overwrites = 0;
  let unchanged = 0;

  // A layer only has the key positions it has. Writing past the end would be
  // rejected per key by the device, so stop where the shorter one stops.
  const keyCount = Math.min(base.bindings.length, target.bindings.length);

  for (let keyPosition = 0; keyPosition < keyCount; keyPosition++) {
    const source = base.bindings[keyPosition];
    if (!source) continue;

    const current = target.bindings[keyPosition];
    if (sameBinding(current, source)) {
      unchanged++;
      continue;
    }

    // "Transparent" is the layer's empty state, so replacing it destroys
    // nothing. Anything else was put there deliberately.
    const isEmpty =
      current === undefined ||
      (transparentBehaviorId !== null &&
        current.behaviorId === transparentBehaviorId);
    if (!isEmpty) {
      overwrites++;
    }

    writes.push({ keyPosition, binding: { ...source } });
  }

  return { writes, overwrites, unchanged };
}
