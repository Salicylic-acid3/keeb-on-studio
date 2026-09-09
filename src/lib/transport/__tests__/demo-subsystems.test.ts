import {
  DEMO_SUBSYSTEMS,
  FAST_KEYMAP_IDENTIFIER,
  isDemoSubsystemEnabled,
  setDemoSubsystemEnabled,
} from "../demo-subsystems";
import { RUNTIME_SENSOR_ROTATE_IDENTIFIER } from "../demo-runtime-sensor-rotate";

beforeEach(() => {
  localStorage.clear();
});

describe("demo-subsystems", () => {
  it("starts each subsystem at its declared default", () => {
    for (const s of DEMO_SUBSYSTEMS) {
      expect(isDemoSubsystemEnabled(s.identifier)).toBe(s.defaultEnabled);
    }
  });

  it("leaves only fast-keymap and sensor-rotate off", () => {
    // The two deliberate exceptions to "on by default": fast-keymap is an
    // alternative code path the user opts into, and sensor-rotate would put an
    // encoder editor on a demo keyboard that has no encoder. Pinned here so
    // adding a third default-off subsystem has to be a decision, not a slip.
    const offByDefault = DEMO_SUBSYSTEMS.filter((s) => !s.defaultEnabled)
      .map((s) => s.identifier)
      .sort();
    expect(offByDefault).toEqual(
      [RUNTIME_SENSOR_ROTATE_IDENTIFIER, FAST_KEYMAP_IDENTIFIER].sort(),
    );
  });

  it("persists and honors an enable override for fast-keymap", () => {
    expect(isDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER)).toBe(false);
    setDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER, true);
    expect(isDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER)).toBe(true);
  });

  it("persists a disable override for a default-on subsystem", () => {
    const zmkSettings = DEMO_SUBSYSTEMS.find(
      (s) => s.label === "Settings",
    )!.identifier;
    expect(isDemoSubsystemEnabled(zmkSettings)).toBe(true);
    setDemoSubsystemEnabled(zmkSettings, false);
    expect(isDemoSubsystemEnabled(zmkSettings)).toBe(false);
  });

  it("has unique, contiguous indices matching the demo transport", () => {
    const indices = DEMO_SUBSYSTEMS.map((s) => s.index);
    expect(indices).toEqual(indices.map((_, i) => i));
    expect(new Set(DEMO_SUBSYSTEMS.map((s) => s.identifier)).size).toBe(
      DEMO_SUBSYSTEMS.length,
    );
  });
});
