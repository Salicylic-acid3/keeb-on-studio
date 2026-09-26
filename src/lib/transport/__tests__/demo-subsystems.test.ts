import {
  DEMO_SUBSYSTEMS,
  FAST_KEYMAP_IDENTIFIER,
  SETTING_EXPOSE_IDENTIFIER,
  isDemoSubsystemEnabled,
} from "../demo-subsystems";

describe("demo subsystems", () => {
  it("advertises what the supported keyboards carry", () => {
    // The demo is meant to look like a connected ErgoTrack: fast keymap on
    // (its firmware has it), setting-expose off (no supported keyboard has
    // that module), and nothing toggled from the UI.
    for (const s of DEMO_SUBSYSTEMS) {
      expect(isDemoSubsystemEnabled(s.identifier)).toBe(s.defaultEnabled);
    }
    expect(isDemoSubsystemEnabled(FAST_KEYMAP_IDENTIFIER)).toBe(true);
    expect(isDemoSubsystemEnabled(SETTING_EXPOSE_IDENTIFIER)).toBe(false);
  });

  it("treats an unknown identifier as enabled", () => {
    expect(isDemoSubsystemEnabled("not_a_demo_subsystem")).toBe(true);
  });
});
