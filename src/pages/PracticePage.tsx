/**
 * Typing practice and the keymap setup guide, at /practice (SPEC: docs/
 * practice/SPEC.md). Phase 0: a screen mock to settle the look and the
 * flow before the real thing is built.
 *
 * What is mocked: one guide step (symbol priority) with a proposal drawn
 * on the keymap and Apply / Skip; the practice screen, which does listen
 * to the keyboard but compares plain characters only; the result panel.
 * What is not here yet: romaji variants, the other steps, saving, images.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevronRight,
  IconCompass,
  IconExternalLink,
  IconGripVertical,
  IconKeyboard,
  IconPlayerPlay,
  IconRoute,
  IconSchool,
  IconTypography,
} from "@tabler/icons-react";
import { StandaloneFrame } from "../components/StandaloneFrame";
import { useLanguage } from "../hooks/useLanguage";
import {
  testBoard,
  testBoardEntries,
  type TestBoard,
} from "../keyTest/lib/boards";
import type { LabelLayout } from "../layoutEditor/lib/keyLabels";
import { PracticeBoard, type Mark } from "../practice/components/PracticeBoard";
import { PracticeSession } from "../practice/components/PracticeSession";
import { TaskSession } from "../practice/components/TaskSession";
import { MetaEditor } from "../practice/components/MetaEditor";
import { Legend, Notice } from "../practice/components/bits";
import {
  GUIDE_40,
  SYMBOLS,
  symbolSlots,
  type PracticeMode,
  type SymbolChoice,
} from "../practice/lib/mock";

export const PRACTICE_PATH = "/practice";

const DEFAULT_BOARD = "goforty_max_ortho";

type T = (key: string, params?: Record<string, string | number>) => string;

export function PracticePage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const entries = useMemo(
    () => testBoardEntries().filter((e) => e.group !== "standard"),
    [],
  );
  const [boardId, setBoardId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("keyboard");
    return fromUrl && entries.some((e) => e.id === fromUrl)
      ? fromUrl
      : DEFAULT_BOARD;
  });
  const board = useMemo(
    () => testBoard(boardId) ?? testBoard(entries[0].id)!,
    [boardId, entries],
  );
  const [mode, setMode] = useState<PracticeMode>(() =>
    new URLSearchParams(window.location.search).has("meta") ? "meta" : "pick",
  );
  const [kind, setKind] = useState<"text" | "task">("text");
  const [layout, setLayout] = useState<LabelLayout>("us");

  return (
    <StandaloneFrame onBack={onBack}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-light tracking-wide text-[var(--color-text)]">
              <IconSchool size={26} className="text-[var(--color-electric)]" />
              {t("Typing practice")}
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-3xl">
              {t(
                "Decide your keymap step by step, then practise on it with the real keymap in front of you. A wrong key points straight at the key you meant, so what you learn here feeds back into the layout.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 min-w-[14rem]">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Keyboard to practise on")}
              </span>
              <select
                value={board.id}
                onChange={(e) => {
                  setBoardId(e.target.value);
                  e.target.blur();
                }}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]"
              >
                {(["zmk", "qmk"] as const).map((group) => (
                  <optgroup
                    key={group}
                    label={t(
                      group === "zmk" ? "ZMK keyboards" : "QMK keyboards",
                    )}
                  >
                    {entries
                      .filter((e) => e.group === group)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("OS keyboard layout")}
              </span>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as LabelLayout)}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-electric)]"
              >
                <option value="us">US</option>
                <option value="jis">JIS</option>
              </select>
            </label>
          </div>
        </div>

        <Notice>
          {t(
            "Demo mode: the keymap shown is this keyboard's default. With a keyboard connected, the guide and the practice use the keymap read from it.",
          )}
        </Notice>

        {mode === "meta" && <MetaEditor key={board.id} board={board} t={t} />}
        {mode === "pick" && <ModePicker t={t} onPick={setMode} />}
        {mode === "guide" && (
          <Guide
            key={board.id}
            board={board}
            t={t}
            onPractice={() => setMode("free")}
            onExit={() => setMode("pick")}
          />
        )}
        {mode === "free" && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Practise with")}
              </span>
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] divide-x divide-[var(--color-border)]">
                {(["text", "task"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`h-9 px-4 text-sm transition-colors ${
                      kind === k
                        ? "bg-[var(--color-electric)]/15 text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {k === "text" ? t("Sentences") : t("Tasks")}
                  </button>
                ))}
              </div>
            </div>
            {kind === "text" ? (
              <PracticeSession
                key={`${board.id}:${layout}`}
                board={board}
                layout={layout}
                t={t}
                onExit={() => setMode("pick")}
              />
            ) : (
              <TaskSession
                key={`${board.id}:${layout}`}
                board={board}
                layout={layout}
                t={t}
                onExit={() => setMode("pick")}
              />
            )}
          </>
        )}
      </div>
    </StandaloneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Mode picker                                                          */
