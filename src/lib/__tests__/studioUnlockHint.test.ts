/**
 * The dialog that asks for an unlock is the one moment the user cannot look
 * anything up: their keyboard is refusing to be edited and the app is asking
 * them to press something. Naming the wrong keys there would be worse than
 * the generic line, so a keyboard we do not recognise gets no guess.
 */
import { unlockHintFor } from "../studioUnlockHint";
import { SUPPORTED_DEVICE_NAMES } from "../supportedDevices";

describe("naming a keyboard's unlock gesture", () => {
  it("has an instruction for every keyboard this app supports", () => {
    // The list of keyboards and the list of unlock gestures drift apart
    // silently otherwise: a new keyboard would connect fine and then show the
    // useless generic wording the first time it locked.
    for (const name of SUPPORTED_DEVICE_NAMES) {
      expect(unlockHintFor(name)).toEqual(expect.any(String));
    }
  });

  it("says nothing about a keyboard it does not know", () => {
    expect(unlockHintFor("corne")).toBeNull();
    expect(unlockHintFor(undefined)).toBeNull();
    expect(unlockHintFor(null)).toBeNull();
    expect(unlockHintFor("")).toBeNull();
  });

  it("matches the name however the device reports it", () => {
    // The name arrives from the device; the guard elsewhere normalises it the
    // same way, and the two disagreeing would show the generic line to a
    // keyboard that has an instruction.
    expect(unlockHintFor("ErgoTrack")).toBe(unlockHintFor("ergotrack"));
    expect(unlockHintFor("  goforty-max ")).toBe(unlockHintFor("goforty-max"));
  });
});
