/**
 * Human-readable names for custom Studio RPC subsystems.
 *
 * A subsystem identifier (`cormoran__default_layer`, `zmk__settings`, ...) is
 * the wire-level contract between the firmware module and this app: it is
 * defined inside the module's own source, so it cannot be renamed on our side
 * without breaking compatibility with the module. But it is also what the
 * advanced-settings pane was showing as a section heading, which reads as
 * internal plumbing rather than a setting group -- and puts another project's
 * name in front of the user for no reason.
 *
 * So the identifier stays on the wire and the label is applied at display
 * time. Unknown identifiers fall back to the raw string: a module we have
 * never heard of should still show up, just unlabelled.
 */
import type { TranslationParams } from "../i18n/translations";

type TranslateFn = (key: string, params?: TranslationParams) => string;

/**
 * Identifier -> translation key. The values are English display names, which
 * `t()` resolves through the ja/zh dictionaries and passes through unchanged
 * for English.
 */
const SUBSYSTEM_LABELS: Record<string, string> = {
  // cormoran's modules
  cormoran_ble: "BLE Connections",
  cormoran_custom_settings: "Stored Settings",
  cormoran_rip: "Input Processors",
  cormoran_rsr: "Sensor Rotation",
  cormoran__default_layer: "Default Layer",
  cormoran__devtool: "Developer Tools",
  cormoran__fast_keymap: "Fast Keymap",
  cormoran__kscan_diagnostics: "Key Scan Diagnostics",
  cormoran__os_detection: "OS Detection",
  cormoran__physical_layouts: "Physical Layouts",
  cormoran__runtime_combo: "Combos",
  cormoran__runtime_macro: "Macros",
  cormoran__watchdog: "Watchdog",
  // Keeb-On!'s own modules
  keebon__battery: "Battery",
  keebon__runtime_tap_dance: "Tap Dance",
  keebon__trackpad: "Trackpad",
  // upstream-shaped identifiers
  zmk__device_info: "Device Info",
  zmk__input_stream: "Input Stream",
  zmk__physical_layouts: "Physical Layouts",
  zmk__setting_expose: "Zephyr Settings",
  zmk__settings: "Device Settings",
};

/** Whether `identifier` has a display name (i.e. is a module we know about). */
export function hasSubsystemLabel(identifier: string): boolean {
  return identifier in SUBSYSTEM_LABELS;
}

/**
 * Display name for `identifier`, or the identifier itself when unknown.
 *
 * Callers that show the label should keep the raw identifier visible nearby
 * (smaller, muted): it is what module documentation and bug reports refer to,
 * so hiding it entirely would make troubleshooting harder.
 */
export function subsystemLabel(identifier: string, t: TranslateFn): string {
  const label = SUBSYSTEM_LABELS[identifier];
  return label ? t(label) : identifier;
}
