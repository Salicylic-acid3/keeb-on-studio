import { fireEvent, render, screen } from "@testing-library/react";
import { TapDanceSection } from "../TapDanceSection";

const pushBackArrayElement = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../hooks/useCustomSettings", () => ({
  useCustomSettings: () => ({
    isAvailable: true,
    isLoading: false,
    error: null,
    sections: [
      {
        customSubsystemIndex: 3,
        settings: [
          {
            customSubsystemIndex: 3,
            key: "max_taps",
            source: 0,
            value: { int32Value: 3 },
          },
          {
            customSubsystemIndex: 3,
            key: "tap_dance0/term",
            source: 0,
            value: { int32Value: 200 },
          },
        ],
      },
    ],
    loadSettings: jest.fn(),
    saveSection: jest.fn(),
    discardSection: jest.fn(),
    writeSettingToMemory: jest.fn(),
    pushBackArrayElement,
    popBackArrayElement: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock("../../KeycodeSelector", () => ({
  KeycodeSelector: () => null,
}));

const behaviors = new Map([
  [1, { id: 1, displayName: "Key Press", metadata: [] }],
  [7, { id: 7, displayName: "None", metadata: [] }],
]);

describe("TapDanceSection", () => {
  test("a new tap is the keyboard's None behavior, not behavior id 0", () => {
    // The firmware validates every behavior value against its behavior
    // table, and id 0 is not in it. Pushing an all-zero placeholder was
    // refused, so "Add a tap" did nothing at all.
    render(<TapDanceSection behaviors={behaviors} layers={[]} />);

    fireEvent.click(screen.getByText("Tap Dance"));
    fireEvent.click(screen.getByText("Add a tap"));

    expect(pushBackArrayElement).toHaveBeenCalledTimes(1);
    const [ref, value] = pushBackArrayElement.mock.calls[0];
    expect(ref).toEqual({
      customSubsystemIndex: 3,
      key: "tap_dance0/taps",
      source: 0,
    });
    expect(value).toEqual({
      behaviorValue: { behaviorId: 7, param1: 0, param2: 0 },
    });
  });

  test("without a None behavior the button is disabled rather than sending id 0", () => {
    pushBackArrayElement.mockClear();
    const withoutNone = new Map([
      [1, { id: 1, displayName: "Key Press", metadata: [] }],
    ]);
    render(<TapDanceSection behaviors={withoutNone} layers={[]} />);

    fireEvent.click(screen.getByText("Tap Dance"));
    const button = screen.getByText("Add a tap").closest("button");
    expect(button).toBeDisabled();
    expect(pushBackArrayElement).not.toHaveBeenCalled();
  });
});
