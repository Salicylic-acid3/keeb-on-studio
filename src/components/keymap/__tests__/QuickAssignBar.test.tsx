/**
 * The bottom keyboard's Trans / None buttons: filling a layer with Trans was
 * a dialog per key, which is exactly the run of keys this bar is for.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAssignBar } from "../QuickAssignBar";

const base = {
  open: true,
  onOpenChange: () => {},
  targetLabel: "Key 1",
  selectedCode: -1,
  onAssign: () => {},
  finished: false,
};

describe("QuickAssignBar specials", () => {
  it("offers Trans and None and reports which was picked", () => {
    const onAssignSpecial = jest.fn();
    render(
      <QuickAssignBar
        {...base}
        onAssignSpecial={onAssignSpecial}
        availableSpecials={["trans", "none"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Trans:/ }));
    fireEvent.click(screen.getByRole("button", { name: /^None:/ }));
    expect(onAssignSpecial.mock.calls).toEqual([["trans"], ["none"]]);
  });

  it("marks the one already on the selected key", () => {
    render(
      <QuickAssignBar
        {...base}
        onAssignSpecial={() => {}}
        availableSpecials={["trans", "none"]}
        selectedSpecial="none"
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /^None:/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /^Trans:/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("shows only what the device can write", () => {
    render(
      <QuickAssignBar
        {...base}
        onAssignSpecial={() => {}}
        availableSpecials={["trans"]}
      />,
    );
    expect(screen.queryByRole("button", { name: /^None:/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Trans:/ })).toBeTruthy();
  });

  it("shows neither when the page does not handle them", () => {
    render(<QuickAssignBar {...base} />);
    expect(screen.queryByRole("button", { name: /^Trans:/ })).toBeNull();
  });
});
