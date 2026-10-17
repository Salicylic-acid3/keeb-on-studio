/**
 * The practice screen: a text to type, the keymap under it, and what the
 * run adds up to once it is done.
 *
 * The keyboard is listened to only while the practice area has focus
 * (clicked to start), so the rest of the page keeps working. Every typed
 * character goes through the engine; what the page adds is the lighting
 * of keys (the key the text wanted on a miss, with the Shift or layer key
 * to hold), the result panel with its heatmap, and the PNG / PDF saving.
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
  IconChevronRight,
  IconDownload,
  IconInfoCircle,
  IconPlayerPlay,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import type { TestBoard } from "../../keyTest/lib/boards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { TEXTS_JA, type PracticeText } from "../data/texts.ja";
import {
  expected,
  isDone,
  press,
  romajiLine,
  startRun,
  unitOfTyped,
  type Run,
  type StopMode,
} from "../lib/engine";
import { findKey } from "../lib/keyLookup";
import {
  pushResult,
  readMode,
  summarize,
  writeMode,
  type Summary,
} from "../lib/results";
import { resultPdf, resultPng } from "../lib/resultPicture";
import { Legend, Notice, SELECT_CLASS, Stat } from "./bits";
import { PracticeBoard, type Mark } from "./PracticeBoard";

type T = (key: string, params?: Record<string, string | number>) => string;

const SHARE_URL = "keeb-on.studio/practice";

/** Whether the keymap types a character, remembered per character. */
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

