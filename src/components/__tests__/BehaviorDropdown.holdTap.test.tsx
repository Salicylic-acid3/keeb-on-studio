import { fireEvent, render, screen } from "@testing-library/react";
import { BehaviorDropdown } from "../BehaviorDropdown";
import type { BehaviorDefinition } from "../../hooks/useKeymap";

const behaviors = (names: string[]) =>
  new Map<number, BehaviorDefinition>(
    names.map((displayName, index) => [
      index + 1,
      { id: index + 1, displayName, metadata: [] } as BehaviorDefinition,
    ]),
  );

const open = (names: string[], selected: number | null = null) => {
  render(
    <BehaviorDropdown
      behaviors={behaviors(names)}
      selectedBehaviorId={selected}
      onSelect={jest.fn()}
      onQuickSelect={jest.fn()}
      quickSelects={[]}
    />,
  );
  fireEvent.click(screen.getAllByRole("button")[0]);
};

describe("BehaviorDropdown: the kinds of Mod-Tap and Layer-Tap", () => {
  it("names each kind and says what it does", () => {
    open([
      "Mod-Tap",
      "Mod-Tap 200ms",
      "Mod-Tap 200ms (Balanced)",
      "Layer-Tap",
      "Layer-Tap 200ms (Hold-preferred)",
    ]);

    expect(
      screen.getByText("Mod-Tap · Hold: typing first"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mod-Tap 200ms · Hold: balanced"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mod-Tap 200ms · Hold: hold first"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Layer-Tap 200ms · Hold: hold first"),
    ).toBeInTheDocument();
    // The line under the name is about the kind, with the term filled in.
    expect(
      screen.getAllByText(
        "A hold only once it has been held for 200 ms. Typing fast never turns it into a hold.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        "A hold after 200 ms, or once another key is pressed and released while it is down.",
      ),
    ).toBeInTheDocument();
  });

  it("lists a family typing first, then balanced, then hold first", () => {
    open([
      "Mod-Tap 150ms",
      "Mod-Tap 200ms",
      "Mod-Tap 200ms (Balanced)",
      "Mod-Tap",
    ]);
    const titles = screen
      .getAllByText(/^Mod-Tap/)
      .map((element) => element.textContent);
    expect(titles).toEqual([
      "Mod-Tap · Hold: typing first",
      "Mod-Tap 200ms · Hold: balanced",
      "Mod-Tap 200ms · Hold: hold first",
      "Mod-Tap 150ms · Hold: hold first",
    ]);
  });

  it("shows the chosen kind on the closed dropdown too", () => {
    render(
      <BehaviorDropdown
        behaviors={behaviors(["Mod-Tap", "Mod-Tap 200ms (Balanced)"])}
        selectedBehaviorId={2}
        onSelect={jest.fn()}
        onQuickSelect={jest.fn()}
        quickSelects={[]}
      />,
    );
    expect(
      screen.getByText("Mod-Tap 200ms · Hold: balanced"),
    ).toBeInTheDocument();
  });

  it("leaves a keyboard without presets as it was", () => {
    // QMK keyboards report the same two names; the kinds are not theirs.
    open(["Mod-Tap", "Layer-Tap"]);
    expect(screen.getByText("Mod-Tap")).toBeInTheDocument();
    expect(
      screen.getByText("Modifier on hold, key on tap"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Hold: /)).not.toBeInTheDocument();
  });
});