/* ------------------------------------------------------------------ */

function ModePicker({
  t,
  onPick,
}: {
  t: T;
  onPick: (mode: PracticeMode) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard
          icon={<IconRoute size={22} />}
          title={t("Setup guide")}
          body={t(
            "Questions in order: which symbols you use most, where your thumb lands for Space, which thumb key becomes a layer key, what goes on each layer. Each answer becomes a proposal drawn on your keymap, to apply or skip. Practice follows every finished layer.",
          )}
          action={t("Start the guide")}
          onClick={() => onPick("guide")}
          primary
        />
        <ModeCard
          icon={<IconTypography size={22} />}
          title={t("Free practice")}
          body={t(
            "Practise sentences and tasks on the keymap as it is now. Stop at a wrong key and see which key you meant, or keep going and read the misses at the end.",
          )}
          action={t("Start practising")}
          onClick={() => onPick("free")}
        />
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--color-border-hover)] px-5 py-4 text-sm">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <IconCompass size={18} className="text-[var(--color-neon)]" />
          <span>
            {t("Last time: {{keyboard}}, step {{n}} of {{total}} ({{step}})", {
              keyboard: "GoFortyMax Ortho",
              n: 4,
              total: GUIDE_40.length,
              step: t("Thumb keys"),
            })}
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost h-9 border border-[var(--color-border)] text-sm opacity-60 cursor-not-allowed"
          disabled
          title={t("Saved progress comes in phase 4")}
        >
          {t("Continue where you left off")}
        </button>
      </section>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  body,
  action,
  onClick,
  primary = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm">
      <h2 className="flex items-center gap-2 text-base font-medium text-[var(--color-text)]">
        <span className="text-[var(--color-cyber)]">{icon}</span>
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {body}
      </p>
      <button
        type="button"
        onClick={onClick}
        className={`mt-5 h-10 self-start px-4 text-sm flex items-center gap-2 ${
          primary
            ? "btn-electric"
            : "btn-ghost border border-[var(--color-border)]"
        }`}
      >
        {action}
        <IconChevronRight size={16} />
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Guide: one step mocked                                               */
/* ------------------------------------------------------------------ */

type StepStatus = "todo" | "applied" | "skipped";