export function PracticeSession({
  board,
  layout,
  texts = TEXTS_JA,
  t,
  onExit,
}: {
  board: TestBoard;
  layout: LabelLayout;
  texts?: PracticeText[];
  t: T;
  onExit: () => void;
}) {
  const [stopMode, setStopModeState] = useState<StopMode>(() => readMode());
  const setStopMode = (m: StopMode) => {
    setStopModeState(m);
    writeMode(m);
  };
  const [textIndex, setTextIndex] = useState(0);
  const text = texts[textIndex] ?? texts[0];

  const typeable = useMemo(() => typeableOn(board, layout), [board, layout]);

  const [run, setRun] = useState<Run | null>(null);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [imeOn, setImeOn] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setRun(null);
    setLastWrong(null);
    setShowHint(false);
    setImeOn(false);
  }, []);

  const start = () => {
    if (run) return;
    setRun(startRun(text.kana, typeable, performance.now()));
  };

  const done = run ? isDone(run) : false;
  const want = run ? expected(run) : null;
  const hint = useMemo(
    () => (want ? findKey(board, want, layout) : null),
    [board, want, layout],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // The browser must not act on what is typed (Space scrolls, Tab moves
    // focus, "/" opens quick find in some browsers).
    if (e.key.length === 1 || e.key === "Tab" || e.key === "Backspace")
      e.preventDefault();
    if (e.key === "Process") {
      // The IME took the key: nothing reaches the page until it is off.
      setImeOn(true);
      return;
    }
    if (!run || done || e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
    setImeOn(false);
    const r = press(run, e.key, stopMode, typeable, performance.now());
    setRun(r.run);
    if (r.result === "miss") {
      setLastWrong(e.key);
      setShowHint(true);
    } else if (r.result === "ok") {
      setLastWrong(null);
      setShowHint(false);
    }
  };

  const summary = useMemo(
    () => (run && done ? summarize(run, board, layout) : null),
    [run, done, board, layout],
  );

  // Keep the result once, when the run ends.
  const kept = useRef<Run | null>(null);
  useEffect(() => {
    if (!summary || !run || kept.current === run) return;
    kept.current = run;
    pushResult({
      at: Date.now(),
      boardId: board.id,
      boardName: board.name,
      textId: text.id,
      text: text.display,
      accuracy: summary.accuracy,
      cpm: summary.cpm,
      wrongPresses: summary.wrongPresses,
      unavailable: summary.unavailable.map((u) => u.ch),
    });
  }, [summary, run, board, text]);

  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (!run || done) return m;
    if (showHint && hint) {
      for (const id of hint.keys) m.set(id, { tone: "hint" });
      for (const id of [...hint.shift, ...hint.layerKeys])
        m.set(id, { tone: "hold" });
    }
    if (lastWrong && stopMode === "stop") {
      const wrong = findKey(board, lastWrong, layout);
      for (const id of wrong?.keys ?? [])
        if (!m.has(id)) m.set(id, { tone: "wrong" });
    }
    return m;
  }, [run, done, showHint, hint, lastWrong, stopMode, board, layout]);

  const line = run ? romajiLine(run) : null;
  const unitOf = run ? unitOfTyped(run) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("Text")}
            </span>
            <select
              value={textIndex}
              onChange={(e) => {
                setTextIndex(Number(e.target.value));
                reset();
                e.target.blur();
              }}
              className={SELECT_CLASS}
            >
              {texts.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.display}
                </option>
              ))}
            </select>
          </label>
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
          "Turn your IME off before practising: the browser must receive the characters themselves. Japanese text is typed in romaji; every usual spelling (si / shi, tu / tsu, nn / n) counts as correct.",
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
        className={`relative rounded-2xl border p-5 sm:p-6 backdrop-blur-sm outline-none transition-colors cursor-text ${
          run
            ? "border-[var(--color-electric)]/60 bg-[var(--color-surface)]/85 focus:border-[var(--color-electric)]"
            : "border-dashed border-[var(--color-border-hover)] bg-[var(--color-surface)]/60"
        }`}
        data-testid="practice-area"
      >
        {!run && (
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
        <p className="text-xl sm:text-2xl leading-relaxed text-[var(--color-text)] tracking-wide">
          {text.display}
        </p>
        <p className="mt-3 font-mono text-lg sm:text-xl leading-relaxed break-all">
          {line && run ? (
            <>
              {[...line.typed].map((ch, i) => (
                <span
                  key={i}
                  className={
                    run.wrong.has(unitOf[i])
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-neon)]"
                  }
                >
                  {ch === " " ? "␣" : ch}
                </span>
              ))}
              {line.current && (
                <>
                  <span className="bg-[var(--color-electric)]/25 text-[var(--color-text)] rounded-sm underline decoration-[var(--color-electric)] decoration-2 underline-offset-4">
                    {line.current[0] === " " ? "␣" : line.current[0]}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">
                    {line.current.slice(1)}
                  </span>
                </>
              )}
              <span className="text-[var(--color-text-muted)]">
                {line.rest.replace(/ /g, "␣")}
              </span>
            </>
          ) : (
            <span className="text-[var(--color-text-muted)]">
              {startRun(text.kana, () => true, 0)
                .units.map((u) => u.alts[0])
                .join("")
                .replace(/ /g, "␣")}
            </span>
          )}
        </p>
        <div className="mt-3 min-h-[1.5rem] text-sm">
          {imeOn && (
            <span className="text-[var(--color-warning)]">
              {t("The IME seems to be on: turn it off, then type again.")}
            </span>
          )}
          {!imeOn && run && !done && showHint && hint && (
            <span className="text-[var(--color-electric)]">
              {stopMode === "stop"
                ? t("Not that one: the lit key types this character.")
                : t("Counted as a miss; the lit key was the one.")}
              {hint.layerKeys.length > 0 &&
                ` ${t("Hold the layer key (blue) with it.")}`}
              {hint.shift.length > 0 && ` ${t("Hold Shift (blue) with it.")}`}
            </span>
          )}
          {run && run.skipped.length > 0 && !done && (
            <span className="ml-3 text-xs text-[var(--color-text-muted)]">
              {t("Not on the keymap, skipped: {{chars}}", {
                chars: [...new Set(run.skipped.flatMap((s) => s.chars))].join(
                  " ",
                ),
              })}
            </span>
          )}
        </div>
      </section>

      {summary && run ? (
        <ResultPanel
          board={board}
          layout={layout}
          summary={summary}
          text={text}
          t={t}
          onNext={() => {
            setTextIndex((i) => (i + 1) % texts.length);
            reset();
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[var(--color-text)]">
                {board.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {hint && hint.layer > 0 && showHint
                  ? t("Your keymap, layer {{n}}", { n: hint.layer })
                  : t("Your keymap, base layer")}
              </span>
            </div>
            <PracticeBoard
              board={board}
              marks={marks}
              layer={hint && showHint ? hint.layer : 0}
              layout={layout}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
              <Legend color="var(--color-electric)">{t("Key to press")}</Legend>
              <Legend color="var(--color-cyber)">
                {t("Hold with it (layer / Shift)")}
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
            <LiveStats run={run} t={t} />
          </section>
        </div>
      )}
    </div>
  );
}

function LiveStats({ run, t }: { run: Run | null; t: T }) {
  const right = run?.presses.filter((p) => p.ok).length ?? 0;
  const wrong = (run?.presses.length ?? 0) - right;
  const accuracy =
    right + wrong ? Math.round((right / (right + wrong)) * 100) : 100;
  const pairs = new Map<string, number>();
  for (const p of run?.presses ?? [])
    if (!p.ok) {
      const k = `${p.expected}→${p.got}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t("Accuracy")} value={`${accuracy}%`} />
        <Stat label={t("Misses")} value={String(wrong)} />
      </div>
      <div>
        <h3 className="text-xs text-[var(--color-text-muted)]">
          {t("Most missed")}
        </h3>
        {pairs.size === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t("No misses yet.")}
          </p>
        ) : (
          <ul className="mt-1 space-y-1 font-mono text-sm">
            {[...pairs.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([pair, n]) => (
                <li
                  key={pair}
                  className="flex justify-between text-[var(--color-text-secondary)]"
                >
                  <span>{pair.replace(/ /g, "␣")}</span>
                  <span className="tabular-nums">×{n}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                               */
/* ------------------------------------------------------------------ */

function ResultPanel({
  board,
  layout,
  summary,
  text,
  t,
  onNext,
}: {
  board: TestBoard;
  layout: LabelLayout;
  summary: Summary;
  text: PracticeText;
  t: T;
  onNext: () => void;
}) {
  const layers = useMemo(
    () => [0, ...[...summary.heatByLayer.keys()].filter((l) => l !== 0).sort()],
    [summary],
  );
  const [layer, setLayer] = useState(0);
  const marks = useMemo(() => {
    const heat = summary.heatByLayer.get(layer) ?? new Map<string, number>();
    const max = Math.max(0, ...heat.values());
    const m = new Map<string, Mark>();
    for (const [id, count] of heat)
      m.set(id, { tone: "heat", level: max ? count / max : 0, count });
    return m;
  }, [summary, layer]);

  const [saving, setSaving] = useState<"png" | "pdf" | null>(null);
  const [failed, setFailed] = useState(false);
  const pictureInput = () => ({
    board,
    layout,
    summary,
    text: {
      title: t("Typing practice result"),
      boardName: board.name,
      text: text.display,
      date: new Date().toLocaleDateString(),
      accuracy: t("Accuracy"),
      speed: t("Chars/min"),
      misses: t("Misses"),
      mostMissed: t("Most missed"),
      unavailable: t("Characters not on the keymap"),
      none: t("None."),
      layerName: (n: number) =>
        n === 0 ? t("Base layer") : t("Layer {{n}}", { n }),
      credit: `Keeb-On! Studio  ${SHARE_URL}`,
    },
  });
  const fileStem = `practice-${board.id}-${new Date().toISOString().slice(0, 10)}`;
  const save = async (kind: "png" | "pdf") => {
    setSaving(kind);
    setFailed(false);
    try {
      const blob =
        kind === "png"
          ? await resultPng(pictureInput())
          : resultPdf(pictureInput());
      if (!blob) throw new Error("no picture");
      saveBlob(blob, `${fileStem}.${kind}`);
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-[var(--color-text)]">
            {t("Where the misses were")}
          </span>
          {layers.length > 1 && (
            <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] divide-x divide-[var(--color-border)] text-xs">
              {layers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLayer(n)}
                  className={`h-8 px-3 transition-colors ${
                    layer === n
                      ? "bg-[var(--color-electric)]/15 text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {n === 0 ? t("Base layer") : t("Layer {{n}}", { n })}
                </button>
              ))}
            </div>
          )}
        </div>
        <PracticeBoard
          board={board}
          marks={marks}
          layer={layer}
          layout={layout}
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          {t(
            "Each key is tinted by how often it was missed, with the count in its corner.",
          )}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
          <IconInfoCircle size={18} className="text-[var(--color-cyber)]" />
          {t("Result")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t("Accuracy")} value={`${summary.accuracy}%`} />
          <Stat
            label={t("Speed")}
            value={summary.cpm ? t("{{n}} chars/min", { n: summary.cpm }) : "—"}
          />
        </div>
        <div>
          <h3 className="text-xs text-[var(--color-text-muted)]">
            {t("Most missed")}
          </h3>
          {summary.pairs.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t("No misses.")}
            </p>
          ) : (
            <ul className="mt-1 space-y-1 font-mono text-sm">
              {summary.pairs.slice(0, 6).map((p) => (
                <li
                  key={`${p.expected}${p.got}`}
                  className="flex justify-between text-[var(--color-text-secondary)]"
                >
                  <span>
                    {show(p.expected)} → {show(p.got)}
                  </span>
                  <span className="tabular-nums">×{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs text-[var(--color-text-muted)]">
            {t("Characters not on the keymap")}
          </h3>
          {summary.unavailable.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t("None.")}
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {summary.unavailable.map((u) => (
                <span
                  key={u.ch}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-0.5 font-mono text-xs text-[var(--color-text)]"
                >
                  {show(u.ch)}
                  {u.count > 1 ? ` ×${u.count}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save("png")}
              className="btn-ghost h-9 border border-[var(--color-border)] flex items-center gap-2 text-sm disabled:opacity-60"
            >
              <IconDownload size={16} />
              PNG
            </button>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save("pdf")}
              className="btn-ghost h-9 border border-[var(--color-border)] flex items-center gap-2 text-sm disabled:opacity-60"
            >
              <IconDownload size={16} />
              PDF
            </button>
            <button
              type="button"
              onClick={onNext}
              className="btn-electric h-9 px-4 text-sm flex items-center gap-2"
            >
              {t("Next text")}
              <IconChevronRight size={16} />
            </button>
          </div>
          {failed && (
            <p className="text-xs text-[var(--color-warning)]">
              {t("The picture could not be made.")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function show(ch: string): string {
  return ch === " " ? "␣" : ch;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ModeToggle({
  t,
  value,
  onChange,
}: {
  t: T;
  value: StopMode;
  onChange: (v: StopMode) => void;
}) {
  const opt = (v: StopMode, label: string, title: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      title={title}
      className={`h-9 px-3 text-sm transition-colors ${
        value === v
          ? "bg-[var(--color-electric)]/15 text-[var(--color-text)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <IconSettings size={14} className="text-[var(--color-text-muted)]" />
      <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] divide-x divide-[var(--color-border)]">
        {opt(
          "stop",
          t("Stop at a miss"),
          t("A wrong key stops the text and lights the key you meant."),
        )}
        {opt(
          "advance",
          t("Keep going"),
          t("A wrong key is counted and the text moves on."),
        )}
      </div>
    </div>
  );
}
