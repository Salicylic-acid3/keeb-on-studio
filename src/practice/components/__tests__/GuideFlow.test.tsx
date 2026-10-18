/**
 * The guide's layer-content steps, driven the way a person drives them:
 * one pulldown after another. Each pick must keep the others as they
 * were, a layer another kind has must be offered only as a disabled
 * choice, and the drawing must stay on screen throughout.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { testBoard } from "../../../keyTest/lib/boards";
import { keyboardMeta } from "../../lib/metadata";
import { clearProgress, readProgress } from "../../lib/guideStore";
import { GuideFlow } from "../GuideFlow";

const t = (key: string, params?: Record<string, string | number>) =>
  Object.entries(params ?? {}).reduce(
    (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
    key,
  );

const board = testBoard("goforty_max_ortho")!;
const meta = keyboardMeta(board);

function mount() {
  clearProgress(board.id);
  return render(
    <GuideFlow board={board} meta={meta} layout="us" t={t} onExit={() => {}} />,
  );
}

/** Apply when there is a proposal, otherwise go on without one. */
function applyOrSkip() {
  const apply = screen.getByRole("button", { name: "Apply" });
  if (!(apply as HTMLButtonElement).disabled) fireEvent.click(apply);
  else
    fireEvent.click(
      screen.getByRole("button", { name: "Next without changing" }),
    );
}

function toLayerStep() {
  fireEvent.click(screen.getByRole("button", { name: "Begin" }));
  applyOrSkip(); // symbols
  applyOrSkip(); // duplicates
  fireEvent.click(
    screen.getByRole("button", { name: "Use Salicylic_acid3's row" }),
  );
  applyOrSkip(); // thumbs
  applyOrSkip(); // layer keys
  fireEvent.click(screen.getByRole("button", { name: "Done, next step" })); // practice
  expect(screen.getByText(/Step 7 of/)).toBeInTheDocument();
}

/** The content pulldowns of the layer step, in CONTENTS order. */
function pickers(): HTMLSelectElement[] {
  return [
    "Cursor keys",
    "Numbers (numpad)",
    "Symbols (the grid below)",
    "F keys",
  ].map(
    (name) =>
      within(screen.getByText(name).parentElement!).getByRole(
        "combobox",
      ) as HTMLSelectElement,
  );
}

const boards = () => document.querySelectorAll("svg[viewBox]").length;
const marked = () => document.querySelectorAll("[data-mark='set']").length;

describe("GuideFlow layer contents", () => {
  afterEach(() => clearProgress(board.id));

  it("keeps every pick while the pulldowns are worked one after another", () => {
    mount();
    toLayerStep();
    const [cursor, digits, symbols, fkeys] = pickers();
    const layers = Array.from(cursor.options)
      .map((o) => o.value)
      .filter(Boolean);
    expect(layers.length).toBe(2);
    const [l2, l3] = layers;
    expect(cursor.value).toBe(l2); // the default: cursor on the right thumb
    expect(boards()).toBeGreaterThan(0);

    fireEvent.change(digits, { target: { value: l3 } });
    expect(cursor.value).toBe(l2);
    expect(digits.value).toBe(l3);
    const afterDigits = marked();
    expect(afterDigits).toBeGreaterThan(4);

    // The layer the numbers took is offered to the symbols only disabled.
    const symOpt = Array.from(symbols.options).find((o) => o.value === l3)!;
    expect(symOpt.disabled).toBe(true);
    expect(symOpt.textContent).toMatch(/taken by Numbers \(numpad\)/);
    const curOpt = Array.from(symbols.options).find((o) => o.value === l2)!;
    expect(curOpt.disabled).toBe(true);
    expect(curOpt.textContent).toMatch(/taken by Cursor keys/);

    // Freeing a layer makes it pickable again; nothing else moves.
    fireEvent.change(cursor, { target: { value: "" } });
    expect(digits.value).toBe(l3);
    expect(
      Array.from(symbols.options).find((o) => o.value === l2)!.disabled,
    ).toBe(false);
    fireEvent.change(symbols, { target: { value: l2 } });
    expect(symbols.value).toBe(l2);
    expect(digits.value).toBe(l3);
    expect(cursor.value).toBe("");
    expect(marked()).toBeGreaterThan(afterDigits);
    expect(
      Array.from(fkeys.options).filter((o) => o.value && !o.disabled),
    ).toHaveLength(0);

    // Round and round: nothing vanishes and the drawing stays.
    for (let i = 0; i < 6; i++) {
      fireEvent.change(symbols, { target: { value: "" } });
      fireEvent.change(fkeys, { target: { value: l2 } });
      expect(fkeys.value).toBe(l2);
      expect(digits.value).toBe(l3);
      fireEvent.change(fkeys, { target: { value: "" } });
      fireEvent.change(cursor, { target: { value: l2 } });
      expect(cursor.value).toBe(l2);
      expect(digits.value).toBe(l3);
      expect(boards()).toBeGreaterThan(0);
      expect(marked()).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/went wrong/i)).toBeNull();
  });

  it("survives applying, going back and changing the picks again", () => {
    mount();
    toLayerStep();
    let [cursor, digits] = pickers();
    const [l2, l3] = Array.from(cursor.options)
      .map((o) => o.value)
      .filter(Boolean);
    fireEvent.change(digits, { target: { value: l3 } });
    applyOrSkip(); // step 7 applied
    expect(screen.getByText(/Step 8 of/)).toBeInTheDocument();
    expect(boards()).toBeGreaterThan(0);

    // Step 8 offers both layers; the other hand gets the numbers by default.
    const [, digits8] = pickers();
    expect(digits8.value).toBe(l3);
    applyOrSkip(); // step 8 applied

    // Back to 7: the picks are as they were, and can still be changed.
    fireEvent.click(
      screen.getByRole("button", { name: "Layer contents: one hand" }),
    );
    expect(screen.getByText(/Step 7 of/)).toBeInTheDocument();
    [cursor, digits] = pickers();
    expect(cursor.value).toBe(l2);
    expect(digits.value).toBe(l3);
    fireEvent.change(cursor, { target: { value: "" } });
    fireEvent.change(digits, { target: { value: l2 } });
    expect(digits.value).toBe(l2);
    expect(boards()).toBeGreaterThan(0);
    expect(marked()).toBeGreaterThan(0);
    applyOrSkip();
    expect(readProgress(board.id)?.answers.oneHand.digits).toBe(Number(l2));
    expect(screen.queryByText(/went wrong/i)).toBeNull();
  });
});
