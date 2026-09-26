import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { TapDanceListCard } from "../TapDanceListCard";
import { TapDanceEditorCard } from "../TapDanceEditorCard";
import { useTapDance } from "../useTapDance";
import { groupIntoSlots } from "../../../lib/tapDance/slots";

const pushBackArrayElement = jest.fn().mockResolvedValue(undefined);
const popBackArrayElement = jest.fn().mockResolvedValue(undefined);
const saveSection = jest.fn().mockResolvedValue(undefined);

const tapSetting = (
  slot: number,
  index: number,
  behaviorId: number,
  param1 = 0,
) => ({
  customSubsystemIndex: 3,
  key: `tap_dance${slot}/taps`,
  source: 0,
  hasUnsavedValue: false,
  value: {
    arrayValue: {
      index,
      size: 2,
      value: { behaviorValue: { behaviorId, param1, param2: 0 } },
    },
  },
});

const listedSettings = [
  {
    customSubsystemIndex: 3,
    key: "max_taps",
    source: 0,
    hasUnsavedValue: false,
    value: { int32Value: 3 },
  },
  {
    customSubsystemIndex: 3,
    key: "tap_dance0/term",
    source: 0,
    hasUnsavedValue: false,
    value: { int32Value: 200 },
  },
  tapSetting(0, 0, 1, 0x29), // Esc
  tapSetting(0, 1, 7), // None: unset
  {
    customSubsystemIndex: 3,
    key: "tap_dance1/term",
    source: 0,
    hasUnsavedValue: true,
    value: { int32Value: 250 },
  },
];

jest.mock("../../../hooks/useCustomSettings", () => ({
  useCustomSettings: () => ({
    isAvailable: true,
    isLoading: false,
    error: null,
    sections: [
      {
        customSubsystemIndex: 3,
        identifier: "keebon__runtime_tap_dance",
        settings: listedSettings,
      },
    ],
    loadSettings: jest.fn(),
    saveSection,
    discardSection: jest.fn(),
    resetSection: jest.fn(),
    writeSettingToMemory: jest.fn(),
    pushBackArrayElement,
    popBackArrayElement,
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

describe("useTapDance", () => {
  test("a new tap is the keyboard's None behavior, not behavior id 0", async () => {
    // The firmware validates every behavior value against its behavior
    // table, and id 0 is not in it. Pushing an all-zero placeholder was
    // refused, so "Add a tap" did nothing at all.
    const { result } = renderHook(() => useTapDance(behaviors));
    await act(() => result.current.addTap(result.current.slots[0]));

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

  test("removing a tap and saving go through the section", async () => {
    const { result } = renderHook(() => useTapDance(behaviors));
    expect(result.current.hasUnsavedChanges).toBe(true); // slot 1's term is flagged
    await act(() => result.current.removeTap(result.current.slots[0]));
    expect(popBackArrayElement).toHaveBeenCalledTimes(1);
    await act(() => result.current.save());
    expect(saveSection).toHaveBeenCalledWith(3);
  });
});

describe("TapDanceListCard", () => {
  test("lists every slot with its keymap name and a summary of its taps", () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() => useTapDance(behaviors));
    render(
      <TapDanceListCard
        tapDance={result.current}
        behaviors={behaviors}
        layers={[]}
        keyboardLayout="us"
        selectedIndex={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Tap dance 0")).toBeInTheDocument();
    expect(screen.getByText("Tap dance 1")).toBeInTheDocument();
    // An unset tap reads as a dash, not as "None".
    expect(screen.getByText(/Esc · —/)).toBeInTheDocument();
    expect(screen.getByText("No taps — does nothing")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Tap dance 1"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1 }),
    );
  });
});

describe("TapDanceEditorCard", () => {
  test("shows the slot's taps and offers to add and remove", () => {
    const { result } = renderHook(() => useTapDance(behaviors));
    const slot = groupIntoSlots(listedSettings)[0];
    render(
      <TapDanceEditorCard
        tapDance={result.current}
        slot={slot}
        behaviors={behaviors}
        layers={[]}
        keyboardLayout="us"
      />,
    );

    expect(screen.getByText("1 taps")).toBeInTheDocument();
    expect(screen.getByText("2 taps")).toBeInTheDocument();
    expect(screen.getByText("Not set — click to choose")).toBeInTheDocument();
    expect(screen.getByText("Add a tap").closest("button")).toBeEnabled();
    expect(
      screen.getByText("Remove the last tap").closest("button"),
    ).toBeEnabled();
    // No Save button of its own: the tab's Save covers macros, combos and
    // tap dance together.
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });
});
