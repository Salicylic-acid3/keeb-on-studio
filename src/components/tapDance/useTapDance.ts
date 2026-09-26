/**
 * Tap dance as the page sees it: slots, and the edits that change them.
 *
 * Everything a tap dance is lives in the keyboard's custom settings, one
 * array (`tap_danceN/taps`) and one integer (`tap_danceN/term`) per slot,
 * so this is a thin layer over useCustomSettings that names the slots and
 * hands the page the same verbs the macro and combo hooks do -- refresh,
 * save, discard, reset -- so the tab's one Save button can cover all three.
 *
 * Edits go to keyboard memory at once (the row you just set is what the
 * keyboard does right now); Save persists the whole tap dance section.
 */
import { useCallback, useMemo, useState } from "react";
import { useCustomSettings } from "../../hooks/useCustomSettings";
import { getBehaviorMetadata } from "../../lib/behaviorMetadata";
import {
  TAP_DANCE_SUBSYSTEM_ID,
  groupIntoSlots,
  type TapDanceSlot,
} from "../../lib/tapDance/slots";
import type {
  Setting,
  SettingScalarValue,
} from "../../proto/cormoran/zmk/custom_settings/custom_settings";
import type {
  BehaviorBinding,
  BehaviorDefinition,
} from "../../hooks/useKeymap";

/** The binding a tap currently holds, in the shape the picker speaks. */
export function tapBinding(
  setting: Setting | undefined,
): BehaviorBinding | null {
  const behavior =
    setting?.value?.arrayValue?.value?.behaviorValue ??
    setting?.value?.behaviorValue;
  if (!behavior) return null;
  return {
    behaviorId: behavior.behaviorId ?? 0,
    param1: behavior.param1 ?? 0,
    param2: behavior.param2 ?? 0,
  };
}

/** True when any of the slot's settings has an edit not yet persisted. */
export function slotHasUnsavedValue(slot: TapDanceSlot): boolean {
  return (
    slot.taps.some((tap) => tap.hasUnsavedValue) ||
    slot.holds.some((hold) => hold.hasUnsavedValue) ||
    Boolean(slot.term?.hasUnsavedValue)
  );
}

export interface UseTapDanceReturn {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  slots: TapDanceSlot[];
  /**
   * The keyboard's &none behavior, which is what a new tap holds, or null
   * when the keyboard has none (then no tap can be added).
   *
   * A new tap starts out doing nothing rather than copying the previous
   * one: an extra tap that silently repeats the last one would be worse
   * than an obviously empty row. But "nothing" has to be a real behavior.
   * The firmware validates every behavior value against its behavior table
   * and id 0 is not in it, so an all-zero placeholder is refused.
   */
  noneBehaviorId: number | null;
  /** True when a tap is unset: empty, or holding &none. */
  isUnset: (binding: BehaviorBinding | null) => boolean;
  hasUnsavedChanges: boolean;
  setTap: (
    slot: TapDanceSlot,
    tapIndex: number,
    binding: BehaviorBinding,
  ) => Promise<void>;
  /** What tap count `tapIndex + 1` does when the key stays held. */
  setHold: (
    slot: TapDanceSlot,
    tapIndex: number,
    binding: BehaviorBinding | null,
  ) => Promise<void>;
  addTap: (slot: TapDanceSlot) => Promise<void>;
  removeTap: (slot: TapDanceSlot) => Promise<void>;
  setTerm: (slot: TapDanceSlot, ms: number) => Promise<void>;
  refresh: () => Promise<void>;
  save: () => Promise<void>;
  discard: () => Promise<void>;
  resetToDefault: () => Promise<void>;
}

