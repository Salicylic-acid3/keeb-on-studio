/**
 * The diagnostics find chatter; this is the part that says what to do about
 * it. What matters here is the order of the advice and the one thing the
 * screen cannot do, since that is the question the panel exists to answer.
 */
import { render, screen } from "@testing-library/react";
import { ChatterGuidance } from "../ChatterGuidance";

describe("ChatterGuidance", () => {
  it("puts the free checks before the one that needs new firmware", () => {
    render(<ChatterGuidance />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/Reset the statistics/i);
    expect(steps[1]).toHaveTextContent(/look at the switch/i);
    expect(steps[2]).toHaveTextContent(/needs new firmware/i);
  });

  it("says why there is no debounce control on this screen", () => {
    // Without this the user hunts for a setting that does not exist, then
    // concludes the app is broken rather than that ZMK works this way.
    render(<ChatterGuidance />);
    expect(
      screen.getByText(/fixed when the firmware is built/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot be changed from this screen/i),
    ).toBeInTheDocument();
  });

  it("names the cost of the last resort", () => {
    render(<ChatterGuidance />);
    expect(
      screen.getByText(/delays every key on the keyboard/i),
    ).toBeInTheDocument();
  });

  it("offers somewhere to report it", () => {
    render(<ChatterGuidance />);
    const link = screen.getByRole("link", { name: /Report it on Discord/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("discord"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});
