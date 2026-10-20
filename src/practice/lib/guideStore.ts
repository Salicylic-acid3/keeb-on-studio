/**
 * Where the guide keeps its progress between visits (SPEC §5.7): per
 * keyboard, in the browser only -- the step reached, the answers, which
 * steps were applied or skipped, and the working keymap with the
 * proposals applied so far.
 */
import type { Trigger } from "../../keyTest/lib/triggers";
import { DEFAULT_ANSWERS, type Answers, type Change } from "./guide";

export type StepStatus = "todo" | "applied" | "skipped" | "done";

export interface GuideProgress {
  version: 1;
  guide: "40";
  step: number;
  answers: Answers;
  status: Record<number, StepStatus>;
  layers: Trigger[][];
  /**
   * What each applied step changed, and what those keys held before, so
   * a step can be revisited: its proposal is made against the keymap as
   * it was before the step, and re-applying first undoes the old changes.
   */
  applied?: Record<number, { changes: Change[]; previous: Change[] }>;
  savedAt: number;
}

const PREFIX = "keeb-on:practice-guide:";

export function readProgress(boardId: string): GuideProgress | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + boardId);
    if (!raw) return null;
    const p = JSON.parse(raw) as GuideProgress;
    if (!p || p.version !== 1 || !Array.isArray(p.layers)) return null;
    // Progress saved by an earlier version may lack newer answers; the
    // defaults fill them in rather than letting the guide fall over.
    const answers: Answers = { ...DEFAULT_ANSWERS, ...(p.answers ?? {}) };
    for (const k of Object.keys(DEFAULT_ANSWERS) as (keyof Answers)[]) {
      const want = DEFAULT_ANSWERS[k];
      const got = answers[k] as unknown;
      const same = Array.isArray(want)
        ? Array.isArray(got)
        : typeof got === typeof want;
      if (!same || got === null)
        (answers as unknown as Record<string, unknown>)[k] = want;
    }
    return {
      ...p,
      answers,
      status: p.status ?? {},
      step: Number.isFinite(p.step) ? p.step : 0,
    };
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

/**
 * Progress made on one drawing of a keyboard carried onto another drawing
 * of it (the registered board's, then the connected keyboard's), with
 * every key position mapped through `at`; what has no key there is dropped.
 */
export function remapProgress(
  p: GuideProgress,
  at: (pos: number) => number | null,
): GuideProgress {
  const mapChanges = (cs: Change[]) =>
    cs.flatMap((c) => {
      const pos = at(c.pos);
      return pos === null ? [] : [{ ...c, pos }];
    });
  const mapRecord = <V>(r: Record<string, V>) =>
    Object.fromEntries(
      Object.entries(r).flatMap(([k, v]) => {
        const pos = at(Number(k));
        return pos === null ? [] : [[String(pos), v]];
      }),
    ) as Record<string, V>;
  const applied = p.applied
    ? Object.fromEntries(
        Object.entries(p.applied).map(([step, a]) => [
          step,
          { changes: mapChanges(a.changes), previous: mapChanges(a.previous) },
        ]),
      )
    : undefined;
  return {
    ...p,
    answers: {
      ...p.answers,
      thumbs: mapRecord(p.answers.thumbs),
      replace: mapRecord(p.answers.replace),
      symbolOverride: mapRecord(p.answers.symbolOverride),
      layerKeyPos: p.answers.layerKeyPos
        .map(at)
        .filter((x): x is number => x !== null),
    },
    ...(applied ? { applied } : {}),
  };
}
