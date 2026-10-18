/**
 * The setup guide (SPEC §5): the 40%-and-under flow, one step at a time.
 * A question on the left, the keymap on the right; an answer becomes a
 * proposal drawn on the keymap, applied or skipped. Progress and the
 * keymap with the proposals applied are kept per keyboard in the
 * browser (§5.7), so the guide resumes where it stopped.
 *
 * "Apply" changes the working keymap here (demo mode); writing it to a
 * connected keyboard through the remapper's own path is a later step.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconExternalLink,
  IconGripVertical,
  IconPlayerPlay,
  IconRestore,
} from "@tabler/icons-react";
import type { TestBoard } from "../../keyTest/lib/boards";
import { labelOf } from "../../keyTest/lib/boards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { TEXTS_JA, textsWithin } from "../data/texts.ja";
import {
  applyChanges,
  boardWith,
  currentSpace,
  DEFAULT_ANSWERS,
  GUIDE_40,
  keymapOf,
  proposalLabels,
  proposeDuplicates,
  proposeLayerKeys,
  proposeOneHand,
  proposeOther,
  proposeRare,
  proposeSymbols,
  proposeThumbs,
  RARE_CHOICES,
  suggestedLayerKeys,
  SYMBOL_NAMES,
  thumbLayerKeys,
  type Answers,
  type Proposal,
  type ThumbRole,
  type WorkingKeymap,
} from "../lib/guide";
import {
  clearProgress,
  readProgress,
  writeProgress,
  type GuideProgress,
  type StepStatus,
} from "../lib/guideStore";
import type { KeyboardMeta } from "../lib/metadata";
import { PracticeBoard, type Mark } from "./PracticeBoard";
import { PracticeSession } from "./PracticeSession";
import { TaskSession } from "./TaskSession";

type T = (key: string, params?: Record<string, string | number>) => string;

function fresh(board: TestBoard): GuideProgress {
  return {
    version: 1,
    guide: "40",
    step: 0,
    answers: DEFAULT_ANSWERS,
    status: {},
    layers: keymapOf(board).layers,
    savedAt: Date.now(),
  };
}

export function GuideFlow({
  board,
  meta,
  layout,
  remapperHref,
  t,
  onExit,
}: {
  board: TestBoard;
  meta: KeyboardMeta;
  layout: LabelLayout;
  /** Where the keymap editor lives, for fixing a key by hand. */
  remapperHref: string;
  t: T;
  onExit: () => void;
}) {
  const [progress, setProgress] = useState<GuideProgress>(
    () => readProgress(board.id) ?? fresh(board),
  );
  useEffect(() => {
    writeProgress(board.id, progress);
  }, [board.id, progress]);

  const km: WorkingKeymap = useMemo(
    () => ({ layers: progress.layers }),
    [progress.layers],
  );
  const drawn = useMemo(
    () => boardWith(board, km, layout),
    [board, km, layout],
  );
  const { step: current, answers, status } = progress;
  const step = GUIDE_40[current];

  const update = (patch: Partial<GuideProgress>) =>
    setProgress((p) => ({ ...p, ...patch, savedAt: Date.now() }));
  const answer = (patch: Partial<Answers>) =>
    update({ answers: { ...answers, ...patch } });
  const goTo = (i: number) =>
    update({ step: Math.max(0, Math.min(GUIDE_40.length - 1, i)) });
  const finish = (how: StepStatus, changes?: Proposal["changes"]) =>
    setProgress((p) => ({
      ...p,
      status: { ...p.status, [p.step]: how },
      layers: changes?.length
        ? applyChanges({ layers: p.layers }, changes).layers
        : p.layers,
      step: Math.min(GUIDE_40.length - 1, p.step + 1),
      savedAt: Date.now(),
    }));
  const restart = () => {
    clearProgress(board.id);
    setProgress(fresh(board));
  };

  // The proposal of the step in front of the person, from the answers so far.
  const proposal: Proposal | null = useMemo(() => {
    switch (step.id) {
      case "symbols":
        return proposeSymbols(board, meta, km, answers, layout);
      case "duplicates":
        return proposeDuplicates(meta, km, answers);
      case "thumbs":
        return proposeThumbs(board, meta, km, answers);
      case "layer-keys":
        return proposeLayerKeys(meta, km, answers);
      case "layer-one-hand":
        return proposeOneHand(board, meta, km, answers, layout);
      case "layer-other":
        return proposeOther(board, meta, km, answers);
      case "rare":
        return proposeRare(board, meta, km, answers);
      default:
        return null;
    }
  }, [step.id, board, meta, km, answers, layout]);

  // Which layer the drawing shows: the one most of the proposal lands on.
  const shownLayer = useMemo(() => {
    if (!proposal?.changes.length) return 0;
    const count = new Map<number, number>();
    for (const c of proposal.changes)
      count.set(c.layer, (count.get(c.layer) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [proposal]);
  const marks = useMemo(() => {
    const m = new Map<string, Mark>();
    if (!proposal) return m;
    for (const [pos, { layer, label }] of proposalLabels(
      proposal.changes,
      layout,
    )) {
      if (layer !== shownLayer) continue;
      const k = board.keys[pos];
      if (k) m.set(k.id, { tone: "set", label });
    }
    return m;
  }, [proposal, layout, board, shownLayer]);

  // Layer keys are chosen once; the suggestion fills the answer the first time.
  useEffect(() => {
    if (
      step.id === "layer-keys" &&
      answers.layerKeyPos.length === 0 &&
      status[current] === undefined
    ) {
      const suggested = suggestedLayerKeys(meta, km);
      if (suggested.length) answer({ layerKeyPos: suggested });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const thumbLabel = (pos: number) => {
    const tr = km.layers[0]?.[pos];
    return tr ? labelOf(tr, layout).main || "—" : "—";
  };

  const changeButtons = (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onClick={() => finish("applied", proposal?.changes)}
        disabled={!proposal?.changes.length}
        className="btn-electric h-10 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
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
    </div>
  );

  const noteText = (note: Proposal["note"]) => {
    switch (note) {
      case "no-slots":
        return t(
          "This keyboard has no symbol slots on its base layer, so there is nothing to place here.",
        );
      case "no-thumbs":
        return t(
          "This keyboard has no thumb keys recorded, so the thumb steps have nothing to propose.",
        );
      case "one-layer":
        return t(
          "This needs a second layer key. Go back to the layer key step and choose two thumb keys.",
        );
      case "nothing":
        return t("Nothing to change with this answer.");
      default:
        return null;
    }
  };

  const practiceStep = step.practice;

  return (
    <div className="space-y-4">
      <StepBar
        t={t}
        current={current}
        status={status}
        onSelect={goTo}
        onExit={onExit}
        onRestart={restart}
      />

      {practiceStep ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-5 py-4 backdrop-blur-sm">
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t("Step {{n}} of {{total}}", {
                  n: current + 1,
                  total: GUIDE_40.length,
                })}
              </div>
              <h2 className="text-lg font-medium text-[var(--color-text)]">
                {t(step.title)}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {step.id === "practice-base"
                  ? t(
                      "Sentences typed on the base layer alone. When it feels settled, go on to the layers.",
                    )
                  : step.id === "practice-layers"
                    ? t(
                        "The cursor, numbers and F keys you just put on the layers, as tasks.",
                      )
                    : t(
                        "Sentences and symbols together, on the finished keymap.",
                      )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => finish("done")}
              className="btn-electric h-10 px-4 text-sm flex items-center gap-2"
            >
              {current === GUIDE_40.length - 1
                ? t("Finish the guide")
                : t("Done, next step")}
            </button>
          </div>
          {step.id === "practice-layers" ? (
            <TaskSession
              board={drawn}
              layout={layout}
              t={t}
              onExit={() => finish("done")}
            />
          ) : (
            <PracticeSession
              board={drawn}
              layout={layout}
              texts={
                step.id === "practice-base"
                  ? textsWithin(TEXTS_JA, new Set(["base", "symbols"]))
                  : TEXTS_JA
              }
              t={t}
              onExit={() => finish("done")}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 backdrop-blur-sm space-y-4">
            <div className="text-xs text-[var(--color-text-muted)]">
              {t("Step {{n}} of {{total}}", {
                n: current + 1,
                total: GUIDE_40.length,
              })}
            </div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              {t(step.title)}
            </h2>

            {step.id === "intro" && (
              <>
                <Para>
                  {t(
                    "A keymap is yours to decide, and the order of deciding matters: the keys you use most go where they are easiest to reach, and everything else finds a place after them.",
                  )}
                </Para>
                <Para>
                  {t(
                    "This guide asks a few questions in that order -- symbols, thumbs, layer keys, what each layer holds -- and turns each answer into a proposal drawn on your keymap. Apply it, skip it, or fix a key by hand in the keymap editor and come back.",
                  )}
                </Para>
                <Para>
                  {t(
                    "A layer is practised as soon as it is complete, so a change you do not like shows up at once.",
                  )}
                </Para>
                <button
                  type="button"
                  onClick={() => finish("done")}
                  className="btn-electric h-10 px-4 text-sm"
                >
                  {t("Begin")}
                </button>
              </>
            )}

            {step.id === "symbols" && (
              <>
                <Para>
                  {t(
                    "On a small keyboard not every symbol fits on the base layer. Put the ones you type most where a symbol already sits, and let the rest move to a layer.",
                  )}
                </Para>
                <Example>
                  {t(
                    "For example: I type a hyphen far more often than a colon, so the hyphen took the colon's place.",
                  )}
                </Example>
                <OrderList
                  t={t}
                  items={answers.symbols}
                  highlight={meta.symbolSlots.length}
                  render={(ch) => (
                    <>
                      <span className="w-6 font-mono text-base text-[var(--color-text)]">
                        {ch}
                      </span>
                      <span className="flex-1 text-[var(--color-text-secondary)]">
                        {t(SYMBOL_NAMES[ch] ?? ch)}
                      </span>
                    </>
                  )}
                  title={t(
                    "Drag the rows, or use the arrows, to order them by how often you type them",
                  )}
                  hint={t("Top {{n}} go on the base layer", {
                    n: meta.symbolSlots.length,
                  })}
                  onChange={(symbols) => answer({ symbols })}
                />
                {changeButtons}
              </>
            )}

            {step.id === "duplicates" && (
              <>
                <Para>
                  {t(
                    "Some keys earn their place less than others. CapsLock is rarely needed, and the key under the left little finger is easy to reach: it can be Ctrl, or Esc.",
                  )}
                </Para>
                {meta.fixedKeys.capslock === null ? (
                  <Para muted>
                    {t("This keyboard has no CapsLock on its base layer.")}
                  </Para>
                ) : (
                  <Choices
                    value={answers.capslock}
                    onChange={(v) => answer({ capslock: v })}
                    options={[
                      ["ctrl", t("Make CapsLock a Ctrl")],
                      ["esc", t("Make CapsLock an Esc")],
                      ["keep", t("Keep CapsLock")],
                    ]}
                  />
                )}
                {changeButtons}
              </>
            )}

            {step.id === "thumbs" && (
              <>
                <Para>
                  {t(
                    "Space goes where your thumb lands without thinking. The other thumb keys take Backspace, Delete and Enter, the most used nearest to Space.",
                  )}
                </Para>
                <Para muted>
                  {t(
                    "Measuring where the thumb lands on a connected keyboard comes later; for now, choose the key.",
                  )}
                </Para>
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("Which thumb key is Space?")}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {meta.thumbKeys.map((th) => {
                    const chosen =
                      (answers.spacePos ?? currentSpace(meta, km)) === th.pos;
                    return (
                      <button
                        key={th.pos}
                        type="button"
                        onClick={() => answer({ spacePos: th.pos })}
                        className={`h-9 rounded-lg border px-3 font-mono text-sm transition-colors ${
                          chosen
                            ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        }`}
                        title={`#${th.pos} (${th.hand})`}
                      >
                        {th.hand} · {thumbLabel(th.pos)}
                      </button>
                    );
                  })}
                </div>
                <OrderList
                  t={t}
                  items={answers.thumbOrder}
                  highlight={answers.thumbOrder.length}
                  render={(r) => (
                    <span className="flex-1 text-[var(--color-text)]">
                      {t(r)}
                    </span>
                  )}
                  title={t("Order these by how often you use them")}
                  onChange={(thumbOrder) =>
                    answer({ thumbOrder: thumbOrder as ThumbRole[] })
                  }
                />
                {changeButtons}
              </>
            )}

            {step.id === "layer-keys" && (
              <>
                <Para>
                  {t(
                    "A thumb key can do two things: one on a tap, another while held. Space and Enter are hardly ever held, so their hold can open a layer. Backspace and Delete are held to erase, so they stay as they are.",
                  )}
                </Para>
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("Which thumb keys open a layer when held?")}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {meta.thumbKeys.map((th) => {
                    const on = answers.layerKeyPos.includes(th.pos);
                    return (
                      <button
                        key={th.pos}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          answer({
                            layerKeyPos: on
                              ? answers.layerKeyPos.filter((p) => p !== th.pos)
                              : [...answers.layerKeyPos, th.pos],
                          })
                        }
                        className={`h-9 rounded-lg border px-3 font-mono text-sm transition-colors ${
                          on
                            ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        {th.hand} · {thumbLabel(th.pos)}
                      </button>
                    );
                  })}
                </div>
                <Para muted>
                  {t(
                    "Two layer keys, one under each thumb, give the next steps a layer for each hand.",
                  )}
                </Para>
                {changeButtons}
              </>
            )}

            {step.id === "layer-one-hand" && (
              <>
                <Para>
                  {t(
                    "What one hand should finish on its own goes on that hand's layer: the cursor keys under the fingers of the hand whose thumb holds the layer, so the other hand is free; and on the other side of the same layer, the symbols that did not fit the base layer, each without a modifier.",
                  )}
                </Para>
                <Choices
                  value={answers.cursorHand}
                  onChange={(v) => answer({ cursorHand: v })}
                  options={[
                    [
                      "auto",
                      t("Cursor under the right hand (right thumb's layer)"),
                    ],
                    ["L", t("Cursor under the left hand (left thumb's layer)")],
                  ]}
                />
                {proposal?.note && <Para muted>{noteText(proposal.note)}</Para>}
                {changeButtons}
              </>
            )}

            {step.id === "layer-other" && (
              <>
                <Para>
                  {t(
                    "The other thumb's layer takes what is used with the opposite hand: a numpad under one hand, the F keys under the other.",
                  )}
                </Para>
                <Choices
                  value={answers.otherMirror ? "L" : "R"}
                  onChange={(v) => answer({ otherMirror: v === "L" })}
                  options={[
                    ["R", t("Numpad on the right, F keys on the left")],
                    ["L", t("Numpad on the left, F keys on the right")],
                  ]}
                />
                {proposal?.note && <Para muted>{noteText(proposal.note)}</Para>}
                {changeButtons}
              </>
            )}

            {step.id === "rare" && (
              <>
                <Para>
                  {t(
                    "Keys used now and then need no place of their own: they go on free keys of a layer, at the bottom row where nothing else was put.",
                  )}
                </Para>
                <div className="flex flex-wrap gap-1.5">
                  {RARE_CHOICES.map((code) => {
                    const on = answers.rare.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          answer({
                            rare: on
                              ? answers.rare.filter((c) => c !== code)
                              : [...answers.rare, code],
                          })
                        }
                        className={`h-9 rounded-lg border px-3 font-mono text-sm transition-colors ${
                          on
                            ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        {labelOf({ kind: "key", code, mods: [] }, layout).main}
                      </button>
                    );
                  })}
                </div>
                {proposal?.note && <Para muted>{noteText(proposal.note)}</Para>}
                {changeButtons}
              </>
            )}

            {proposal &&
              !proposal.note &&
              step.id !== "layer-one-hand" &&
              step.id !== "layer-other" &&
              step.id !== "rare" &&
              proposal.changes.length === 0 && (
                <Para muted>{t("Nothing to change with this answer.")}</Para>
              )}
            {proposal?.note &&
              step.id !== "layer-one-hand" &&
              step.id !== "layer-other" &&
              step.id !== "rare" && (
                <Para muted>{noteText(proposal.note)}</Para>
              )}

            {!practiceStep && step.id !== "intro" && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {t(
                  "The proposal is a starting point. To move a single key, open the keymap editor; the guide resumes at this step when you come back.",
                )}{" "}
                <a
                  href={remapperHref}
                  className="inline-flex items-center gap-1 text-[var(--color-electric)] underline"
                >
                  {t("Open the keymap editor")}
                  <IconExternalLink size={12} />
                </a>
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[var(--color-text)]">
                {board.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {shownLayer === 0
                  ? t("Base layer")
                  : t("Layer {{n}}", { n: shownLayer })}
              </span>
            </div>
            <PracticeBoard
              board={drawn}
              marks={marks}
              dimOthers={marks.size > 0}
              layer={shownLayer}
              layout={layout}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded border border-[var(--color-neon)] bg-[color-mix(in_srgb,var(--color-neon)_25%,var(--color-surface-elevated))]" />
                {t("Keys the proposal changes (old legend struck through)")}
              </span>
              {thumbLayerKeys(meta, km).length > 0 && (
                <span>
                  {t("Layer keys: {{list}}", {
                    list: thumbLayerKeys(meta, km)
                      .map((k) => `${thumbLabel(k.pos)} → L${k.layer}`)
                      .join(", "),
                  })}
                </span>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Para({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={`text-sm leading-relaxed ${muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]"}`}
    >
      {children}
    </p>
  );
}

function Example({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-[var(--color-cyber)]/40 bg-[var(--color-cyber)]/10 px-4 py-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
      {children}
    </p>
  );
}

function Choices<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: Array<[V, string]>;
}) {
  return (
    <div className="space-y-1.5">
      {options.map(([v, label]) => (
        <label
          key={v}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
            value === v
              ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
          }`}
        >
          <input
            type="radio"
            checked={value === v}
            onChange={() => onChange(v)}
            className="accent-[var(--color-electric)]"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

/** A list put in order by dragging rows or with the arrows. */
function OrderList<I extends string>({
  t,
  items,
  highlight,
  render,
  title,
  hint,
  onChange,
}: {
  t: T;
  items: I[];
  /** How many from the top count (drawn stronger). */
  highlight: number;
  render: (item: I) => ReactNode;
  title: string;
  hint?: string;
  onChange: (items: I[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const dropOn = (i: number) => {
    if (dragging === null || dragging === i) return;
    const next = [...items];
    const [row] = next.splice(dragging, 1);
    next.splice(i, 0, row);
    onChange(next);
  };
  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--color-text)]">
          {title}
        </h3>
        {hint && (
          <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>
        )}
      </div>
      <ol className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li
            key={item}
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
            className={`flex cursor-grab items-center gap-3 rounded-lg border px-3 py-1.5 text-sm active:cursor-grabbing ${
              i < highlight
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
            {render(item)}
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
              disabled={i === items.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-default"
              aria-label={t("Move down")}
            >
              <IconArrowDown size={14} />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepBar({
  t,
  current,
  status,
  onSelect,
  onExit,
  onRestart,
}: {
  t: T;
  current: number;
  status: Record<number, StepStatus>;
  onSelect: (i: number) => void;
  onExit: () => void;
  onRestart: () => void;
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
                      : st === "applied" || st === "done"
                        ? "border-[var(--color-neon)]/60 text-[var(--color-text-secondary)]"
                        : st === "skipped"
                          ? "border-[var(--color-border)] text-[var(--color-text-muted)] line-through"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {(st === "applied" || st === "done") && !active ? (
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
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  t(
                    "Start the guide over? The applied proposals are dropped from the working keymap.",
                  ),
                )
              )
                onRestart();
            }}
            className="btn-ghost h-8 border border-[var(--color-border)] flex items-center gap-1.5 text-xs"
          >
            <IconRestore size={14} />
            {t("Start over")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="btn-ghost h-8 border border-[var(--color-border)] text-xs"
          >
            {t("Leave the guide")}
          </button>
        </div>
      </div>
    </nav>
  );
}
