/**
 * Demo Device Info Custom Subsystem Handler
 *
 * Provides mock device/build/hardware diagnostic info for demo mode.
 */

import {
  type Request,
  type Response,
} from "../../proto/zmk/device_info/device_info";

export const DEVICE_INFO_IDENTIFIER = "zmk__device_info";

// Power-On reset cause bit (see RESET_CAUSE_LABELS in DeviceInfoSection.tsx).
const RESET_CAUSE_POWER_ON = 1 << 3;

export class DeviceInfoHandler {
  private startedAtMs = Date.now();

  process(request: Request): Response {
    if (request.getDeviceInfo !== undefined) {
      return {
        deviceInfo: {
          // Two rules for the numbers below. Where the real ErgoTrack reports
          // a fixed value, the demo reports the same one -- this is the
          // troubleshooting tab, and a demo that shows different values than
          // the hardware teaches people to expect the wrong thing. Where the
          // value is a build identity that only a real build has, the demo
          // says "demo" rather than inventing a plausible hash: the keyboard
          // calls itself Keeb-On! Demo Keyboard, and its build should agree.
          build: {
            zmkVersion: "3.5.0-demo",
            zmkDirty: false,
            zmkConfigVersion: "demo",
            zmkConfigDirty: false,
            moduleVersion: "demo-0001",
            moduleDirty: false,
            // config/west.yml pins zephyr v4.1.0+zmk-fixes+nrf-half-duplex-uart
            zephyrVersion: "4.1.0",
            buildTimestamp: "2026-07-01T09:00:00Z",
            // CONFIG_BOARD, which is the board -- not the shield. ErgoTrack is
            // shield clickboard_ergotrack_right on board acdb.
            board: "acdb",
          },
          hardware: {
            deviceId: "KEEBDEMO0001",
            resetCause: RESET_CAUSE_POWER_ON,
            flashSizeKb: 1024,
            sramSizeKb: 256,
          },
          zephyrDevices: [
            { name: "kscan0", ready: true },
            { name: "iqs9151@0", ready: true },
            { name: "iqs9151@1", ready: true },
            { name: "ble_hci", ready: true },
            { name: "gpio@0", ready: true },
            { name: "i2c@0", ready: true },
          ],
          zmkConfig: {
            // clickboard_ergotrack.dtsi. The diagnostics module wraps the
            // kscan driver; it does not replace what the node is.
            kscanCompatible: "zmk,kscan-gpio-matrix",
            bleEnabled: true,
            bleProfileCount: 5,
            usbEnabled: true,
            splitEnabled: true,
            splitRole: "central",
            displayEnabled: false,
            rgbUnderglowEnabled: false,
            backlightEnabled: false,
            batteryLevelEnabled: true,
          },
          runtime: {
            uptimeMs: Date.now() - this.startedAtMs,
          },
        },
      };
    }

    return { error: { message: "Not implemented" } };
  }
}
