/**
 * Demo-mode custom-subsystem registry + per-subsystem enable/disable toggles.
 *
 * The demo transport advertises a fixed set of custom subsystems. In demo mode
 * the Subsystems tab lets the user turn each one on/off to exercise different
 * app code paths (most importantly: turning the read-only `cormoran__fast_keymap`
 * subsystem on to test the fast keymap-loading path vs. the official protocol).
 *
 * Overrides are persisted in localStorage. They only take effect on the next
 * connect, since the app fetches the subsystem list once per connection.
 */
import { BLE_MANAGEMENT_IDENTIFIER } from "./demo-ble";
import { SETTINGS_IDENTIFIER } from "./demo-settings";
import { DEVICE_INFO_IDENTIFIER } from "./demo-device-info";
import { WATCHDOG_IDENTIFIER } from "./demo-watchdog";
import { KSCAN_DIAGNOSTICS_IDENTIFIER } from "./demo-kscan-diagnostics";
import { RUNTIME_INPUT_PROCESSOR_IDENTIFIER } from "./demo-runtime-input-processor";
import { RUNTIME_SENSOR_ROTATE_IDENTIFIER } from "./demo-runtime-sensor-rotate";
import { CUSTOM_SETTINGS_IDENTIFIER } from "./demo-custom-settings";
import { RUNTIME_COMBO_IDENTIFIER } from "./demo-runtime-combo";
import { RUNTIME_MACRO_IDENTIFIER } from "./demo-runtime-macro";
import { PHYSICAL_LAYOUTS_IDENTIFIER } from "./demo-physical-layouts";
import { INPUT_STREAM_IDENTIFIER } from "./demo-input-stream";
import { OS_DETECTION_IDENTIFIER } from "./demo-os-detection";
import { DEFAULT_LAYER_IDENTIFIER } from "./demo-default-layer";
import { TAP_DANCE_IDENTIFIER } from "./demo-tap-dance";

/** Identifier the fast-keymap module registers on the device. */
export const FAST_KEYMAP_IDENTIFIER = "cormoran__fast_keymap";

/**
 * Identifier the zephyr-setting-expose module registers on the device.
 * Keeb-On! Studio has no dedicated UI for it; it ships its own external web UI, so
 * the Subsystems tab surfaces it as an external-link card (see
 * SETTING_EXPOSE_UI_URL).
 */
export const SETTING_EXPOSE_IDENTIFIER = "zmk__setting_expose";

/** External web UI published by the zephyr-setting-expose firmware module. */
export const SETTING_EXPOSE_UI_URL =
  "https://cormoran.github.io/zmk-feature-zephyr-setting-expose/";

/** localStorage key holding `{ [identifier]: boolean }` overrides. */
const OVERRIDES_KEY = "dya-studio-demo-subsystem-overrides";

export interface DemoSubsystemInfo {
  index: number;
  identifier: string;
  /** Short human label for the toggle UI. */
  label: string;
  /** Whether it's enabled unless the user overrides it. */
  defaultEnabled: boolean;
}

// Canonical list, indices matching the demo transport's subsystem indices.
// Everything defaults on EXCEPT fast-keymap (so the demo keeps using the
// official keymap protocol until the user opts into the fast path) and
// sensor-rotate (no supported keyboard has an encoder).
export const DEMO_SUBSYSTEMS: DemoSubsystemInfo[] = [
  {
    index: 0,
    identifier: BLE_MANAGEMENT_IDENTIFIER,
    label: "BLE Management",
    defaultEnabled: true,
  },
  {
    index: 1,
    identifier: SETTINGS_IDENTIFIER,
    label: "Settings",
    defaultEnabled: true,
  },
  {
    index: 2,
    identifier: DEVICE_INFO_IDENTIFIER,
    label: "Device Info",
    defaultEnabled: true,
  },
  {
    index: 3,
    identifier: RUNTIME_INPUT_PROCESSOR_IDENTIFIER,
    label: "Runtime Input Processor",
    defaultEnabled: true,
  },
  {
    // Off by default: neither keyboard this app supports has a rotary encoder,
    // so a demo that advertised sensor rotation would put an encoder editor on
    // a keyboard with nothing to rotate. The handler stays, and the toggle
    // still turns it on, so the code path is still reachable for testing.
    index: 4,
    identifier: RUNTIME_SENSOR_ROTATE_IDENTIFIER,
    label: "Runtime Sensor Rotate",
    defaultEnabled: false,
  },
  {
    index: 5,
    identifier: RUNTIME_COMBO_IDENTIFIER,
    label: "Runtime Combo",
    defaultEnabled: true,
  },
  {
    index: 6,
    identifier: RUNTIME_MACRO_IDENTIFIER,
    label: "Runtime Macro",
    defaultEnabled: true,
  },
  {
    index: 7,
    identifier: PHYSICAL_LAYOUTS_IDENTIFIER,
    label: "Physical Layouts",
    defaultEnabled: true,
  },
  {
    index: 8,
    identifier: INPUT_STREAM_IDENTIFIER,
    label: "Input Stream",
    defaultEnabled: true,
  },
  {
    index: 9,
    identifier: CUSTOM_SETTINGS_IDENTIFIER,
    label: "Custom Settings",
    defaultEnabled: true,
  },
  {
    index: 10,
    identifier: WATCHDOG_IDENTIFIER,
    label: "Watchdog",
    defaultEnabled: true,
  },
  {
    index: 11,
    identifier: KSCAN_DIAGNOSTICS_IDENTIFIER,
    label: "KScan Diagnostics",
    defaultEnabled: true,
  },
  {
    index: 12,
    identifier: OS_DETECTION_IDENTIFIER,
    label: "OS Detection",
    defaultEnabled: true,
  },
  {
    index: 13,
    identifier: DEFAULT_LAYER_IDENTIFIER,
    label: "Default Layer",
    defaultEnabled: true,
  },
  {
    index: 14,
    identifier: FAST_KEYMAP_IDENTIFIER,
    label: "Fast Keymap",
    defaultEnabled: false,
  },
  {
    index: 15,
    identifier: SETTING_EXPOSE_IDENTIFIER,
    label: "Setting Expose",
    defaultEnabled: true,
  },
  {
    // On by default: a 30% keymap is the case tap dance exists for, and
    // someone deciding whether one can carry the keys they need has to be
    // able to try it before there is a keyboard to connect.
    index: 16,
    identifier: TAP_DANCE_IDENTIFIER,
    label: "Runtime Tap Dance",
    defaultEnabled: true,
  },
];

function readOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, boolean>;
    }
  } catch {
    // Ignore storage/parse errors — fall back to defaults.
  }
  return {};
}

/** Whether a demo subsystem should be advertised/served, honoring overrides. */
export function isDemoSubsystemEnabled(identifier: string): boolean {
  const overrides = readOverrides();
  if (identifier in overrides) {
    return overrides[identifier];
  }
  const info = DEMO_SUBSYSTEMS.find((s) => s.identifier === identifier);
  return info?.defaultEnabled ?? true;
}

/** Persist an enable/disable override for a demo subsystem. */
export function setDemoSubsystemEnabled(
  identifier: string,
  enabled: boolean,
): void {
  try {
    const overrides = readOverrides();
    overrides[identifier] = enabled;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors (private browsing / quota).
  }
}
