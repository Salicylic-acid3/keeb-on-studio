import { act, renderHook, waitFor } from "@testing-library/react";
import { useQmkSavedKeymaps } from "../useQmkSavedKeymaps";
import type { UseVialKeyboard } from "../useVialKeyboard";
import type { QmkKeymapPayload } from "../../lib/savedQmkKeymap";

function keyboardFor(name: string | null, isDemo = false): UseVialKeyboard {
  return {
    info: name ? { definition: { name }, isDemo } : null,
    keymap: null,
  } as unknown as UseVialKeyboard;
}

function payload(name: string, board: string): QmkKeymapPayload {
  return { name, description: "", board } as unknown as QmkKeymapPayload;
}

async function withTwoBoards(keyboard: UseVialKeyboard) {
  const hook = renderHook(({ kb }) => useQmkSavedKeymaps(kb), {
    initialProps: { kb: keyboard },
  });
  await act(async () => {
    await hook.result.current.add(payload("mine", "BeThirty Ortho"));
    await hook.result.current.add(payload("other", "ClickBoard ErgoMini"));
  });
  await waitFor(() => expect(hook.result.current.records).toHaveLength(2));
  return hook;
}

describe("useQmkSavedKeymaps: which keymaps the menu lists", () => {
  test("a connected keyboard lists only its own keymaps", async () => {
    const { result } = await withTwoBoards(keyboardFor("BeThirty Ortho"));
    expect(result.current.menuRecords.map((r) => r.name)).toEqual(["mine"]);
    expect(result.current.hiddenCount).toBe(1);
    expect(result.current.isShown({ board: "ClickBoard ErgoMini" })).toBe(
      false,
    );
  });

  test("demo mode lists every keymap", async () => {
    const { result } = await withTwoBoards(keyboardFor("BeThirty Ortho", true));
    expect(result.current.menuRecords).toHaveLength(2);
    expect(result.current.hiddenCount).toBe(0);
  });

  test("with no keyboard connected every keymap is listed", async () => {
    const { result } = await withTwoBoards(keyboardFor(null));
    expect(result.current.menuRecords).toHaveLength(2);
    expect(result.current.hiddenCount).toBe(0);
  });
});
