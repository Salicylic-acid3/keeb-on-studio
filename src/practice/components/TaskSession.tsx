/**
 * Practice as tasks (SPEC §6.3): the cursor keys, the numpad, the F keys
 * and shortcuts, which a sentence cannot exercise. Each task is a few
 * steps; a step is judged on key events and lights the key the task
 * wants on a miss, like the text practice does.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  IconArrowsShuffle,
  IconCheck,
  IconInfoCircle,
  IconPlayerPlay,
  IconRefresh,
} from "@tabler/icons-react";
import type { TestBoard } from "../../keyTest/lib/boards";
import type { Mod } from "../../keyTest/lib/triggers";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import {
  expected as expectedChar,
  isDone,
  press,
  romajiLine,
  startRun,
  type Press,
  type Run,
  type Skipped,
  type StopMode,
} from "../lib/engine";
import { findKey, findKeyByCode, modifierKeys } from "../lib/keyLookup";
import {
  pushResult,
  readMode,
  summarize,
  writeMode,
  type RunStats,
} from "../lib/results";
import {
  cursorHint,
  matchesChord,
  MOD_LABEL,
  modsOn,
  moveCursor,
  sameCursor,
  TASKS,
  type Cursor,
  type Task,
  type TaskStep,
  type TaskTag,
} from "../lib/tasks";
import { Legend, Notice, Stat } from "./bits";
import { PracticeBoard, type Mark } from "./PracticeBoard";
import { ModeToggle, ResultPanel } from "./PracticeSession";

type T = (key: string, params?: Record<string, string | number>) => string;

const TAGS: Array<[TaskTag, string]> = [
  ["cursor", "Cursor"],
  ["numpad", "Numbers"],
  ["fkeys", "F keys"],
  ["shortcuts", "Shortcuts"],
];

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return /mac|iphone|ipad/i.test(
    nav.userAgentData?.platform || navigator.platform || "",
  );
}

/** The state of the step being worked on. */
type StepState =
  | { kind: "text"; run: Run }
  | { kind: "key"; done: boolean }
  | { kind: "cursor"; at: Cursor; moves: number };

interface Progress {
  step: number;
  state: StepState | null;
  presses: Press[];
  skipped: Skipped[];
  /** Keys and characters that went in right, for the speed. */
  typed: number;
  startedAt: number | null;
  finishedAt: number | null;
}

