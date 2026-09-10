/**
 * Saved keymaps — the record format.
 *
 * A saved keymap is the user's own copy of a keymap, named and kept until they
 * delete it. It is deliberately NOT tied to a device: someone can lay out a
 * keymap in demo mode before their keyboard arrives, and load it onto the real
 * board weeks later. That requirement is what shapes everything below.
 *
 * The same format is what a shared keymap will travel in, so it has to survive
 * leaving this browser.
 */
import type { BehaviorBinding } from "../../hooks/useKeymap";

/** Bumped whenever the shape below changes. Older records are hidden, not deleted. */
export const SAVED_KEYMAP_SCHEMA_VERSION = 1;

export const NAME_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 280;

/**
 * A binding as stored: the behavior is referenced by its index into the
 * record's `behaviors` table rather than by the device's own behavior id.
 *
 * Behavior ids are local to a device. On real firmware they are a CRC of the
 * behavior's name and so happen to be stable, but demo mode hands out its own
 * numbering -- so a keymap saved in demo mode and loaded onto a keyboard would
 * land on whatever behaviors those numbers happened to mean. Storing the name
 * and resolving it against the target keeps that honest, and the table keeps
 * the record small enough to put in a URL later.
 */
export type StoredBinding = [
  behaviorIndex: number,
  param1: number,
  param2: number,
];

export interface StoredLayer {
  name: string;
  bindings: StoredBinding[];
}

/**
 * What the keymap was built for.
 *
 * `keyCount` is the compatibility test -- a keymap has one binding per key
 * position, so a mismatch means the bindings would land on the wrong keys.
 * `layoutName` is shown to the user and used to warn when two keyboards happen
 * to share a key count.
 */
export interface SavedKeymapTarget {
  layoutName: string;
  keyCount: number;
}

export interface SavedKeymapPayload {
  schemaVersion: number;
  name: string;
  description: string;
  target: SavedKeymapTarget;
  /** Behavior display names, deduped; `StoredBinding[0]` indexes into this. */
  behaviors: string[];
  layers: StoredLayer[];
  /** True when it was captured in demo mode, so the list can say so. */
  fromDemo: boolean;
}

export interface SavedKeymap extends SavedKeymapPayload {
  id: number;
  createdAt: number;
  updatedAt: number;
}

export type NewSavedKeymap = SavedKeymapPayload & {
  createdAt: number;
  updatedAt: number;
};

export interface SavedKeymapBackend {
  list(): Promise<SavedKeymap[]>;
  add(record: NewSavedKeymap): Promise<SavedKeymap>;
  update(
    id: number,
    patch: Partial<SavedKeymapPayload>,
  ): Promise<SavedKeymap | null>;
  remove(id: number): Promise<void>;
}

/** How a saved keymap relates to the keyboard currently connected. */
export type Compatibility =
  | { kind: "match" }
  /** Same shape, different keyboard name -- loadable, but worth saying. */
  | { kind: "different-layout"; savedFor: string; connected: string }
  | { kind: "key-count"; savedFor: number; connected: number }
  /** Saved by a newer version of the app than the one running. */
  | { kind: "schema" };

export function compatibilityOf(
  saved: Pick<SavedKeymap, "target" | "schemaVersion">,
  connected: { layoutName: string; keyCount: number } | null,
): Compatibility {
  if (saved.schemaVersion !== SAVED_KEYMAP_SCHEMA_VERSION) {
    return { kind: "schema" };
  }
  if (!connected) return { kind: "match" };
  if (saved.target.keyCount !== connected.keyCount) {
    return {
      kind: "key-count",
      savedFor: saved.target.keyCount,
      connected: connected.keyCount,
    };
  }
  if (saved.target.layoutName !== connected.layoutName) {
    return {
      kind: "different-layout",
      savedFor: saved.target.layoutName,
      connected: connected.layoutName,
    };
  }
  return { kind: "match" };
}

/** Whether a record can be written to the connected keyboard at all. */
export function isLoadable(compatibility: Compatibility): boolean {
  return (
    compatibility.kind === "match" || compatibility.kind === "different-layout"
  );
}

/**
 * Build the stored form from what the keymap tab holds.
 *
 * `behaviorName` looks a binding's behavior up in the device's own table; a
 * binding whose behavior the device does not describe is stored with an empty
 * name, which load treats as unresolvable rather than guessing.
 */
export function toPayload(input: {
  name: string;
  description: string;
  target: SavedKeymapTarget;
  fromDemo: boolean;
  layers: Array<{ name: string; bindings: BehaviorBinding[] }>;
  behaviorName: (behaviorId: number) => string;
}): SavedKeymapPayload {
  const behaviors: string[] = [];
  const indexOf = new Map<string, number>();

  const layers: StoredLayer[] = input.layers.map((layer) => ({
    name: layer.name,
    bindings: layer.bindings.map((binding): StoredBinding => {
      const behaviorName = input.behaviorName(binding.behaviorId);
      let index = indexOf.get(behaviorName);
      if (index === undefined) {
        index = behaviors.length;
        behaviors.push(behaviorName);
        indexOf.set(behaviorName, index);
      }
      return [index, binding.param1, binding.param2];
    }),
  }));

  return {
    schemaVersion: SAVED_KEYMAP_SCHEMA_VERSION,
    name: input.name.slice(0, NAME_MAX_LENGTH),
    description: input.description.slice(0, DESCRIPTION_MAX_LENGTH),
    target: input.target,
    behaviors,
    layers,
    fromDemo: input.fromDemo,
  };
}

/** A binding that could not be matched to a behavior on the target keyboard. */
export interface UnresolvedBinding {
  layerIndex: number;
  keyPosition: number;
  behaviorName: string;
}

/**
 * The distinct behaviors a load could not match, in the order they were met.
 *
 * A count on its own ("3 keys were left alone") leaves the user to work out
 * which behavior is missing by comparing two keyboards key by key. The name is
 * the whole answer, and it is already in hand.
 */
export function unresolvedBehaviorNames(
  unresolved: UnresolvedBinding[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { behaviorName } of unresolved) {
    const name = behaviorName.trim();
    // A behavior the device never described has no name worth showing. The
    // count still covers it, so nothing is hidden -- only unnamed.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export interface ResolvedKeymap {
  /**
   * One entry per key position, in position order. `null` marks a binding the
   * connected keyboard has no behavior for -- kept in place rather than
   * dropped, because a binding's index IS its key position and closing the gap
   * would shift every key after it.
   */
  layers: Array<{ name: string; bindings: Array<BehaviorBinding | null> }>;
  /**
   * The `null`s above, listed. The caller can say which keys it is about to
   * leave alone before it writes anything.
   */
  unresolved: UnresolvedBinding[];
}

/**
 * Turn a stored record back into bindings for the connected keyboard, matching
 * behaviors by name.
 */
export function resolveForDevice(
  record: SavedKeymapPayload,
  behaviorIdByName: Map<string, number>,
): ResolvedKeymap {
  const unresolved: UnresolvedBinding[] = [];

  const layers = record.layers.map((layer, layerIndex) => ({
    name: layer.name,
    bindings: layer.bindings.map(
      (
        [behaviorIndex, param1, param2],
        keyPosition,
      ): BehaviorBinding | null => {
        const behaviorName = record.behaviors[behaviorIndex] ?? "";
        const behaviorId = behaviorIdByName.get(behaviorName);
        if (behaviorId === undefined) {
          unresolved.push({ layerIndex, keyPosition, behaviorName });
          return null;
        }
        return { behaviorId, param1, param2 };
      },
    ),
  }));

  return { layers, unresolved };
}
