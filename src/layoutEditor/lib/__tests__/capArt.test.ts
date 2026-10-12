import { capArt, coloursOf, shownColour } from "../capArt";
import { allKits } from "../kits";

describe("cap designs", () => {
  it("has a place in the sheet for every cap of a set with designs", () => {
    for (const kit of allKits()) {
      if (coloursOf(kit.id).length === 0) continue;
      for (const cap of kit.caps) {
        const colour = coloursOf(kit.id).find(
          (c) => !c.missing?.includes(cap.index),
        );
        if (!colour) continue;
        const art = capArt(kit.id, colour.id, cap.index);
        expect(art).not.toBeNull();
        expect(art!.x + art!.w).toBeLessThanOrEqual(art!.sheetW);
        expect(art!.y + art!.h).toBeLessThanOrEqual(art!.sheetH);
        // The picture has the cap's own proportions.
        const w = cap.shape === "iso" ? 1.5 : cap.w;
        expect(art!.w / art!.h).toBeCloseTo(w / cap.h, 1);
      }
    }
  });

  it("shows the first colourway until one is chosen, none when plain is asked for", () => {
    expect(shownColour("premium", undefined)?.id).toBe(
      coloursOf("premium")[0].id,
    );
    expect(shownColour("premium", "reflex-blue")?.name).toBe("Reflex Blue");
    expect(shownColour("premium", "")).toBeNull();
    expect(capArt("premium", "", 0)).toBeNull();
    expect(capArt("clickprofile", undefined, 0)).toBeNull();
  });

  it("has a picture for every cap of every colourway", () => {
    for (const kit of allKits()) {
      for (const colour of coloursOf(kit.id)) {
        expect([kit.id, colour.id, colour.missing ?? []]).toEqual([
          kit.id,
          colour.id,
          [],
        ]);
        for (const cap of kit.caps) {
          expect(capArt(kit.id, colour.id, cap.index)).not.toBeNull();
        }
      }
    }
  });

  it("calls the Standard set's Seihakuji by that name", () => {
    expect(coloursOf("standard").map((c) => c.name)).toContain("Seihakuji");
    expect(
      coloursOf("standard").some((c) => c.name.includes("Collection")),
    ).toBe(false);
  });
});
