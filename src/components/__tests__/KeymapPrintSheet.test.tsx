/**
 * The print sheet is invisible on screen, so nothing about it shows up in
 * ordinary use until someone hits Print. These pin the two things that would
 * silently break it: it has to render every layer, and it has to land on
 * <body> for the print stylesheet's one hide-everything rule to work.
 */
import { act, render, screen } from "@testing-library/react";
import { KeymapPrintSheet } from "../KeymapPrintSheet";
import type { PhysicalLayout, Layer } from "../../hooks/useKeymap";

const LAYOUT: PhysicalLayout = {
  name: "Test Board",
  keys: [
    { width: 100, height: 100, x: 0, y: 0, r: 0, rx: 0, ry: 0 },
    { width: 100, height: 100, x: 100, y: 0, r: 0, rx: 0, ry: 0 },
  ],
};

const LAYERS: Layer[] = [
  { id: 0, name: "Base", bindings: [] },
  { id: 1, name: "Lower", bindings: [] },
  { id: 2, name: "", bindings: [] },
];

/** The sheet only exists while the browser is preparing to print. */
function enterPrintMode() {
  window.dispatchEvent(new Event("beforeprint"));
}

function renderSheet() {
  const result = render(
    <KeymapPrintSheet
      layout={LAYOUT}
      layers={LAYERS}
      behaviors={new Map()}
      deviceName="ClickBoard ErgoTrack"
    />,
  );
  act(() => enterPrintMode());
  return result;
}

describe("KeymapPrintSheet", () => {
  it("gives every layer its own page", () => {
    renderSheet();
    expect(document.querySelectorAll(".keymap-print-page")).toHaveLength(
      LAYERS.length,
    );
  });

  it("names each page after its layer, falling back to the index", () => {
    renderSheet();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("Lower")).toBeInTheDocument();
    // The third layer has no name; it should still be identifiable.
    expect(screen.getByText(/Layer 2/)).toBeInTheDocument();
  });

  it("puts the device and layout on every page, so a loose sheet is identifiable", () => {
    renderSheet();
    const captions = screen.getAllByText(/ClickBoard ErgoTrack · Test Board/);
    expect(captions).toHaveLength(LAYERS.length);
  });

  it("renders onto body rather than in place", () => {
    // The print stylesheet hides `body > *:not(.keymap-print-portal)`. Render
    // the sheet anywhere deeper and that rule hides the sheet along with the
    // app, which is exactly the bug this replaced.
    const { container } = renderSheet();
    expect(container.querySelector(".keymap-print-portal")).toBeNull();
    const portal = document.querySelector(".keymap-print-portal");
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
  });

  it("is hidden from assistive tech, since it duplicates the editor", () => {
    renderSheet();
    expect(
      document
        .querySelector(".keymap-print-portal")!
        .getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("stays out of the DOM until the browser asks to print", () => {
    // Otherwise it is a second copy of every layer on the app's heaviest
    // screen, and its layer names collide with the editor's for anything
    // querying the page by text.
    render(
      <KeymapPrintSheet
        layout={LAYOUT}
        layers={LAYERS}
        behaviors={new Map()}
      />,
    );
    expect(document.querySelector(".keymap-print-portal")).toBeNull();

    act(() => enterPrintMode());
    expect(document.querySelector(".keymap-print-portal")).not.toBeNull();

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(document.querySelector(".keymap-print-portal")).toBeNull();
  });
});
