/**
 * The Trackpad tab exists only for keyboards that have a trackpad's worth of
 * settings. On GoFortyMax Ortho it used to open on a warning telling the
 * owner to enable a firmware module the keyboard has no use for.
 */
import { keyboardHasTrackpadTab } from "../keyboardTabs";

describe("which keyboards get the Trackpad tab", () => {
  it("shows it when the runtime input processor is listed", () => {
    expect(
      keyboardHasTrackpadTab([
        { identifier: "cormoran__custom_settings" },
        { identifier: "cormoran_rip" },
      ]),
    ).toBe(true);
  });

  it("hides it on a keyboard that lists everything but", () => {
    // GoFortyMax Ortho: settings, tap dance, battery — no pointing device.
    expect(
      keyboardHasTrackpadTab([
        { identifier: "cormoran__custom_settings" },
        { identifier: "keebon__battery" },
      ]),
    ).toBe(false);
  });

  it("hides it when the listing never arrived", () => {
    // The page could do nothing without the listing either way.
    expect(keyboardHasTrackpadTab(null)).toBe(false);
    expect(keyboardHasTrackpadTab(undefined)).toBe(false);
    expect(keyboardHasTrackpadTab([])).toBe(false);
  });
});
