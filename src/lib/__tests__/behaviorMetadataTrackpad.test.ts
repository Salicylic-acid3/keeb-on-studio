/**
 * The trackpad driver's behaviors, and what the picker leaves out.
 *
 * ClickBoard ErgoTrack ships behaviors from zmk-driver-iqs9151 that ZMK
 * Studio knows nothing about. Without entries here they sat in Others under
 * their node names ("zip_dyn_scale"), and the one with a proper name, Left
 * Click (Drag), had no description to say what it does. The picker also
 * offered keys that do nothing useful on these keyboards.
 */
import {
  getBehaviorMetadata,
  formatBehaviorBinding,
} from "../behaviorMetadata";
import type { BehaviorDefinition } from "../../hooks/useKeymap";

const definition = (displayName: string): BehaviorDefinition => ({
  id: 1,
  displayName,
  metadata: [],
});

describe("trackpad driver behaviors", () => {
  it("files Left Click (Drag) with the mouse behaviors, with a description", () => {
    const meta = getBehaviorMetadata("Left Click (Drag)");
    expect(meta?.category).toBe("mouse");
    expect(meta?.description).toMatch(/drag/i);
    expect(meta?.hidden).toBeFalsy();
    // No parameters: the picker must not open a parameter tab for it.
    expect(meta?.param1Type).toBeUndefined();
    expect(meta?.param2Type).toBeUndefined();
  });

  it("names the speed keys by their firmware display names and node names", () => {
    expect(getBehaviorMetadata("Pointer Speed Adjust")?.category).toBe("mouse");
    expect(getBehaviorMetadata("zip_dyn_scale")?.category).toBe("mouse");
    expect(getBehaviorMetadata("Pointer Speed Set")?.category).toBe("mouse");
    expect(getBehaviorMetadata("zip_dyn_scale_set")?.category).toBe("mouse");
  });

  it("labels a speed key by what it changes", () => {
    const adjust = definition("Pointer Speed Adjust");
    expect(
      formatBehaviorBinding({ behaviorId: 1, param1: 0, param2: 1 }, adjust),
    ).toBe("Cursor speed +");
    expect(
      formatBehaviorBinding({ behaviorId: 1, param1: 2, param2: 3 }, adjust),
    ).toBe("Cursor+Scroll speed Reset");

    const set = definition("Pointer Speed Set");
    expect(
      formatBehaviorBinding({ behaviorId: 1, param1: 1, param2: 15 }, set),
    ).toBe("Scroll speed ×1.5");
  });

  it("keeps firmware plumbing and useless keys out of the picker", () => {
    expect(getBehaviorMetadata("tp_to_pos")?.hidden).toBe(true);
    expect(getBehaviorMetadata("Studio Unlock")?.hidden).toBe(true);
    expect(getBehaviorMetadata("Reset")?.hidden).toBe(true);
    // Bootloader is how firmware gets written; it must stay.
    expect(getBehaviorMetadata("Bootloader")?.hidden).toBeFalsy();
  });
});
