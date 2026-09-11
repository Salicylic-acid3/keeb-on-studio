/**
 * The failure this guards against is silent and destructive: a position that
 * no longer means what the table says would let the gesture editor overwrite
 * an ordinary key while showing a gesture's name above it.
 */
import { trackpadGesturesFor, pseudoKeyPositionsFor } from "../gestures";
import { ERGOTRACK } from "../../layouts";

describe("finding a keyboard's trackpad gestures", () => {
  it("matches the layout this app ships for ErgoTrack", () => {
    // The positions were written against that layout. If it ever grows or
    // loses a key, this test fails here rather than in someone's keymap.
    const gestures = trackpadGesturesFor(ERGOTRACK.name, ERGOTRACK.keys.length);
    expect(gestures.map((g) => g.position)).toEqual([73, 74, 75, 76, 77]);
  });

  it("offers no row for a gesture the firmware stopped sending", () => {
    // 72 was the one-pad pinch modifier. The firmware turned that gesture off
    // (CONFIG_INPUT_IQS9151_2F_PINCH_ENABLE=n on both halves), so a row for it
    // would invite putting a modifier on a key that is never pressed. It stays
    // hidden on the keymap board rather than reappearing there.
    const positions = trackpadGesturesFor(
      ERGOTRACK.name,
      ERGOTRACK.keys.length,
    ).map((g) => g.position);
    expect(positions).not.toContain(72);
    expect(
      pseudoKeyPositionsFor(ERGOTRACK.name, ERGOTRACK.keys.length).has(72),
    ).toBe(true);
  });

  it("keeps the gesture positions past the end of the physical keys", () => {
    // 72 is the first of the seven pseudo-keys drawn below the board. A
    // gesture position that landed among the real keys would mean the table
    // and the layout have drifted apart.
    const gestures = trackpadGesturesFor(ERGOTRACK.name, ERGOTRACK.keys.length);
    for (const gesture of gestures) {
      expect(gesture.position).toBeGreaterThanOrEqual(72);
      expect(gesture.position).toBeLessThan(ERGOTRACK.keys.length);
    }
  });

  it("says nothing when the layout is the wrong size", () => {
    // A firmware that changed its layout is exactly when these numbers stop
    // being true, and exactly when writing to them does the most damage.
    expect(trackpadGesturesFor(ERGOTRACK.name, 79 - 1)).toEqual([]);
    expect(trackpadGesturesFor(ERGOTRACK.name, undefined)).toEqual([]);
  });

  it("says nothing about a keyboard it does not know", () => {
    expect(trackpadGesturesFor("Someone Else's Board", 79)).toEqual([]);
    expect(trackpadGesturesFor(undefined, 79)).toEqual([]);
    expect(trackpadGesturesFor("", 79)).toEqual([]);
  });

  it("matches the layout name whatever its case and spacing", () => {
    // The name comes off the wire from the firmware's display-name.
    expect(trackpadGesturesFor("  clickboard ergotrack  ", 79)).toHaveLength(5);
  });

  it("lists no position twice", () => {
    const positions = trackpadGesturesFor(ERGOTRACK.name, 79).map(
      (g) => g.position,
    );
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("covers every gesture position and the two unused spares", () => {
    // The keymap editor hides exactly this set. A gesture left out of it would
    // stay drawn as a blank key; a real key wrongly in it would vanish.
    const hidden = pseudoKeyPositionsFor(ERGOTRACK.name, ERGOTRACK.keys.length);
    expect([...hidden].sort((a, b) => a - b)).toEqual([
      72, 73, 74, 75, 76, 77, 78,
    ]);
    for (const gesture of trackpadGesturesFor(ERGOTRACK.name, 79)) {
      expect(hidden.has(gesture.position)).toBe(true);
    }
  });

  it("hides nothing on a layout it cannot vouch for", () => {
    // Hiding a key nobody asked to hide is worse than drawing a spare one, so
    // an unknown keyboard keeps every position.
    expect(pseudoKeyPositionsFor(ERGOTRACK.name, 80).size).toBe(0);
    expect(pseudoKeyPositionsFor("Someone Else's Board", 79).size).toBe(0);
    expect(pseudoKeyPositionsFor(undefined, undefined).size).toBe(0);
  });

  it("marks the zoom modifier as held and the swipes as taps", () => {
    // This is not cosmetic: only a held key can carry the modifier that turns
    // the two-handed zoom's wheel scroll into a zoom. A tapped one would do
    // nothing.
    const byPosition = new Map(
      trackpadGesturesFor(ERGOTRACK.name, 79).map((g) => [g.position, g]),
    );
    expect(byPosition.get(77)?.held).toBe(true);
    expect(byPosition.get(73)?.held).toBe(false);
    expect(byPosition.get(76)?.held).toBe(false);
  });
});
