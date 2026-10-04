/**
 * Plain helpers for Vial combos and key overrides: what "empty" and "new"
 * look like, and how to tell a slot is in use.
 */
import type { VialComboEntry, VialKeyOverrideEntry } from "./vial/protocol";
import { KC_NO } from "./keycodes/qmkKeycode";

export const EMPTY_COMBO: VialComboEntry = { input: [0, 0, 0, 0], output: 0 };

export function comboIsUsed(e: VialComboEntry): boolean {
  return e.output !== KC_NO || e.input.some((k) => k !== KC_NO);
}

/** quantum/vial.h vial_ko_option_* */
export const KO_OPTION = {
  activationTriggerDown: 1 << 0,
  activationRequiredModDown: 1 << 1,
  activationNegativeModUp: 1 << 2,
  oneMod: 1 << 3,
  noReregisterTrigger: 1 << 4,
  noUnregisterOnOtherKeyDown: 1 << 5,
  enabled: 1 << 7,
} as const;

export const ALL_LAYERS = 0xffff;

/** What Vial itself fills a new key override with. */
export const NEW_KEY_OVERRIDE: VialKeyOverrideEntry = {
  trigger: KC_NO,
  replacement: KC_NO,
  layers: ALL_LAYERS,
  triggerMods: 0,
  negativeModMask: 0,
  suppressedMods: 0,
  options:
    KO_OPTION.enabled |
    KO_OPTION.activationTriggerDown |
    KO_OPTION.activationRequiredModDown |
    KO_OPTION.activationNegativeModUp,
};

/** A deleted key override: all zero, as the firmware starts them. */
export const EMPTY_KEY_OVERRIDE: VialKeyOverrideEntry = {
  trigger: KC_NO,
  replacement: KC_NO,
  layers: 0,
  triggerMods: 0,
  negativeModMask: 0,
  suppressedMods: 0,
  options: 0,
};

export function keyOverrideIsUsed(e: VialKeyOverrideEntry): boolean {
  return e.trigger !== KC_NO || e.replacement !== KC_NO;
}
