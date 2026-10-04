/**
 * Vial tap dances, shown through the ZMK side's tap dance cards.
 *
 * A Vial tap dance slot is four keycodes and a term: tap, hold, double tap,
 * tap-then-hold. The ZMK cards think in "taps" (what N taps send) with a
 * parallel "holds" list (what N taps then a hold send), so a Vial slot is a
 * ZMK slot with at most two taps:
 *
 *   taps  = [on_tap, on_double_tap]
 *   holds = [on_hold, on_tap_hold]
 *
 * The cards read settings in the custom-settings shape; this builds those
 * from the entries. Edits are staged in useVialKeyboard and written by the
 * page's Save, like everything else on the QMK side.
 */
import { useCallback, useMemo, useState } from "react";
import type { UseTapDanceReturn } from "../../components/tapDance/useTapDance";
import type { TapDanceSlot } from "../../lib/tapDance/slots";
import type { BehaviorBinding } from "../../hooks/useKeymap";
import type { Setting } from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type { VialTapDanceEntry } from "../lib/vial/protocol";
import {
  bindingToKeycode,
  keycodeToBinding,
  QMK_BEHAVIOR,
  QmkBridgeError,
} from "../lib/zmkBridge";
import { KC_NO } from "../lib/keycodes/qmkKeycode";
import type { UseVialKeyboard } from "./useVialKeyboard";

const MAX_TAPS = 2;
const TAP_FIELDS = ["onTap", "onDoubleTap"] as const;
const HOLD_FIELDS = ["onHold", "onTapHold"] as const;

function setting(
  key: string,
  value: Setting["value"],
  unsaved: boolean,
): Setting {
  return {
    customSubsystemIndex: 0,
    key,
    value,
    hasUnsavedValue: unsaved,
    source: 0,
  };
}

function behaviorSetting(key: string, code: number, unsaved: boolean): Setting {
  const b = keycodeToBinding(code);
  return setting(
    key,
    {
      behaviorValue: {
        behaviorId: b.behaviorId,
        param1: b.param1,
        param2: b.param2,
      },
    },
    unsaved,
  );
}

/** How many taps a slot shows: the last one with anything on it. */
function usedTaps(e: VialTapDanceEntry): number {
  if (e.onDoubleTap !== KC_NO || e.onTapHold !== KC_NO) return 2;
  if (e.onTap !== KC_NO || e.onHold !== KC_NO) return 1;
  return 0;
}

export function useVialTapDance(keyboard: UseVialKeyboard): UseTapDanceReturn {
  const { tapDances, savedTapDances, setTapDance } = keyboard;
  // Taps added but not yet given a key: an empty tap is all KC_NO, which
  // would otherwise make it vanish the moment it is added.
  const [shownTaps, setShownTaps] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo<TapDanceSlot[]>(
    () =>
      tapDances.map((e, index) => {
        const saved = savedTapDances[index];
        const count = Math.min(
          MAX_TAPS,
          Math.max(usedTaps(e), shownTaps[index] ?? 0),
        );
        const ref = { customSubsystemIndex: 0, key: `td${index}`, source: 0 };
        return {
          index,
          taps: TAP_FIELDS.slice(0, count).map((f) =>
            behaviorSetting(
              `td${index}/${f}`,
              e[f],
              !saved || e[f] !== saved[f],
            ),
          ),
          tapsRef: ref,
          holds: HOLD_FIELDS.slice(0, count).map((f) =>
            behaviorSetting(
              `td${index}/${f}`,
              e[f],
              !saved || e[f] !== saved[f],
            ),
          ),
          holdsRef: ref,
          holdsSupported: true,
          term: setting(
            `td${index}/term`,
            { int32Value: e.tappingTerm },
            !saved || e.tappingTerm !== saved.tappingTerm,
          ),
          maxTaps: MAX_TAPS,
        };
      }),
    [tapDances, savedTapDances, shownTaps],
  );

  const update = useCallback(
    (
      slot: TapDanceSlot,
      change: (e: VialTapDanceEntry) => VialTapDanceEntry,
    ) => {
      const current = tapDances[slot.index];
      if (current) setTapDance(slot.index, change({ ...current }));
    },
    [tapDances, setTapDance],
  );

  const toKeycode = useCallback(
    (binding: BehaviorBinding | null): number | null => {
      if (!binding) return KC_NO;
      try {
        setError(null);
        return bindingToKeycode(binding);
      } catch (err) {
        setError(err instanceof QmkBridgeError ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  return {
    isAvailable: tapDances.length > 0,
    isLoading: false,
    error,
    slots,
    noneBehaviorId: QMK_BEHAVIOR.none,
    isUnset: (binding) => !binding || binding.behaviorId === QMK_BEHAVIOR.none,
    hasUnsavedChanges: tapDances.some(
      (e, i) => JSON.stringify(e) !== JSON.stringify(savedTapDances[i]),
    ),
    setTap: async (slot, tapIndex, binding) => {
      const code = toKeycode(binding);
      if (code === null || tapIndex >= MAX_TAPS) return;
      update(slot, (e) => ({ ...e, [TAP_FIELDS[tapIndex]]: code }));
    },
    setHold: async (slot, tapIndex, binding) => {
      const code = toKeycode(binding);
      if (code === null || tapIndex >= MAX_TAPS) return;
      update(slot, (e) => ({ ...e, [HOLD_FIELDS[tapIndex]]: code }));
    },
    addTap: async (slot) => {
      setShownTaps((prev) => ({
        ...prev,
        [slot.index]: Math.min(MAX_TAPS, slot.taps.length + 1),
      }));
    },
    removeTap: async (slot) => {
      const last = slot.taps.length - 1;
      if (last < 0) return;
      update(slot, (e) => ({
        ...e,
        [TAP_FIELDS[last]]: KC_NO,
        [HOLD_FIELDS[last]]: KC_NO,
      }));
      setShownTaps((prev) => ({ ...prev, [slot.index]: last }));
    },
    setTerm: async (slot, ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return;
      update(slot, (e) => ({ ...e, tappingTerm: Math.round(ms) }));
    },
    refresh: async () => {
      setShownTaps({});
      await keyboard.reload();
    },
    save: async () => {
      await keyboard.saveChanges();
    },
    discard: async () => {
      setShownTaps({});
      keyboard.discardChanges();
    },
    resetToDefault: async () => {
      tapDances.forEach((e, index) =>
        setTapDance(index, {
          onTap: KC_NO,
          onHold: KC_NO,
          onDoubleTap: KC_NO,
          onTapHold: KC_NO,
          tappingTerm: e.tappingTerm,
        }),
      );
      setShownTaps({});
    },
  };
}
