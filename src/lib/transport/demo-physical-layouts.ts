import type {
  Request,
  Response,
} from "../../proto/zmk/physical_layouts/physical_layouts";

export const PHYSICAL_LAYOUTS_IDENTIFIER = "cormoran__physical_layouts";

/**
 * Index of ErgoTrack in the demo's layout list (see LAYOUTS in demo.ts).
 *
 * A real device answers this request for itself, so the protocol carries no
 * layout index. The demo stands in for both supported keyboards, and only
 * ErgoTrack has trackpads, so it answers for whichever layout is selected.
 */
const ERGOTRACK_LAYOUT_INDEX = 0;

export class PhysicalLayoutsHandler {
  /** Which layout the demo device currently presents; kept in step by demo.ts. */
  private activeLayoutIndex = ERGOTRACK_LAYOUT_INDEX;

  setActiveLayoutIndex(index: number): void {
    this.activeLayoutIndex = index;
  }

  process(request: Request): Response {
    if (request.getPhysicalLayout) {
      // GoFortyMax is a plain ortholinear board: no pointing device, no
      // encoder. Reporting nothing is what its firmware would report.
      if (this.activeLayoutIndex !== ERGOTRACK_LAYOUT_INDEX) {
        return { physicalLayout: { devices: [], rotaryEncoders: [] } };
      }

      return {
        physicalLayout: {
          // ErgoTrack carries a trackpad per hand. The demo used to
          // advertise a trackball and a rotary encoder as well; neither is on
          // a keyboard this app supports, and rotary encoders are explicitly
          // not planned.
          //
          // Geometry matches what the firmware reports (see the touchpad
          // nodes in clickboard_ergotrack_right.overlay): each pad fills the
          // gap between that hand's two drag_lclk bars, which sit at y 25..125
          // and y 375..475 in the same 100-per-unit coordinate space the key
          // layout uses. Keep the two in step, or the demo teaches the wrong
          // shape of the keyboard.
          devices: [
            {
              identifier: "touchpad_left",
              displayName: "Touch Pad (Left)",
              enabled: true,
              links: [
                {
                  deviceIdentifier: "touchpad_left_input",
                  subsystemIdentifier: "zmk__touch_pad",
                },
              ],
              touchPad: {
                attrs: {
                  width: 268,
                  height: 250,
                  x: 650,
                  y: 125,
                  r: 0,
                  rx: 0,
                  ry: 0,
                },
              },
            },
            {
              identifier: "touchpad_right",
              displayName: "Touch Pad (Right)",
              enabled: true,
              links: [
                {
                  deviceIdentifier: "touchpad_right_input",
                  subsystemIdentifier: "zmk__touch_pad",
                },
              ],
              touchPad: {
                attrs: {
                  width: 268,
                  height: 250,
                  x: 1010,
                  y: 125,
                  r: 0,
                  rx: 0,
                  ry: 0,
                },
              },
            },
          ],
          rotaryEncoders: [],
        },
      };
    }

    return {
      error: {
        message: "Unknown physical layout request",
      },
    };
  }
}
