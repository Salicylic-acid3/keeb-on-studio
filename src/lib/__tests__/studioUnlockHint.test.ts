/**
 * The dialog that asks for an unlock is the one moment the user cannot look
 * anything up: their keyboard is refusing to be edited and the app is asking
 * them to press something. Naming the wrong keys there would be worse than
 * the generic line, so a keyboard we do not recognise gets no guess.
 *
 * Neither keyboard ships locked any more, so there is nothing to name — and
 * that is what these now check: that the stale instructions are gone, and
 * that the lookup still behaves when a locked keyboard turns up again.
 */
import { unlockHintFor } from "../studioUnlockHint";
import { SUPPORTED_DEVICE_NAMES } from "../supportedDevices";

describe("naming a keyboard's unlock gesture", () => {
  it("names no gesture, because neither keyboard has one", () => {
    // Both ship with CONFIG_ZMK_STUDIO_LOCKING off and no &studio_unlock in
    // their keymaps. The instructions that used to be here named a key on
    // ErgoTrack's Drag layer that has since been removed — a dialog telling
    // someone to press it would send them hunting for a key that does nothing.
    for (const name of SUPPORTED_DEVICE_NAMES) {
      expect(unlockHintFor(name)).toBeNull();
    }
  });

  it("says nothing about a keyboard it does not know", () => {
    expect(unlockHintFor("corne")).toBeNull();
    expect(unlockHintFor(undefined)).toBeNull();
    expect(unlockHintFor(null)).toBeNull();
    expect(unlockHintFor("")).toBeNull();
  });

  it("still normalises the name it is given", () => {
    // The name arrives from the device, and the guard elsewhere normalises it
    // the same way. Kept under test so an entry added later works the first
    // time rather than after someone notices the casing.
    expect(unlockHintFor("ErgoTrack")).toBe(unlockHintFor("ergotrack"));
    expect(unlockHintFor("  goforty-max ")).toBe(unlockHintFor("goforty-max"));
  });
});