export function useTapDance(
  behaviors: Map<number, BehaviorDefinition>,
): UseTapDanceReturn {
  const settings = useCustomSettings({
    subsystemIdentifier: TAP_DANCE_SUBSYSTEM_ID,
  });
  // A removed tap leaves nothing behind to carry has_unsaved_value, so the
  // listing alone cannot say the section is dirty after "remove". This
  // remembers that an edit happened until save/discard/reset clear it.
  const [editedSinceSave, setEditedSinceSave] = useState(false);

  const section = settings.sections[0] ?? null;
  const slots = useMemo(
    () => groupIntoSlots(section?.settings ?? []),
    [section],
  );

  const noneBehaviorId = useMemo(() => {
    const variants = getBehaviorMetadata("none")?.displayNameVariants ?? [];
    for (const behavior of behaviors.values()) {
      if (variants.includes(behavior.displayName)) return behavior.id;
    }
    return null;
  }, [behaviors]);

  const isUnset = useCallback(
    (binding: BehaviorBinding | null) =>
      !binding || binding.behaviorId === noneBehaviorId,
    [noneBehaviorId],
  );

  const hasUnsavedChanges =
    editedSinceSave || slots.some((slot) => slotHasUnsavedValue(slot));

  const setTap = useCallback(
    async (slot: TapDanceSlot, tapIndex: number, binding: BehaviorBinding) => {
      const setting = slot.taps[tapIndex];
      if (!setting) return;
      setEditedSinceSave(true);
      await settings.writeSettingToMemory(setting, {
        arrayValue: {
          index: setting.value?.arrayValue?.index ?? tapIndex,
          size: slot.taps.length,
          value: {
            behaviorValue: {
              behaviorId: binding.behaviorId,
              param1: binding.param1,
              param2: binding.param2,
            },
          },
        },
      });
    },
    [settings],
  );

  // A tap and its hold action are one row: adding or removing a tap does
  // the same to the holds array, so the two stay the same length and the
  // firmware can index them together. Firmware without holds has no such
  // array, and pushing to it would be refused, so it is left alone there.
  const addTap = useCallback(
    async (slot: TapDanceSlot) => {
      if (noneBehaviorId === null) return;
      const empty: SettingScalarValue = {
        behaviorValue: { behaviorId: noneBehaviorId, param1: 0, param2: 0 },
      };
      setEditedSinceSave(true);
      await settings.pushBackArrayElement(slot.tapsRef, empty);
      if (slot.holdsSupported && slot.holds.length <= slot.taps.length) {
        await settings.pushBackArrayElement(slot.holdsRef, empty);
      }
    },
    [settings, noneBehaviorId],
  );

  const removeTap = useCallback(
    async (slot: TapDanceSlot) => {
      setEditedSinceSave(true);
      await settings.popBackArrayElement(slot.tapsRef);
      if (slot.holdsSupported && slot.holds.length >= slot.taps.length) {
        await settings.popBackArrayElement(slot.holdsRef);
      }
    },
    [settings],
  );

  const setHold = useCallback(
    async (
      slot: TapDanceSlot,
      tapIndex: number,
      binding: BehaviorBinding | null,
    ) => {
      // "No hold action" is spelled &none, which the firmware reads as
      // absent and falls back to holding the tap binding.
      const value = binding ?? {
        behaviorId: noneBehaviorId ?? 0,
        param1: 0,
        param2: 0,
      };
      const write = (setting: Setting, index: number, size: number) =>
        settings.writeSettingToMemory(setting, {
          arrayValue: {
            index,
            size,
            value: {
              behaviorValue: {
                behaviorId: value.behaviorId,
                param1: value.param1,
                param2: value.param2,
              },
            },
          },
        });
      setEditedSinceSave(true);
      const existing = slot.holds[tapIndex];
      if (existing) {
        await write(
          existing,
          existing.value?.arrayValue?.index ?? tapIndex,
          slot.holds.length,
        );
        return;
      }
      // Holds shorter than taps (a slot filled before holds existed): grow
      // the array up to this row, then the listing will carry the rest.
      if (noneBehaviorId === null) return;
      for (let i = slot.holds.length; i <= tapIndex; i++) {
        await settings.pushBackArrayElement(slot.holdsRef, {
          behaviorValue:
            i === tapIndex
              ? {
                  behaviorId: value.behaviorId,
                  param1: value.param1,
                  param2: value.param2,
                }
              : { behaviorId: noneBehaviorId, param1: 0, param2: 0 },
        });
      }
    },
    [settings, noneBehaviorId],
  );

  const setTerm = useCallback(
    async (slot: TapDanceSlot, ms: number) => {
      if (!slot.term) return;
      setEditedSinceSave(true);
      await settings.writeSettingToMemory(slot.term, { int32Value: ms });
    },
    [settings],
  );

  const refresh = useCallback(async () => {
    await settings.loadSettings();
  }, [settings]);

  const save = useCallback(async () => {
    if (!section) return;
    await settings.saveSection(section.customSubsystemIndex);
    setEditedSinceSave(false);
  }, [section, settings]);

  const discard = useCallback(async () => {
    if (!section) return;
    await settings.discardSection(section.customSubsystemIndex);
    setEditedSinceSave(false);
  }, [section, settings]);

  const resetToDefault = useCallback(async () => {
    if (!section) return;
    await settings.resetSection(section.customSubsystemIndex);
    setEditedSinceSave(false);
  }, [section, settings]);

  return {
    isAvailable: settings.isAvailable,
    isLoading: settings.isLoading,
    error: settings.error,
    slots,
    noneBehaviorId,
    isUnset,
    hasUnsavedChanges,
    setTap,
    setHold,
    addTap,
    removeTap,
    setTerm,
    refresh,
    save,
    discard,
    resetToDefault,
  };
}