function pickTask(tasks: Task[], not?: Task): Task {
  const pool = tasks.filter((x) => x.id !== not?.id);
  if (!pool.length) return not ?? tasks[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function typeableOn(board: TestBoard, layout: LabelLayout) {
  const cache = new Map<string, boolean>();
  return (ch: string) => {
    let v = cache.get(ch);
    if (v === undefined) {
      v = findKey(board, ch, layout) !== null;
      cache.set(ch, v);
    }
    return v;
  };
}

function enterStep(
  task: Task,
  index: number,
  typeable: (ch: string) => boolean,
  now: number,
): StepState | null {
  const step = task.steps[index];
  if (!step) return null;
  switch (step.kind) {
    case "text":
      return { kind: "text", run: startRun(step.text, typeable, now) };
    case "key":
      return { kind: "key", done: false };
    case "cursor":
      return { kind: "cursor", at: step.from, moves: 0 };
  }
}

export function TaskSession({
  board,
  layout,
  t,
  onExit,
}: {
  board: TestBoard;
  layout: LabelLayout;
  t: T;
  onExit: () => void;
}) {
  const mac = useMemo(() => isMac(), []);
  const [stopMode, setStopModeState] = useState<StopMode>(() => readMode());
  const setStopMode = (m: StopMode) => {
    setStopModeState(m);
    writeMode(m);
  };
  const typeable = useMemo(() => typeableOn(board, layout), [board, layout]);

  const [allowed, setAllowed] = useState<Set<TaskTag>>(
    () => new Set<TaskTag>(["cursor", "numpad", "fkeys", "shortcuts"]),
  );
  const pool = useMemo(() => {
    const within = TASKS.filter((x) => x.tags.every((tag) => allowed.has(tag)));
    return within.length ? within : TASKS;
  }, [allowed]);
  const [task, setTask] = useState<Task>(() => pickTask(TASKS));
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setProgress(null);
    setLastWrong(null);
    setShowHint(false);
  }, []);
  const toggleTag = (tag: TaskTag) => {
    const next = new Set(allowed);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    if (next.size === 0) return;
    setAllowed(next);
    const within = TASKS.filter((x) => x.tags.every((g) => next.has(g)));
    if (within.length && !within.some((x) => x.id === task.id)) {
      setTask(pickTask(within));
      reset();
    }
  };
  const another = () => {
    setTask(pickTask(pool, task));
    reset();
  };
  const start = () => {
    if (progress) return;
    setProgress({
      step: 0,
      state: enterStep(task, 0, typeable, performance.now()),
      presses: [],
      skipped: [],
      typed: 0,
      startedAt: null,
      finishedAt: null,
    });
  };

  const step: TaskStep | undefined = progress
    ? task.steps[progress.step]
    : undefined;
  const done = progress !== null && progress.step >= task.steps.length;

  /** The key (and modifiers) the step wants now, for the hint. */
  const want = useMemo(() => {
    if (!progress || !step || !progress.state) return null;
    const st = progress.state;
    if (st.kind === "text" && step.kind === "text") {
      const ch = expectedChar(st.run);
      return ch
        ? { hint: findKey(board, ch, layout), mods: [] as Mod[], label: ch }
        : null;
    }
    if (st.kind === "key" && step.kind === "key") {
      const mods = modsOn(step.mods, mac);
      return {
        hint: findKeyByCode(board, step.code),
        mods,
        label: [...mods.map((m) => MOD_LABEL[m]), step.label].join(" + "),
      };
    }
    if (st.kind === "cursor" && step.kind === "cursor") {
      const code = cursorHint(step.lines, st.at, step.to);
      return code
        ? { hint: findKeyByCode(board, code), mods: [] as Mod[], label: code }
        : null;
    }
    return null;
  }, [progress, step, board, layout, mac]);

  const unavailableNow =
    want !== null && want.hint === null && progress !== null && !done;

  const advance = (p: Progress, now: number): Progress => {
    const nextIndex = p.step + 1;
    if (nextIndex >= task.steps.length)
      return { ...p, step: nextIndex, state: null, finishedAt: now };
    return {
      ...p,
      step: nextIndex,
      state: enterStep(task, nextIndex, typeable, now),
    };
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Nothing typed here may reach the browser: F5 reloads, Ctrl+S saves.
    if (e.key !== "Escape") e.preventDefault();
    if (!progress || done || !step || !progress.state) return;
    // A modifier on its own is the start of a chord, not a press.
    if (/^(Shift|Control|Alt|Meta|OS)/.test(e.code)) return;
    const now = performance.now();
    const startedAt = progress.startedAt ?? now;
    const st = progress.state;

    // A step wanting a key the keymap does not have is skipped and recorded
    // (SPEC §6.3), with Escape so the skip is deliberate.
    if (e.key === "Escape") {
      if (!unavailableNow || !want) return;
      setProgress(
        advance(
          {
            ...progress,
            startedAt,
            skipped: [
              ...progress.skipped,
              { unit: progress.step, text: want.label, chars: [want.label] },
            ],
          },
          now,
        ),
      );
      return;
    }

    if (st.kind === "text" && step.kind === "text") {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
      const r = press(st.run, e.key, stopMode, typeable, now);
      let next: Progress = {
        ...progress,
        startedAt,
        state: { kind: "text", run: r.run },
        presses:
          r.run.presses.length !== st.run.presses.length
            ? [
                ...progress.presses,
                ...r.run.presses.slice(st.run.presses.length),
              ]
            : progress.presses,
        skipped: [
          ...progress.skipped,
          ...r.run.skipped.slice(st.run.skipped.length),
        ],
        typed: progress.typed + (r.result === "ok" ? 1 : 0),
      };
      if (r.result === "miss") {
        setLastWrong(e.key);
        setShowHint(true);
      } else if (r.result === "ok") {
        setLastWrong(null);
        setShowHint(false);
      }
      if (isDone(r.run)) next = advance(next, now);
      setProgress(next);
      return;
    }

    if (st.kind === "key" && step.kind === "key") {
      const mods = modsOn(step.mods, mac);
      const ok = matchesChord(
        {
          code: e.code,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
          shift: e.shiftKey,
        },
        step.code,
        mods,
      );
      const label = want?.label ?? step.label;
      const got = [
        ...(e.ctrlKey ? ["Ctrl"] : []),
        ...(e.altKey ? ["Alt"] : []),
        ...(e.metaKey ? ["⌘"] : []),
        ...(e.shiftKey ? ["Shift"] : []),
        e.key.length === 1 ? e.key.toUpperCase() : e.key,
      ].join(" + ");
      const pressed: Press = {
        unit: progress.step,
        expected: label,
        got,
        ok,
        time: now,
        code: step.code,
      };
      let next: Progress = {
        ...progress,
        startedAt,
        presses: [...progress.presses, pressed],
        typed: progress.typed + (ok ? 1 : 0),
      };
      if (ok) {
        setLastWrong(null);
        setShowHint(false);
        next = advance(next, now);
      } else {
        setLastWrong(e.code);
        setShowHint(true);
        if (stopMode === "advance") next = advance(next, now);
      }
      setProgress(next);
      return;
    }

    if (st.kind === "cursor" && step.kind === "cursor") {
      const moved = moveCursor(step.lines, st.at, e.code);
      const label = want?.label ?? "";
      if (!moved) {
        // Not a navigation key: a miss of the key the route wants.
        const pressed: Press = {
          unit: progress.step,
          expected: label,
          got: e.key.length === 1 ? e.key : e.code,
          ok: false,
          time: now,
          code: label || undefined,
        };
        setLastWrong(e.code);
        setShowHint(true);
        setProgress({
          ...progress,
          startedAt,
          presses: [...progress.presses, pressed],
        });
        return;
      }
      const pressed: Press = {
        unit: progress.step,
        expected: label,
        got: e.code,
        ok: true,
        time: now,
        code: e.code,
      };
      setLastWrong(null);
      setShowHint(false);
      let next: Progress = {
        ...progress,
        startedAt,
        state: { kind: "cursor", at: moved, moves: st.moves + 1 },
        presses: [...progress.presses, pressed],
        typed: progress.typed + 1,
      };
      if (sameCursor(moved, step.to)) next = advance(next, now);
      setProgress(next);
    }
  };

  const summary = useMemo(() => {
    if (!progress || !done) return null;
    const stats: RunStats = {
      presses: progress.presses,
      skipped: progress.skipped,
      typedChars: progress.typed,
      startedAt: progress.startedAt,
      finishedAt: progress.finishedAt,
    };
    return summarize(stats, board, layout);
  }, [progress, done, board, layout]);
  const kept = useRef<Progress | null>(null);
  useEffect(() => {
    if (!summary || !progress || kept.current === progress) return;
    kept.current = progress;
    pushResult({
      at: Date.now(),
      boardId: board.id,
      boardName: board.name,
      textId: task.id,
      text: t(task.title),
      accuracy: summary.accuracy,
      cpm: summary.cpm,
      wrongPresses: summary.wrongPresses,
      unavailable: summary.unavailable.map((u) => u.ch),
    });
  }, [summary, progress, board, task, t]);

  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (!progress || done) return m;
    if (showHint && want?.hint) {
      for (const id of want.hint.keys) m.set(id, { tone: "hint" });
      for (const id of [...want.hint.shift, ...want.hint.layerKeys])
        m.set(id, { tone: "hold" });
      for (const mod of want.mods)
        for (const id of modifierKeys(board, mod)) m.set(id, { tone: "hold" });
    }
    if (lastWrong && stopMode === "stop") {
      const wrong =
        lastWrong.length === 1
          ? findKey(board, lastWrong, layout)
          : findKeyByCode(board, lastWrong);
      for (const id of wrong?.keys ?? [])
        if (!m.has(id)) m.set(id, { tone: "wrong" });
    }
    return m;
  }, [progress, done, showHint, want, lastWrong, stopMode, board, layout]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--color-text-muted)]">
              {t("Task")}
            </span>
            {TAGS.map(([tag, label]) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={allowed.has(tag)}
                className={`h-8 rounded-full border px-3 text-xs transition-colors ${
                  allowed.has(tag)
                    ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {t(label)}
              </button>
            ))}
            <button
              type="button"
              onClick={another}
              className="btn-ghost h-8 border border-[var(--color-border)] flex items-center gap-1.5 text-xs"
            >
              <IconArrowsShuffle size={14} />
              {t("Another task")}
            </button>
          </div>
          <ModeToggle t={t} value={stopMode} onChange={setStopMode} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn-ghost h-9 border border-[var(--color-border)] flex items-center gap-2 text-sm"
          >
            <IconRefresh size={16} />
            {t("Reset")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="btn-ghost h-9 border border-[var(--color-border)] text-sm"
          >
            {t("Back to the start")}
          </button>
        </div>
      </div>

      <Notice>
        {t(
          "Shortcuts are shown for this computer: Ctrl on Windows, ⌘ on a Mac. Shortcuts the browser itself handles (closing the tab, a new window) cannot be practised here.",
        )}
      </Notice>

      <section
        ref={areaRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={() => {
          start();
          areaRef.current?.focus();
        }}
        className={`relative rounded-2xl border p-5 sm:p-6 backdrop-blur-sm outline-none transition-colors cursor-default ${
          progress
            ? "border-[var(--color-electric)]/60 bg-[var(--color-surface)]/85 focus:border-[var(--color-electric)]"
            : "border-dashed border-[var(--color-border-hover)] bg-[var(--color-surface)]/60"
        }`}
        data-testid="task-area"
      >
        {!progress && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg)]/40">
            <span className="flex items-center gap-2 rounded-full border border-[var(--color-electric)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text)]">
              <IconPlayerPlay
                size={16}
                className="text-[var(--color-electric)]"
              />
              {t("Click here to start")}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-medium text-[var(--color-text)]">
            {t(task.title)}
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("Step {{n}} of {{total}}", {
              n: Math.min((progress?.step ?? 0) + 1, task.steps.length),
              total: task.steps.length,
            })}
          </span>
        </div>
        <ol className="mt-3 space-y-2">
          {task.steps.map((s, i) => {
            const current = progress ? i === progress.step : i === 0;
            const finished = progress ? i < progress.step : false;
            return (
              <li
                key={i}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  current && progress
                    ? "border-[var(--color-electric)]/60 bg-[var(--color-electric)]/5"
                    : finished
                      ? "border-[var(--color-neon)]/40"
                      : "border-[var(--color-border)]"
                }`}
              >
                <span className="mt-0.5 w-5 flex-shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                  {finished ? (
                    <IconCheck size={14} className="text-[var(--color-neon)]" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm text-[var(--color-text)]">
                    {s.prompt ? t(s.prompt) : ""}
                    {s.kind === "key" && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle">
                        {[
                          ...modsOn(s.mods, mac).map((m) => MOD_LABEL[m]),
                          s.label,
                        ].map((k, j) => (
                          <kbd
                            key={j}
                            className="rounded-md border border-[var(--color-border-hover)] bg-[var(--color-surface-elevated)] px-1.5 py-0.5 font-mono text-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    )}
                  </p>
                  {s.kind === "text" && (
                    <TextLine
                      step={s}
                      run={
                        current && progress?.state?.kind === "text"
                          ? progress.state.run
                          : null
                      }
                    />
                  )}
                  {s.kind === "cursor" && (
                    <Editor
                      t={t}
                      lines={s.lines}
                      at={
                        current && progress?.state?.kind === "cursor"
                          ? progress.state.at
                          : finished
                            ? s.to
                            : s.from
                      }
                      to={s.to}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 min-h-[1.5rem] text-sm">
          {progress && !done && showHint && want?.hint && (
            <span className="text-[var(--color-electric)]">
              {stopMode === "stop"
                ? t("Not that one: the lit key is the one.")
                : t("Counted as a miss; the lit key was the one.")}
              {want.hint.layerKeys.length > 0 &&
                ` ${t("Hold the layer key (blue) with it.")}`}
              {want.mods.length > 0 &&
                ` ${t("Hold the modifier (blue) with it.")}`}
            </span>
          )}
          {unavailableNow && (
            <span className="text-[var(--color-warning)]">
              {t(
                "This key is not set anywhere on the keymap. Skip the step with Escape.",
              )}
            </span>
          )}
        </div>
      </section>

      {summary && progress ? (
        <ResultPanel
          board={board}
          layout={layout}
          summary={summary}
          text={t(task.title)}
          t={t}
          onNext={another}
          nextLabel={t("Next task")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[var(--color-text)]">
                {board.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {want?.hint && want.hint.layer > 0 && showHint
                  ? t("Your keymap, layer {{n}}", { n: want.hint.layer })
                  : t("Your keymap, base layer")}
              </span>
            </div>
            <PracticeBoard
              board={board}
              marks={marks}
              layer={want?.hint && showHint ? want.hint.layer : 0}
              layout={layout}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
              <Legend color="var(--color-electric)">{t("Key to press")}</Legend>
              <Legend color="var(--color-cyber)">
                {t("Hold with it (layer / modifier)")}
              </Legend>
              <Legend color="var(--color-warning)">
                {t("Pressed by mistake")}
              </Legend>
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
              <IconInfoCircle size={18} className="text-[var(--color-cyber)]" />
              {t("So far")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={t("Accuracy")}
                value={`${
                  progress && progress.presses.length
                    ? Math.round(
                        (progress.presses.filter((p) => p.ok).length /
                          progress.presses.length) *
                          100,
                      )
                    : 100
                }%`}
              />
              <Stat
                label={t("Misses")}
                value={String(
                  progress?.presses.filter((p) => !p.ok).length ?? 0,
                )}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function TextLine({
  step,
  run,
}: {
  step: Extract<TaskStep, { kind: "text" }>;
  run: Run | null;
}) {
  if (!run)
    return (
      <p className="font-mono text-lg text-[var(--color-text-muted)]">
        {step.text}
      </p>
    );
  const line = romajiLine(run);
  return (
    <p className="font-mono text-lg break-all">
      <span className="text-[var(--color-neon)]">{line.typed}</span>
      {line.current && (
        <>
          <span className="bg-[var(--color-electric)]/25 text-[var(--color-text)] rounded-sm underline decoration-[var(--color-electric)] decoration-2 underline-offset-4">
            {line.current[0]}
          </span>
          <span className="text-[var(--color-text-secondary)]">
            {line.current.slice(1)}
          </span>
        </>
      )}
      <span className="text-[var(--color-text-muted)]">{line.rest}</span>
    </p>
  );
}

/** A few lines of text with the cursor drawn in, and the target marked. */
function Editor({
  t,
  lines,
  at,
  to,
}: {
  t: T;
  lines: string[];
  at: Cursor;
  to: Cursor;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 px-3 py-2 font-mono text-base leading-7">
      {lines.map((line, r) => {
        const cells = [...line, ""];
        return (
          <div key={r} className="whitespace-pre">
            {cells.map((ch, c) => {
              const here = at.row === r && at.col === c;
              const target = to.row === r && to.col === c && !here;
              return (
                <span key={c} className="relative">
                  {(here || target) && (
                    <span
                      className={`absolute -left-px top-0 h-full w-0.5 ${
                        here
                          ? "bg-[var(--color-electric)]"
                          : "bg-[var(--color-neon)] opacity-70"
                      }`}
                      aria-hidden
                    />
                  )}
                  {ch || " "}
                </span>
              );
            })}
          </div>
        );
      })}
      <div className="mt-1 flex gap-4 text-[10px] text-[var(--color-text-muted)]">
        <span>
          <span className="inline-block h-3 w-0.5 bg-[var(--color-electric)] align-middle" />{" "}
          {t("cursor")}
        </span>
        <span>
          <span className="inline-block h-3 w-0.5 bg-[var(--color-neon)] align-middle" />{" "}
          {t("target")}
        </span>
      </div>
    </div>
  );
}
