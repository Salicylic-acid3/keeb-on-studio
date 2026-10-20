/**
 * Tasks: practice for what a sentence cannot exercise (SPEC §6.3) --
 * moving the cursor, the numpad, the F keys, shortcuts.
 *
 * A task is a list of steps. A "text" step is typed through the engine
 * like a sentence (a number through the numpad, a file name after F2); a
 * "key" step wants one key, with modifiers for a shortcut; a "cursor"
 * step moves a cursor in a small editor drawn on the page to where the
 * task says. The judging here is pure; the page feeds it key events.
 */
import type { Mod } from "../../keyTest/lib/triggers";

export type TaskTag = "cursor" | "numpad" | "fkeys" | "shortcuts";

export interface Cursor {
  row: number;
  col: number;
}

export type TaskStep =
  | { kind: "text"; text: string; prompt?: string }
  | { kind: "key"; code: string; label: string; mods?: Mod[]; prompt?: string }
  | {
      kind: "cursor";
      lines: string[];
      from: Cursor;
      to: Cursor;
      prompt: string;
    };

export interface Task {
  id: string;
  title: string;
  tags: TaskTag[];
  steps: TaskStep[];
}

const LINES = [
  "よく使うキーから順に置いていく",
  "親指でスペースを押す場所を決める",
  "レイヤーの中身は片手で完結させる",
];

export const TASKS: Task[] = [
  {
    id: "cursor-right",
    title: "Move the cursor",
    tags: ["cursor"],
    steps: [
      {
        kind: "cursor",
        lines: LINES,
        from: { row: 0, col: 2 },
        to: { row: 0, col: 5 },
        prompt: "Move three characters to the right on this line.",
      },
    ],
  },
  {
    id: "cursor-line-start",
    title: "Move the cursor",
    tags: ["cursor"],
    steps: [
      {
        kind: "cursor",
        lines: LINES,
        from: { row: 1, col: 6 },
        to: { row: 0, col: 0 },
        prompt: "Go to the start of the line above.",
      },
    ],
  },
  {
    id: "cursor-line-end",
    title: "Move the cursor",
    tags: ["cursor"],
    steps: [
      {
        kind: "cursor",
        lines: LINES,
        from: { row: 0, col: 3 },
        to: { row: 2, col: LINES[2].length },
        prompt: "Go to the end of the last line.",
      },
    ],
  },
  {
    id: "numpad-sum",
    title: "Numbers",
    tags: ["numpad"],
    steps: [{ kind: "text", text: "123+456", prompt: "Type this." }],
  },
  {
    id: "numpad-phone",
    title: "Numbers",
    tags: ["numpad"],
    steps: [{ kind: "text", text: "0120-345-678", prompt: "Type this." }],
  },
  {
    id: "numpad-pi",
    title: "Numbers",
    tags: ["numpad"],
    steps: [{ kind: "text", text: "3.14159", prompt: "Type this." }],
  },
  {
    id: "fkey-f5",
    title: "F keys",
    tags: ["fkeys"],
    steps: [{ kind: "key", code: "F5", label: "F5", prompt: "Press F5." }],
  },
  {
    id: "fkey-rename",
    title: "F keys",
    tags: ["fkeys"],
    steps: [
      { kind: "key", code: "F2", label: "F2", prompt: "Press F2 (rename)." },
      { kind: "text", text: "keymap", prompt: "Type the new name." },
      { kind: "key", code: "Enter", label: "Enter", prompt: "Press Enter." },
    ],
  },
  {
    id: "fkey-f12",
    title: "F keys",
    tags: ["fkeys"],
    steps: [{ kind: "key", code: "F12", label: "F12", prompt: "Press F12." }],
  },
  {
    id: "shortcut-copy-paste",
    title: "Shortcuts",
    tags: ["shortcuts"],
    steps: [
      {
        kind: "key",
        code: "KeyC",
        label: "C",
        mods: ["ctrl"],
        prompt: "Copy.",
      },
      {
        kind: "key",
        code: "KeyV",
        label: "V",
        mods: ["ctrl"],
        prompt: "Paste.",
      },
    ],
  },
  {
    id: "shortcut-undo",
    title: "Shortcuts",
    tags: ["shortcuts"],
    steps: [
      {
        kind: "key",
        code: "KeyZ",
        label: "Z",
        mods: ["ctrl"],
        prompt: "Undo.",
      },
    ],
  },
  {
    id: "shortcut-save",
    title: "Shortcuts",
    tags: ["shortcuts"],
    steps: [
      {
        kind: "key",
        code: "KeyS",
        label: "S",
        mods: ["ctrl"],
        prompt: "Save.",
      },
    ],
  },
];

export const NAV_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/** Where a navigation key takes the cursor in the editor; null for any other key. */
export function moveCursor(
  lines: string[],
  at: Cursor,
  code: string,
): Cursor | null {
  const len = (row: number) => lines[row]?.length ?? 0;
  switch (code) {
    case "ArrowLeft":
      if (at.col > 0) return { row: at.row, col: at.col - 1 };
      return at.row > 0 ? { row: at.row - 1, col: len(at.row - 1) } : at;
    case "ArrowRight":
      if (at.col < len(at.row)) return { row: at.row, col: at.col + 1 };
      return at.row < lines.length - 1 ? { row: at.row + 1, col: 0 } : at;
    case "ArrowUp":
      return at.row > 0
        ? { row: at.row - 1, col: Math.min(at.col, len(at.row - 1)) }
        : { row: 0, col: 0 };
    case "ArrowDown":
      return at.row < lines.length - 1
        ? { row: at.row + 1, col: Math.min(at.col, len(at.row + 1)) }
        : { row: at.row, col: len(at.row) };
    case "Home":
      return { row: at.row, col: 0 };
    case "End":
      return { row: at.row, col: len(at.row) };
    default:
      return null;
  }
}

/** The key that takes the cursor towards `to` by the plainest route. */
export function cursorHint(lines: string[], at: Cursor, to: Cursor): string {
  if (at.row !== to.row) return at.row < to.row ? "ArrowDown" : "ArrowUp";
  if (at.col === to.col) return "";
  if (to.col === 0) return "Home";
  if (to.col === (lines[at.row]?.length ?? 0)) return "End";
  return at.col < to.col ? "ArrowRight" : "ArrowLeft";
}

export function sameCursor(a: Cursor, b: Cursor): boolean {
  return a.row === b.row && a.col === b.col;
}

/** The modifiers a shortcut needs on this platform: Ctrl becomes Cmd on a Mac. */
export function modsOn(mods: Mod[] | undefined, mac: boolean): Mod[] {
  return (mods ?? []).map((m) => (m === "ctrl" && mac ? "meta" : m));
}

/** Whether a key event is exactly the chord a key step wants. */
export function matchesChord(
  ev: {
    code: string;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
    shift: boolean;
  },
  code: string,
  mods: Mod[],
): boolean {
  if (ev.code !== code) return false;
  const want = new Set(mods);
  return (
    ev.ctrl === want.has("ctrl") &&
    ev.alt === want.has("alt") &&
    ev.meta === want.has("meta") &&
    ev.shift === want.has("shift")
  );
}

export const MOD_LABEL: Record<Mod, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  meta: "⌘",
  shift: "Shift",
};
