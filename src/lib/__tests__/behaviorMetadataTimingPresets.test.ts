/**
 * Tap/hold timing presets.
 *
 * The firmware for both supported keyboards defines the same hold-tap at
 * several thresholds, naming the instances after the threshold ("Mod-Tap
 * 150ms"). ZMK has no way to say "this is a Mod-Tap with different timing",
 * so the app has to recognise the naming convention itself -- otherwise the
 * presets land in Others with no parameter types and no label, which is
 * exactly what happened the first time they shipped.
 */
import { getBehaviorMetadata } from "../behaviorMetadata";

describe("timing presets", () => {
  it("files a mod-tap preset with the modifiers, not with Others", () => {
    const preset = getBehaviorMetadata("Mod-Tap 150ms");
    const base = getBehaviorMetadata("Mod-Tap");

    expect(preset).not.toBeNull();
    expect(preset!.category).toBe(base!.category);
    expect(preset!.param1Type).toBe(base!.param1Type);
    expect(preset!.param2Type).toBe(base!.param2Type);
  });

  it("files a layer-tap preset with the layer behaviors", () => {
    const preset = getBehaviorMetadata("Layer-Tap 280ms");
    const base = getBehaviorMetadata("Layer-Tap");

    expect(preset).not.toBeNull();
    expect(preset!.category).toBe(base!.category);
    expect(preset!.param1Type).toBe("layer");
  });

  it("files a preset that also names its flavor", () => {
    // Timing is not the only thing two otherwise identical hold-taps differ
    // in: ZMK's `flavor` decides what happens when another key is pressed
    // mid-hold, and it is just as invisible on the wire. A firmware shipping
    // both spells it out in brackets, and a preset that fell through to Others
    // over those brackets would be worse off than one with no flavor at all.
    const preset = getBehaviorMetadata("Mod-Tap 180ms (Permissive)");
    const base = getBehaviorMetadata("Mod-Tap");

    expect(preset).not.toBeNull();
    expect(preset!.category).toBe(base!.category);
    expect(preset!.param1Type).toBe(base!.param1Type);
    expect(preset!.param2Type).toBe(base!.param2Type);
    // The bracket is the only thing telling it apart from a plain "Mod-Tap
    // 180ms", so it has to survive into the picker.
    expect(preset!.displayNameVariants[0]).toBe("Mod-Tap 180ms (Permissive)");
    expect(
      getBehaviorMetadata("Layer-Tap 180ms (Permissive)")!.param1Type,
    ).toBe("layer");
  });

  it("keeps the firmware's own name so the presets stay distinguishable", () => {
    // Falling back to the base name would print "Mod-Tap" three times in the
    // picker with no way to tell which threshold you were choosing.
    for (const name of ["Mod-Tap 150ms", "Mod-Tap 200ms", "Mod-Tap 280ms"]) {
      expect(getBehaviorMetadata(name)!.displayNameVariants[0]).toBe(name);
    }
  });

  it("puts the threshold on the key as well as in the picker", () => {
    const preset = getBehaviorMetadata("Mod-Tap 150ms")!;
    const text = preset.getDisplayText!(
      { behaviorId: 40, param1: 0xe1, param2: 0x04 },
      {},
      preset,
    );
    expect(text).toMatch(/150ms$/);
  });

  it("gives each preset its own short code", () => {
    expect(getBehaviorMetadata("Mod-Tap 150ms")!.shortCode).toBe("MT150");
    expect(getBehaviorMetadata("Mod-Tap 280ms")!.shortCode).toBe("MT280");
  });

  it("returns the same object for repeated lookups", () => {
    // Derived metadata is cached; a fresh object per render would churn the
    // memos that key off it.
    expect(getBehaviorMetadata("Mod-Tap 200ms")).toBe(
      getBehaviorMetadata("Mod-Tap 200ms"),
    );
  });

  it("does not invent metadata for names that only look like presets", () => {
    // "150ms" alone has no base behavior, and an unrelated behavior whose
    // name happens to end in a duration should not borrow someone else's
    // parameter types.
    expect(getBehaviorMetadata("150ms")).toBeNull();
    expect(getBehaviorMetadata("Sensor Warmup 150ms")).toBeNull();
  });

  it("still resolves the plain behaviors unchanged", () => {
    expect(getBehaviorMetadata("Mod-Tap")!.shortCode).toBe("MT");
    expect(getBehaviorMetadata("Key Press")!.shortCode).toBe("KP");
  });
});