function Guide({
  board,
  t,
  onPractice,
  onExit,
}: {
  board: TestBoard;
  t: T;
  onPractice: () => void;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState(1); // Symbol priority
  const [status, setStatus] = useState<Record<number, StepStatus>>({
    0: "applied",
  });
  const [order, setOrder] = useState<SymbolChoice[]>(SYMBOLS);
  const [proposed, setProposed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const slots = useMemo(() => symbolSlots(board), [board]);
  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (!proposed) return m;
    slots.forEach((slot, i) => {
      const sym = order[i];
      if (sym) m.set(slot.id, { tone: "set", label: sym.ch });
    });
    return m;
  }, [proposed, slots, order]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setProposed(false);
  };
  // Dragging a row: it is lifted out and dropped in at the row under it.
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dropOn = (i: number) => {
    if (dragging === null || dragging === i) return;
    const next = [...order];
    const [row] = next.splice(dragging, 1);
    next.splice(i, 0, row);
    setOrder(next);
    setProposed(false);
  };
  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };

  const finish = (how: StepStatus) => {
    setStatus((s) => ({ ...s, [current]: how }));
    if (how === "applied")
      setToast(
        t("Applied to the keymap (demo mode: kept in the browser only)."),
      );
    setCurrent((c) => Math.min(GUIDE_40.length - 1, c + 1));
  };

  const step = GUIDE_40[current];

  return (
    <div className="space-y-4">
      <StepBar
        t={t}
        current={current}
        status={status}
        onSelect={setCurrent}
        onExit={onExit}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm space-y-4">
          <div className="text-xs text-[var(--color-text-muted)]">
            {t("Step {{n}} of {{total}}", {
              n: current + 1,
              total: GUIDE_40.length,
            })}
          </div>
          <h2 className="flex items-center gap-2 text-lg font-medium text-[var(--color-text)]">
            {t(step.title)}
            <span className="rounded-md border border-[var(--color-warning)]/60 bg-[var(--color-warning)]/10 px-2 py-0.5 text-xs font-normal text-[var(--color-warning)]">
              {t("Screen mock")}
            </span>
          </h2>

          {current === 1 ? (
            <>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {t(
                  "On a small keyboard not every symbol fits on the base layer. Put the ones you type most where a symbol already sits, and let the rest move to a layer.",
                )}
              </p>
              <p className="rounded-xl border border-[var(--color-cyber)]/40 bg-[var(--color-cyber)]/10 px-4 py-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                {t(
                  "For example: I type a hyphen far more often than a colon, so the hyphen took the colon's place.",
                )}
              </p>
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {t(
                      "Drag the rows, or use the arrows, to order them by how often you type them",
                    )}
                  </h3>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("Top {{n}} go on the base layer", { n: slots.length })}
                  </span>
                </div>
                <ol className="mt-2 space-y-1">
                  {order.map((s, i) => (
                    <li
                      key={s.ch}
                      draggable
                      onDragStart={(e) => {
                        setDragging(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dropAt !== i) setDropAt(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropOn(i);
                        endDrag();
                      }}
                      onDragEnd={endDrag}
                      className={`flex cursor-grab items-center gap-3 rounded-lg border px-3 py-1.5 text-sm transition-[opacity,box-shadow] active:cursor-grabbing ${
                        i < slots.length
                          ? "border-[var(--color-neon)]/50 bg-[var(--color-neon)]/10"
                          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60"
                      } ${dragging === i ? "opacity-40" : ""} ${
                        dropAt === i && dragging !== null && dragging !== i
                          ? dragging < i
                            ? "shadow-[0_2px_0_0_var(--color-electric)]"
                            : "shadow-[0_-2px_0_0_var(--color-electric)]"
                          : ""
                      }`}
                    >
                      <IconGripVertical
                        size={14}
                        className="flex-shrink-0 text-[var(--color-text-muted)]"
                      />
                      <span className="w-5 text-xs tabular-nums text-[var(--color-text-muted)]">
                        {i + 1}
                      </span>
                      <span className="w-6 font-mono text-base text-[var(--color-text)]">
                        {s.ch}
                      </span>
                      <span className="flex-1 text-[var(--color-text-secondary)]">
                        {t(s.name)}
                      </span>
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-default"
                        aria-label={t("Move up")}
                      >
                        <IconArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === order.length - 1}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-default"
                        aria-label={t("Move down")}
                      >
                        <IconArrowDown size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {!proposed ? (
                  <button
                    type="button"
                    onClick={() => setProposed(true)}
                    className="btn-electric h-10 px-4 text-sm flex items-center gap-2"
                  >
                    <IconKeyboard size={16} />
                    {t("Show the proposal")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => finish("applied")}
                      className="btn-electric h-10 px-4 text-sm flex items-center gap-2"
                    >
                      <IconCheck size={16} />
                      {t("Apply")}
                    </button>
                    <button
                      type="button"
                      onClick={() => finish("skipped")}
                      className="btn-ghost h-10 border border-[var(--color-border)] px-4 text-sm"
                    >
                      {t("Next without changing")}
                    </button>
                  </>
                )}
              </div>
              {proposed && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t(
                    "The proposal is a starting point. To move a single key, open the keymap editor; the guide resumes at this step when you come back.",
                  )}{" "}
                  <span className="inline-flex items-center gap-1 text-[var(--color-electric)] underline opacity-60">
                    {t("Open the keymap editor")}
                    <IconExternalLink size={12} />
                  </span>
                </p>
              )}
            </>
          ) : step.practice ? (
            <>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {t(
                  "A layer is finished: practise on it before the next one. The practice screen opens with sentences that need only the keys decided so far.",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPractice}
                  className="btn-electric h-10 px-4 text-sm flex items-center gap-2"
                >
                  <IconPlayerPlay size={16} />
                  {t("Start practising")}
                </button>
                <button
                  type="button"
                  onClick={() => finish("skipped")}
                  className="btn-ghost h-10 border border-[var(--color-border)] px-4 text-sm"
                >
                  {t("Skip to the next step")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                {t(
                  "This step is built in phase 4. Only the symbol step is mocked here.",
                )}
              </p>
              <button
                type="button"
                onClick={() => finish("skipped")}
                className="btn-ghost h-10 border border-[var(--color-border)] px-4 text-sm"
              >
                {t("Next without changing")}
              </button>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-[var(--color-text)]">
              {board.name}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("Base layer")}
            </span>
          </div>
          <PracticeBoard board={board} marks={marks} dimOthers={proposed} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
            <Legend color="var(--color-neon)">
              {t("Keys the proposal changes (old legend struck through)")}
            </Legend>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--color-neon)]/60 bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)] shadow-lg flex items-center gap-2">
          <IconCheck size={16} className="text-[var(--color-neon)]" />
          {toast}
        </div>
      )}
    </div>
  );
}

