import { holdTapChoice, TYPING_FIRST_MARKER } from "../holdTapChoice";
import { BEHAVIORS } from "../transport/behaviors";

// What a keyboard on the firmware with the three kinds reports.
const NEW = [
  "Key Press",
  "Mod-Tap",
  "Mod-Tap 150ms",
  "Mod-Tap 200ms",
  "Mod-Tap 280ms",
  "Mod-Tap 180ms (Permissive)",
  "Mod-Tap 200ms (Balanced)",
  "Layer-Tap",
  "Layer-Tap 150ms",
  "Layer-Tap 200ms",
  "Layer-Tap 280ms",
  "Layer-Tap 180ms (Permissive)",
  "Layer-Tap 200ms (Balanced)",
  "Layer-Tap 200ms (Hold-preferred)",
];
// The firmware before it: no marker, and plain Mod-Tap was ZMK's own.
const OLD = NEW.filter((name) => !/Balanced|Hold-preferred/.test(name));

const flavor = (name: string, names = NEW) =>
  holdTapChoice(name, names)?.flavor ?? null;

describe("holdTapChoice", () => {
  it("reads the three kinds at 200ms, for both families", () => {
    expect(flavor("Mod-Tap")).toBe("tap-preferred");
    expect(flavor("Mod-Tap 200ms (Balanced)")).toBe("balanced");
    expect(flavor("Mod-Tap 200ms")).toBe("hold-preferred");
    expect(flavor("Layer-Tap")).toBe("tap-preferred");
    expect(flavor("Layer-Tap 200ms (Balanced)")).toBe("balanced");
    expect(flavor("Layer-Tap 200ms (Hold-preferred)")).toBe("hold-preferred");
  });

  it("gives the timing presets their family's default", () => {
    expect(flavor("Mod-Tap 150ms")).toBe("hold-preferred");
    expect(flavor("Mod-Tap 280ms")).toBe("hold-preferred");
    expect(flavor("Layer-Tap 150ms")).toBe("tap-preferred");
    expect(flavor("Layer-Tap 200ms")).toBe("tap-preferred");
  });

  it("reads Permissive as balanced, with its own term", () => {
    const choice = holdTapChoice("Mod-Tap 180ms (Permissive)", NEW)!;
    expect(choice.flavor).toBe("balanced");
    expect(choice.ms).toBe(180);
    expect(choice.baseName).toBe("Mod-Tap 180ms");
  });

  it("says a plain Mod-Tap is hold-first on firmware from before the change", () => {
    // ZMK's own &mt is hold-preferred, and nothing on the wire says the
    // firmware changed it; the behavior that arrived with the change does.
    expect(OLD).not.toContain(TYPING_FIRST_MARKER);
    expect(flavor("Mod-Tap", OLD)).toBe("hold-preferred");
    expect(flavor("Mod-Tap", NEW)).toBe("tap-preferred");
    // Layer-Tap was typing-first all along.
    expect(flavor("Layer-Tap", OLD)).toBe("tap-preferred");
  });

  it("keeps out of keyboards that have no presets", () => {
    // QMK keyboards and stock ZMK also report "Mod-Tap" and "Layer-Tap";
    // what decides a hold there is not this app's to describe.
    const plain = ["Key Press", "Mod-Tap", "Layer-Tap"];
    expect(holdTapChoice("Mod-Tap", plain)).toBeNull();
    expect(holdTapChoice("Layer-Tap", plain)).toBeNull();
  });

  it("leaves other behaviors, and kinds it does not know, alone", () => {
    expect(holdTapChoice("Key Press", NEW)).toBeNull();
    expect(holdTapChoice("Sticky Key", NEW)).toBeNull();
    expect(holdTapChoice("Mod-Tap 200ms (Experimental)", NEW)).toBeNull();
  });

  it("orders a family: typing first, balanced, hold first; 200ms ahead", () => {
    const order = (family: string) =>
      NEW.filter((name) => name.startsWith(family))
        .map((name) => ({ name, key: holdTapChoice(name, NEW)!.sortKey }))
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((entry) => entry.name);
    expect(order("Mod-Tap")).toEqual([
      "Mod-Tap",
      "Mod-Tap 200ms (Balanced)",
      "Mod-Tap 180ms (Permissive)",
      "Mod-Tap 200ms",
      "Mod-Tap 150ms",
      "Mod-Tap 280ms",
    ]);
    expect(order("Layer-Tap")).toEqual([
      "Layer-Tap",
      "Layer-Tap 200ms",
      "Layer-Tap 150ms",
      "Layer-Tap 280ms",
      "Layer-Tap 200ms (Balanced)",
      "Layer-Tap 180ms (Permissive)",
      "Layer-Tap 200ms (Hold-preferred)",
    ]);
  });

  it("the demo is a keyboard on the new firmware", () => {
    const names = BEHAVIORS.map((b) => b.displayName);
    expect(names).toContain(TYPING_FIRST_MARKER);
    expect(names).toContain("Layer-Tap 200ms (Balanced)");
    expect(names).toContain("Layer-Tap 200ms (Hold-preferred)");
    expect(holdTapChoice("Mod-Tap", names)?.flavor).toBe("tap-preferred");
    // Every hold-tap the demo offers is one the picker can describe.
    for (const name of names.filter((n) => /^(Mod|Layer)-Tap/.test(n))) {
      expect([name, holdTapChoice(name, names) !== null]).toEqual([name, true]);
    }
  });
});
