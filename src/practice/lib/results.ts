/**
 * What a finished run adds up to (SPEC §7), and the browser-side keeping
 * of the mode and the last few results (SPEC §10: local only).
 */
import type { TestBoard } from "../../keyTest/lib/boards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import type { Press, Run, Skipped, StopMode } from "./engine";
import { findKey, findKeyByCode } from "./keyLookup";

export interface MissPair {
  expected: string;
  got: string;
  count: number;
}

export interface Unavailable {
  ch: string;
  count: number;
}

export interface Summary {
  /** Right presses over all presses, 0-100. */
  accuracy: number;
  /** Characters typed per minute; 0 when the run has no duration. */
  cpm: number;
  seconds: number;
  typedChars: number;
  rightPresses: number;
  wrongPresses: number;
  /** Misses per key id, counted on the key the text wanted. */
  heat: Map<string, number>;
  /** Misses per layer (0 = base), so the heatmap can switch between them. */
  heatByLayer: Map<number, Map<string, number>>;
  /** Wanted → got, most frequent first. */
  pairs: MissPair[];
  unavailable: Unavailable[];
}

/** What a summary is made from: a text run, or a task's steps put together. */
export interface RunStats {
  presses: Press[];
  skipped: Skipped[];
  /** Characters (or keys) that went in right, for the speed. */
  typedChars: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export function runStats(run: Run): RunStats {
  return {
    presses: run.presses,
    skipped: run.skipped,
    typedChars: run.done.join("").length + run.prefix.length,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

export function summarize(
  run: RunStats,
  board: TestBoard,
  layout: LabelLayout,
): Summary {
  const right = run.presses.filter((p) => p.ok).length;
  const wrong = run.presses.length - right;
  const typed = run.typedChars;
  const seconds =
    run.startedAt !== null && run.finishedAt !== null
      ? Math.max(0, run.finishedAt - run.startedAt) / 1000
      : 0;
  const cpm = seconds > 0 ? Math.round((typed / seconds) * 60) : 0;

  const heat = new Map<string, number>();
  const heatByLayer = new Map<number, Map<string, number>>();
  const pairCount = new Map<string, MissPair>();
  for (const p of run.presses) {
    if (p.ok || !p.expected) continue;
    const key = `${p.expected}\u0000${p.got}`;
    const pair = pairCount.get(key) ?? {
      expected: p.expected,
      got: p.got,
      count: 0,
    };
    pair.count++;
    pairCount.set(key, pair);
    const hint = p.code
      ? findKeyByCode(board, p.code)
      : findKey(board, p.expected, layout);
    if (!hint) continue;
    for (const id of hint.keys) {
      heat.set(id, (heat.get(id) ?? 0) + 1);
      const layer = heatByLayer.get(hint.layer) ?? new Map<string, number>();
      layer.set(id, (layer.get(id) ?? 0) + 1);
      heatByLayer.set(hint.layer, layer);
    }
  }

  const unavailableCount = new Map<string, number>();
  for (const s of run.skipped)
    for (const ch of s.chars)
      unavailableCount.set(ch, (unavailableCount.get(ch) ?? 0) + 1);

  return {
    accuracy: right + wrong ? Math.round((right / (right + wrong)) * 100) : 100,
    cpm,
    seconds,
    typedChars: typed,
    rightPresses: right,
    wrongPresses: wrong,
    heat,
    heatByLayer,
    pairs: [...pairCount.values()].sort((a, b) => b.count - a.count),
    unavailable: [...unavailableCount.entries()].map(([ch, count]) => ({
      ch,
      count,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Local storage                                                        */
/* ------------------------------------------------------------------ */

const MODE_KEY = "keeb-on:practice-mode";
const RESULTS_KEY = "keeb-on:practice-results";
const MAX_RESULTS = 20;

export interface StoredResult {
  at: number;
  boardId: string;
  boardName: string;
  textId: string;
  text: string;
  accuracy: number;
  cpm: number;
  wrongPresses: number;
  unavailable: string[];
}

export function readMode(): StopMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    return v === "advance" ? "advance" : "stop";
  } catch {
    return "stop";
  }
}

export function writeMode(mode: StopMode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Private windows and blocked storage: the choice just is not kept.
  }
}

export function readResults(): StoredResult[] {
  try {
    const raw = window.localStorage.getItem(RESULTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as StoredResult[]) : [];
  } catch {
    return [];
  }
}

export function pushResult(result: StoredResult): StoredResult[] {
  const list = [result, ...readResults()].slice(0, MAX_RESULTS);
  try {
    window.localStorage.setItem(RESULTS_KEY, JSON.stringify(list));
  } catch {
    // Not kept, which is fine.
  }
  return list;
}
