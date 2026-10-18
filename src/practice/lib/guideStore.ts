/**
 * Where the guide keeps its progress between visits (SPEC §5.7): per
 * keyboard, in the browser only -- the step reached, the answers, which
 * steps were applied or skipped, and the working keymap with the
 * proposals applied so far.
 */
import type { Trigger } from "../../keyTest/lib/triggers";
import type { Answers } from "./guide";

export type StepStatus = "todo" | "applied" | "skipped" | "done";

export interface GuideProgress {
  version: 1;
  guide: "40";
  step: number;
  answers: Answers;
  status: Record<number, StepStatus>;
  layers: Trigger[][];
  savedAt: number;
}

const PREFIX = "keeb-on:practice-guide:";

export function readProgress(boardId: string): GuideProgress | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + boardId);
    if (!raw) return null;
    const p = JSON.parse(raw) as GuideProgress;
    return p && p.version === 1 && Array.isArray(p.layers) ? p : null;
  } catch {
    return null;
  }
}

export function writeProgress(boardId: string, progress: GuideProgress) {
  try {
    window.localStorage.setItem(PREFIX + boardId, JSON.stringify(progress));
  } catch {
    // Not kept; the guide still works for this visit.
  }
}

export function clearProgress(boardId: string) {
  try {
    window.localStorage.removeItem(PREFIX + boardId);
  } catch {
    // Nothing to clear.
  }
}

/** The keyboards with progress saved, newest first. */
export function savedGuides(): Array<{
  boardId: string;
  progress: GuideProgress;
}> {
  const out: Array<{ boardId: string; progress: GuideProgress }> = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const p = readProgress(k.slice(PREFIX.length));
      if (p) out.push({ boardId: k.slice(PREFIX.length), progress: p });
    }
  } catch {
    // No storage, no saved guides.
  }
  return out.sort((a, b) => b.progress.savedAt - a.progress.savedAt);
}