function StepBar({
  t,
  current,
  status,
  onSelect,
  onExit,
}: {
  t: T;
  current: number;
  status: Record<number, StepStatus>;
  onSelect: (i: number) => void;
  onExit: () => void;
}) {
  return (
    <nav
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 backdrop-blur-sm"
      aria-label={t("Guide steps")}
    >
      <div className="flex items-center justify-between gap-3">
        <ol className="flex flex-1 flex-wrap items-center gap-1.5">
          {GUIDE_40.map((s, i) => {
            const st = status[i] ?? "todo";
            const active = i === current;
            return (
              <li key={s.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  title={t(s.title)}
                  className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
                    active
                      ? "border-[var(--color-electric)] bg-[var(--color-electric)]/15 text-[var(--color-text)]"
                      : st === "applied"
                        ? "border-[var(--color-neon)]/60 text-[var(--color-text-secondary)]"
                        : st === "skipped"
                          ? "border-[var(--color-border)] text-[var(--color-text-muted)] line-through"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {st === "applied" && !active ? (
                    <IconCheck size={12} className="text-[var(--color-neon)]" />
                  ) : s.practice ? (
                    <IconPlayerPlay size={12} />
                  ) : (
                    <span className="tabular-nums">{i + 1}</span>
                  )}
                  <span className={active ? "inline" : "hidden xl:inline"}>
                    {t(s.title)}
                  </span>
                </button>
                {i < GUIDE_40.length - 1 && (
                  <span className="h-px w-2 bg-[var(--color-border-hover)]" />
                )}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={onExit}
          className="btn-ghost h-8 flex-shrink-0 border border-[var(--color-border)] text-xs"
        >
          {t("Leave the guide")}
        </button>
      </div>
    </nav>
  );
}
