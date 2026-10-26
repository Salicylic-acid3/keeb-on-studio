/**
 * The 30% guide driven as a person drives it on a BeThirty: each step's
 * groups applied, one turned off, and the keymap at the end.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { testBoard } from "../../../keyTest/lib/boards";
import { keyboardMeta } from "../../lib/metadata";
import { guideSteps } from "../../lib/guide";
import { anchorsOf, bottomRoles } from "../../lib/guide30";
import { clearProgress, readProgress } from "../../lib/guideStore";
import { GuideFlow } from "../GuideFlow";

const t = (key: string, params?: Record<string, string | number>) =>
  Object.entries(params ?? {}).reduce(
    (s, [k, v]) => s.replace(`{{${k}}}`, String(v)),
    key,
  );

const board = testBoard("bethirty_ortho")!;
const meta = keyboardMeta(board);

function mount() {
  clearProgress(board.id);
  return render(
    <GuideFlow
      board={board}
      meta={meta}
      layout="us"
      t={t}
      onExit={() => {}}
      steps={guideSteps(false, "30")}
    />,
  );
}

const apply = () =>
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
const heading = (text: string | RegExp) =>
  screen.getByRole("heading", { level: 2, name: text });

describe("GuideFlow, 30%", () => {
  afterEach(() => clearProgress(board.id));

  it("runs the author's keymap onto a BeThirty Ortho, one step at a time", () => {
    mount();
    expect(
      screen.getByText(/A 30% keyboard has three rows/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(heading("Thumb keys and the bottom row")).toBeInTheDocument();
    expect(screen.getByText("Thumb home keys")).toBeInTheDocument();
    apply();
    expect(heading("Letters with a hold")).toBeInTheDocument();
    // The drawing marks the Q key with its three roles.
    expect(screen.getByText("Tab / Ctrl / ×2 Q")).toBeInTheDocument();
    apply();
    expect(heading("Layer 1: cursor and F keys")).toBeInTheDocument();
    expect(screen.getByText(/Layer 1 \(Space held\)/)).toBeInTheDocument();
    // The F keys left out: the group's checkbox.
    const fkeys = screen.getByLabelText(/F keys under the left hand/);
    fireEvent.click(fkeys);
    expect((fkeys as HTMLInputElement).checked).toBe(false);
    apply();
    expect(heading("Layer 2: symbols and numbers")).toBeInTheDocument();
    expect(screen.getByText(/Layer 2 \(Enter held\)/)).toBeInTheDocument();
    apply();
    expect(heading(/Layers 3 and 4/)).toBeInTheDocument();
    expect(
      screen.getByText(/Layer 4 \(Enter \+ Space held\)/),
    ).toBeInTheDocument();
    apply();
    expect(heading("Tapping term")).toBeInTheDocument();
    // Nothing to write: the terms are the ones the letters step wrote.
    expect(
      screen.getByText("Nothing to change with this answer."),
    ).toBeInTheDocument();
    const input = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    expect(input.value).toBe("220");
    fireEvent.change(input, { target: { value: "250" } });
    expect(
      screen.getByRole("button", { name: "Save and finish without this" }),
    ).toBeInTheDocument();

    const progress = readProgress(board.id)!;
    expect(progress.guide).toBe("30");
    const a = anchorsOf(board, meta);
    const r = bottomRoles(a);
    expect(progress.layers).toHaveLength(5);
    expect(progress.layers[0][a.byCode("KeyQ")!]).toMatchObject({
      code: "Tab",
      doubleTap: "KeyQ",
      term: 220,
    });
    expect(progress.layers[1][a.byCode("KeyS")!]).toEqual({ kind: "none" });
    expect(progress.layers[1][a.byCode("KeyJ")!]).toMatchObject({
      code: "ArrowLeft",
    });
    expect(progress.layers[2][r.left[0]!]).toMatchObject({
      code: "Digit1",
      mods: ["shift"],
    });
    expect(progress.layers[4][a.byCode("KeyV")!]).toMatchObject({
      code: "KeyV",
      mods: ["ctrl"],
    });
    expect(screen.queryByText(/went wrong/i)).toBeNull();
  });

  it("starts over when saved progress is from the other guide", () => {
    clearProgress(board.id);
    window.localStorage.setItem(
      `keeb-on:practice-guide:${board.id}`,
      JSON.stringify({
        version: 1,
        guide: "40",
        step: 3,
        answers: {},
        status: {},
        layers: [[]],
        savedAt: 1,
      }),
    );
    render(
      <GuideFlow
        board={board}
        meta={meta}
        layout="us"
        t={t}
        onExit={() => {}}
        steps={guideSteps(false, "30")}
      />,
    );
    expect(screen.getByRole("button", { name: "Begin" })).toBeInTheDocument();
  });
});
