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
import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconGripVertical,
  IconPlayerPlay,
  IconRestore,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import type { TestBoard } from "../../keyTest/lib/boards";
import { labelOf } from "../../keyTest/lib/boards";
import type { LabelLayout } from "../../layoutEditor/lib/keyLabels";
import { TEXTS_JA, textsWithin } from "../data/texts.ja";
import {
  applyChanges,
  boardWith,
  DEFAULT_ANSWERS,
  contentLayer,
  CONTENTS,
  GUIDE_40,
  keymapOf,
  orderedSymbolSlots,
  proposalLabels,
  proposeDuplicates,
  proposeLayerKeys,
  proposeOneHand,
  proposeOther,
  proposeRare,
  proposeSymbols,
  proposeThumbs,
  RARE_CHOICES,
  recommendThumbs,
  SALICYLIC_SYMBOL_GRID,
  REPLACE_CHOICES,
  reviewKeys,
  suggestedLayerKeys,
  symbolColumns,
  SYMBOL_NAMES,
  THUMB_TAPS,
  thumbLayerKeys,
  thumbsLeftToRight,
  currentThumb,
  type Answers,
  type HoldChoice,
  type LayerContent,
  type Proposal,
  type ThumbAssign,
  type WorkingKeymap,
} from "../lib/guide";
import {
  clearProgress,
  readProgress,
  writeProgress,
  type GuideProgress,
  type StepStatus,
} from "../lib/guideStore";
import type { Hand, KeyboardMeta } from "../lib/metadata";
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
  t,
  onExit,
}: {
  board: TestBoard;
  meta: KeyboardMeta;
  layout: LabelLayout;
  t: T;
  onExit: () => void;
}) {
  const [progress, setProgress] = useState<GuideProgress>(
    () => readProgress(board.id) ?? fresh(board),
  );
  // The keyboard drawn to fit, or at full size with sideways scrolling.
  const [zoom, setZoom] = useState(false);
  // Step 2 by hand: the slot picked on the drawing, if any.
  const [manual, setManual] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<number | null>(null);
  useEffect(() => {
    writeProgress(board.id, progress);
  }, [board.id, progress]);

  const kmNow: WorkingKeymap = useMemo(
    () => ({ layers: progress.layers }),
    [progress.layers],
  );
  const { step: current, answers, status } = progress;
  const step = GUIDE_40[current];
  // A step already applied is shown against the keymap as it was before
  // it, so its proposal reflects the answers rather than vanishing.
  const km: WorkingKeymap = useMemo(() => {
    const was = progress.applied?.[current];
    return was ? applyChanges(kmNow, was.previous) : kmNow;
  }, [kmNow, progress.applied, current]);
  const drawn = useMemo(
    () => boardWith(board, km, layout),
    [board, km, layout],
  );

  const update = (patch: Partial<GuideProgress>) =>
    setProgress((p) => ({ ...p, ...patch, savedAt: Date.now() }));
  const answer = (patch: Partial<Answers>) =>
    update({ answers: { ...answers, ...patch } });
  const goTo = (i: number) =>
    update({ step: Math.max(0, Math.min(GUIDE_40.length - 1, i)) });
  const finish = (how: StepStatus, changes?: Proposal["changes"]) =>
    setProgress((p) => {
      // Undo what this step applied before, then apply the new changes.
      const was = p.applied?.[p.step];
      let layers = was
        ? applyChanges({ layers: p.layers }, was.previous).layers
        : p.layers;
      const applied = { ...(p.applied ?? {}) };
      delete applied[p.step];
      if (changes?.length) {
        const previous: Proposal["changes"] = changes.map((c) => ({
          layer: c.layer,
          pos: c.pos,
          trigger: layers[c.layer]?.[c.pos] ?? { kind: "none" },
        }));
        layers = applyChanges({ layers }, changes).layers;
        applied[p.step] = { changes, previous };
      }
      return {
        ...p,
        status: { ...p.status, [p.step]: how },
        layers,
        applied,
        step: Math.min(GUIDE_40.length - 1, p.step + 1),
        savedAt: Date.now(),
      };
    });
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
        return proposeDuplicates(km, answers);
      case "thumbs":
        return proposeThumbs(board, meta, km, answers);
      case "layer-keys":
        return proposeLayerKeys(meta, km, answers);
      case "layer-one-hand":
        return proposeOneHand(board, meta, km, answers, layout);
      case "layer-other":
        return proposeOther(board, meta, km, answers, layout);
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
    if (step.id === "layer-keys") {
      // Every thumb key as it will be: the layer keys stand out, the rest
      // show what they keep.
      const after = applyChanges(km, proposal.changes);
      for (const th of thumbsLeftToRight(board, meta)) {
        const t = after.layers[0]?.[th.pos];
        if (t?.kind !== "key") continue;
        const main = labelOf(t, layout).main;
        const hasLayer = t.holdLayer !== undefined;
        const k = board.keys[th.pos];
        m.set(k.id, {
          tone: hasLayer ? "set" : "hold",
          label: hasLayer ? `${main} / L${t.holdLayer}` : main,
        });
      }
      return m;
    }
    if (step.id === "symbols") {
      // The slots a symbol may take, and in vermillion the ones that change.
      for (const pos of orderedSymbolSlots(board, meta)) {
        const k = board.keys[pos];
        if (k) m.set(k.id, { tone: pos === pickedSlot ? "hold" : "set" });
      }
    }
    for (const [pos, { layer, label }] of proposalLabels(
      proposal.changes,
      layout,
    )) {
      if (layer !== shownLayer) continue;
      const k = board.keys[pos];
      if (k)
        m.set(k.id, { tone: step.id === "symbols" ? "hint" : "set", label });
    }
    if (step.id === "symbols" && pickedSlot !== null) {
      const k = board.keys[pickedSlot];
      const prev = k ? m.get(k.id) : undefined;
      if (k) m.set(k.id, { ...(prev ?? { tone: "hold" }), tone: "hold" });
    }
    return m;
  }, [proposal, layout, board, shownLayer, step.id, km, meta, pickedSlot]);

  const layerStep = step.id === "layer-one-hand" || step.id === "layer-other";
  /** The proposal's marks on one layer, with the thumb key held for it lit. */
  const marksForLayer = (layer: number, thumbPos: number) => {
    const m = new Map<string, Mark>();
    if (!proposal) return m;
    for (const [pos, c] of proposalLabels(proposal.changes, layout)) {
      if (c.layer !== layer) continue;
      const k = board.keys[pos];
      if (k) m.set(k.id, { tone: "set", label: c.label });
    }
    const held = board.keys[thumbPos];
    if (held) m.set(held.id, { tone: "hint" });
    return m;
  };

  // The layer keys start from what step 4 set: every thumb key that holds
  // a layer in the keymap as it is before this step. Coming back here after
  // changing the thumbs keeps the two steps in agreement; the suggestion
  // fills in only when no thumb key holds a layer yet.
  useEffect(() => {
    if (step.id !== "layer-keys") return;
    const holding = thumbLayerKeys(meta, km).map((k) => k.pos);
    const next = holding.length
      ? holding
      : answers.layerKeyPos.length
        ? answers.layerKeyPos
        : suggestedLayerKeys(meta, km);
    const same =
      next.length === answers.layerKeyPos.length &&
      next.every((p) => answers.layerKeyPos.includes(p));
    if (!same) answer({ layerKeyPos: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // The columns the symbol grid covers on this keyboard (the two hands
  // match on any keyboard the guide is for; the left one is drawn).
  const symbolColumnCount = useMemo(
    () => symbolColumns(board, meta, "L").length,
    [board, meta],
  );
  const thumbLayers = useMemo(
    () => [...thumbLayerKeys(meta, km)].sort((a, b) => a.layer - b.layer),
    [meta, km],
  );
  // A layer holds one kind of content per side; choosing it for one kind
  // takes it from any other that had it.
  const setContent = (
    side: "one" | "other",
    content: LayerContent,
    layer: number | null,
  ) => {
    const next: Partial<Record<LayerContent, number | null>> = {};
    for (const c of CONTENTS) {
      const was = contentLayer(meta, km, answers, side, c);
      next[c] =
        c === content ? layer : layer !== null && was === layer ? null : was;
    }
    answer(side === "one" ? { oneHand: next } : { otherHand: next });
  };

  const review = useMemo(
    () => (step.id === "duplicates" ? reviewKeys(km, answers, layout) : []),
    [step.id, km, answers, layout],
  );
  const codeName = (code: string) =>
    labelOf({ kind: "key", code, mods: [] }, layout).main || code;
  /** Where a key sits, in words: its row from the top and its side. */
  const keyPlace = (pos: number) => {
    const k = board.keys[pos];
    const rows = [
      ...new Set(board.keys.map((x) => Math.round(x.cy * 2) / 2)),
    ].sort((a, b) => a - b);
    const row = rows.indexOf(Math.round(k.cy * 2) / 2) + 1;
    const xs = board.keys.map((x) => x.cx);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    return t("row {{row}}, {{side}}", {
      row,
      side: k.cx < mid ? t("left") : t("right"),
    });
  };

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
                <div className="space-y-2">
                  <button
                    type="button"
                    aria-pressed={manual}
                    onClick={() => {
                      setManual((m) => !m);
                      setPickedSlot(null);
                    }}
                    className={`h-9 rounded-lg border px-3 text-sm transition-colors ${
                      manual
                        ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {t("Change by hand")}
                  </button>
                  {manual && (
                    <Para muted>
                      {t(
                        "Click a candidate key on the drawing, then pick the symbol it should hold.",
                      )}
                    </Para>
                  )}
                  {manual && pickedSlot !== null && (
                    <div className="space-y-1.5 rounded-xl border border-[var(--color-electric)]/50 p-3">
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {t("Key {{key}}: put", {
                          key: thumbLabel(pickedSlot) || "#" + pickedSlot,
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {answers.symbols.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() =>
                              answer({
                                symbolOverride: {
                                  ...answers.symbolOverride,
                                  [String(pickedSlot)]: ch,
                                },
                              })
                            }
                            className={`h-8 min-w-8 rounded-md border px-2 font-mono text-sm ${
                              answers.symbolOverride[String(pickedSlot)] === ch
                                ? "border-[var(--color-electric)] bg-[var(--color-electric)]/10 text-[var(--color-text)]"
                                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            answer({
                              symbolOverride: {
                                ...answers.symbolOverride,
                                [String(pickedSlot)]: "keep",
                              },
                            })
                          }
                          className="h-8 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-text-secondary)]"
                        >
                          {t("Keep as it is")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...answers.symbolOverride };
                            delete next[String(pickedSlot)];
                            answer({ symbolOverride: next });
                          }}
                          className="h-8 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-text-secondary)]"
                        >
                          {t("Back to the order")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {changeButtons}
              </>
            )}

            {step.id === "duplicates" && (
              <>
                <Para>
                  {t(
                    "Some keys earn their place less than others. The CapsLock beside A is hardly used when Japanese is what you mostly type, yet it sits in an easy spot under the left little finger. The same goes for a modifier that appears twice once CapsLock has become a Ctrl.",
                  )}
                </Para>
                {review.length === 0 ? (
                  <Para muted>
                    {t("Nothing on the base layer needs a second look.")}
                  </Para>
                ) : (
                  <ul className="space-y-1.5">
                    {review.map((r) => (
                      <li
                        key={r.pos}
                        className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                      >
                        <span className="w-24 flex-shrink-0 font-mono text-[var(--color-text)]">
                          {
                            labelOf(
                              { kind: "key", code: r.code, mods: [] },
                              layout,
                            ).main
                          }
                        </span>
                        <span className="w-28 flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                          {r.reason === "capslock"
                            ? t("rarely used")
                            : r.reason === "ime"
                              ? t("IME toggle")
                              : t("doubled")}{" "}
                          · {keyPlace(r.pos)}
                        </span>
                        <select
                          value={answers.replace[String(r.pos)] ?? "keep"}
                          onChange={(e) =>
                            answer({
                              replace: {
                                ...answers.replace,
                                [String(r.pos)]: e.target.value,
                              },
                            })
                          }
                          className="h-8 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
                        >
                          {REPLACE_CHOICES.map((c) => (
                            <option key={c} value={c}>
                              {c === "keep" ? t("Keep as it is") : codeName(c)}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
                {changeButtons}
              </>
            )}

            {step.id === "thumbs" && (
              <>
                <Para>
                  {t(
                    "If only the part your thumb presses without thinking when it goes for the space bar is Space, the rest of the thumb row is free for other keys. From the thumb's natural position outward, the more useful a key the nearer it goes.",
                  )}
                </Para>
                <Para>
                  {t(
                    "Keys tapped on their own -- Backspace, Delete, 変換, 無変換 -- make long Japanese text easier; Shift, Ctrl, Alt and Win on the thumbs make the letter combinations easier. With a tap and a hold on the same key, one thumb key can carry two of them.",
                  )}
                </Para>
                <Example>
                  {t(
                    "The author, Salicylic_acid3, goes left to right: on the left thumbs 無変換 / Win, Space / layer, Backspace; on the right thumbs Delete, Enter / layer, 変換 / Alt.",
                  )}
                </Example>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      answer({
                        thumbs: recommendThumbs(board, meta),
                      })
                    }
                    className="btn-ghost h-9 border border-[var(--color-border)] px-3 text-sm"
                  >
                    {t("Use Salicylic_acid3's row")}
                  </button>
                  <button
                    type="button"
                    onClick={() => answer({ thumbs: {} })}
                    className="btn-ghost h-9 border border-[var(--color-border)] px-3 text-sm"
                  >
                    {t("Clear")}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 px-1 text-xs text-[var(--color-text-muted)]">
                    <span>{t("Key")}</span>
                    <span>{t("Tap")}</span>
                    <span>{t("Hold")}</span>
                  </div>
                  {thumbsLeftToRight(board, meta).map((th) => {
                    const a =
                      answers.thumbs[String(th.pos)] ??
                      currentThumb(km, th.pos);
                    const set = (patch: Partial<ThumbAssign>) =>
                      answer({
                        thumbs: {
                          ...answers.thumbs,
                          [String(th.pos)]: { ...a, ...patch },
                        },
                      });
                    return (
                      <div
                        key={th.pos}
                        className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                      >
                        <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                          {th.hand} · {thumbLabel(th.pos)}
                        </span>
                        <select
                          value={a.tap}
                          onChange={(e) => set({ tap: e.target.value })}
                          className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
                        >
                          <option value="keep">{t("Keep as it is")}</option>
                          {THUMB_TAPS.map((c) => (
                            <option key={c} value={c}>
                              {codeName(c)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={a.hold}
                          onChange={(e) =>
                            set({ hold: e.target.value as HoldChoice })
                          }
                          className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
                        >
                          <option value="none">{t("No hold")}</option>
                          <option value="layer">{t("Layer")}</option>
                          <option value="shift">Shift</option>
                          <option value="ctrl">Ctrl</option>
                          <option value="alt">Alt</option>
                          <option value="meta">{codeName("MetaLeft")}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
                <Para muted>
                  {t(
                    "Measuring where the thumb lands on a connected keyboard comes later; for now, choose the key.",
                  )}
                </Para>
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
                    "What one hand should finish on its own goes on that hand's layer: the cursor keys under the fingers of the hand whose thumb holds the layer, so the other hand stays free.",
                  )}
                </Para>
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("Keys to finish with one hand")}
                </h3>
                <Para muted>
                  {t(
                    "The layers are the ones given to thumb keys in the layer key step. Besides the cursor keys, anything else one hand should finish goes here too.",
                  )}
                </Para>
                <LayerPicker
                  t={t}
                  side="one"
                  thumbLayers={thumbLayers}
                  value={(c) => contentLayer(meta, km, answers, "one", c)}
                  label={(pos) => thumbLabel(pos)}
                  onChange={(c, layer) => setContent("one", c, layer)}
                />
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("How the cursor keys lie")}
                </h3>
                <Choices
                  value={answers.cursorShape}
                  onChange={(v) => answer({ cursorShape: v })}
                  options={[
                    ["t", t("Inverted T: ↑ above, ← ↓ → on the home row")],
                    ["row", t("One row, like Vim: ← ↓ ↑ → on the home row")],
                  ]}
                />
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("Around the cursor keys")}
                </h3>
                <Choices
                  value={answers.cursorAround}
                  onChange={(v) => answer({ cursorAround: v })}
                  options={[
                    ["leave", t("Leave the keys around them as they are")],
                    [
                      "none",
                      t(
                        "Set the keys around them to nothing (a slip presses nothing)",
                      ),
                    ],
                    ["nav", t("Home / End / PgUp / PgDn around them")],
                  ]}
                />
                <Para muted>
                  {t(
                    "Keys around the cursor keys get pressed by mistake, so Home / End / PgUp / PgDn there are not recommended.",
                  )}
                </Para>
                <SymbolGridEditor
                  t={t}
                  grid={answers.symbolGrid}
                  columns={symbolColumnCount}
                  onChange={(symbolGrid) => answer({ symbolGrid })}
                />
                {proposal?.note && <Para muted>{noteText(proposal.note)}</Para>}
                {changeButtons}
              </>
            )}

            {step.id === "layer-other" && (
              <>
                <Para>
                  {t(
                    "The hand that is not holding the layer key gets what you type with both hands in typing posture: the thumb holds the layer on one side, the fingers of the other side press the keys.",
                  )}
                </Para>
                <Para>
                  {t(
                    "Unlike the base layer, a key may appear more than once here: put each where it feels easiest to type.",
                  )}
                </Para>
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {t("Keys under the other hand")}
                </h3>
                <LayerPicker
                  t={t}
                  side="other"
                  thumbLayers={thumbLayers}
                  value={(c) => contentLayer(meta, km, answers, "other", c)}
                  label={(pos) => thumbLabel(pos)}
                  onChange={(c, layer) => setContent("other", c, layer)}
                />
                <SymbolGridEditor
                  t={t}
                  grid={answers.symbolGrid}
                  columns={symbolColumnCount}
                  onChange={(symbolGrid) => answer({ symbolGrid })}
                />
                {proposal?.note && <Para muted>{noteText(proposal.note)}</Para>}
                {changeButtons}
              </>
            )}

            {step.id === "rare" && (
              <>
                <Para>
                  {t(
                    "Keys used now and then need no place of their own, and nothing is suggested here. Pick any you want on the keyboard, and they go on free keys of a layer, away from the home row.",
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
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-4 sm:p-6 backdrop-blur-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[var(--color-text)]">
                {board.name}
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {layerStep
                  ? t("All thumb layers")
                  : shownLayer === 0
                    ? t("Base layer")
                    : t("Layer {{n}}", { n: shownLayer })}
                <button
                  type="button"
                  aria-pressed={zoom}
                  onClick={() => setZoom((z) => !z)}
                  className="btn-ghost h-7 border border-[var(--color-border)] flex items-center gap-1 px-2 text-xs"
                >
                  {zoom ? <IconZoomOut size={14} /> : <IconZoomIn size={14} />}
                  {zoom ? t("Fit") : t("Enlarge")}
                </button>
              </span>
            </div>
            {layerStep ? (
              // Every thumb layer, each with the thumb key held for it lit.
              <div className="space-y-4">
                {thumbLayers.map((k) => (
                  <div key={k.layer} className="space-y-1.5">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {t("Layer {{n}} ({{key}} held)", {
                        n: k.layer,
                        key: thumbLabel(k.pos),
                      })}
                    </div>
                    <PracticeBoard
                      board={drawn}
                      marks={marksForLayer(k.layer, k.pos)}
                      dimOthers={marksForLayer(k.layer, k.pos).size > 1}
                      layer={k.layer}
                      layout={layout}
                      scroll={zoom}
                    />
                  </div>
                ))}
                {thumbLayers.length === 0 && (
                  <Para muted>{noteText("one-layer")}</Para>
                )}
              </div>
            ) : (
              <PracticeBoard
                board={drawn}
                marks={marks}
                dimOthers={marks.size > 0}
                layer={shownLayer}
                layout={layout}
                scroll={zoom}
                onKeyClick={
                  step.id === "symbols" && manual
                    ? (pos) =>
                        setPickedSlot(
                          orderedSymbolSlots(board, meta).includes(pos)
                            ? pos
                            : null,
                        )
                    : undefined
                }
              />
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
              {step.id === "symbols" ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded border border-[var(--color-neon)] bg-[color-mix(in_srgb,var(--color-neon)_25%,var(--color-surface-elevated))]" />
                    {t("Slots a symbol may take")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded border border-[var(--color-electric)] bg-[color-mix(in_srgb,var(--color-electric)_55%,var(--color-surface-elevated))]" />
                    {t("Keys that change (old legend struck through)")}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded border border-[var(--color-neon)] bg-[color-mix(in_srgb,var(--color-neon)_25%,var(--color-surface-elevated))]" />
                    {t("Keys the proposal changes (old legend struck through)")}
                  </span>
                  {layerStep && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 rounded border border-[var(--color-electric)] bg-[color-mix(in_srgb,var(--color-electric)_55%,var(--color-surface-elevated))]" />
                      {t("Thumb key held")}
                    </span>
                  )}
                </>
              )}
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

const CONTENT_NAME: Record<LayerContent, string> = {
  none: "No content",
  cursor: "Cursor keys",
  digits: "Numbers (numpad)",
  symbols: "Symbols (the grid below)",
  fkeys: "F keys",
};

/**
 * The symbol layer as a grid to fill in: three rows (above the home row,
 * on it, below it) by six columns, the author's layout to start from.
 */
function SymbolGridEditor({
  t,
  grid,
  columns,
  onChange,
}: {
  t: T;
  grid: string[][];
  /** How many columns the hand has; the grid's outer columns beyond that are unused. */
  columns: number;
  onChange: (grid: string[][]) => void;
}) {
  const rows = [0, 1, 2];
  const cols = [0, 1, 2, 3, 4, 5];
  const unused = (c: number) => c < cols.length - columns;
  const set = (r: number, c: number, v: string) => {
    const next = rows.map((rr) => cols.map((cc) => grid[rr]?.[cc] ?? ""));
    next[r][c] = v.slice(-1);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-[var(--color-text)]">
        {t("Symbols on the layer")}
      </h3>
      <Para muted>
        {t(
          "Symbols you type often should be a layer key plus one key: a modifier on top of a layer is hard to press. Pairs go side by side, ! beside ?, and the rows follow the number row where they can. Rows: above the home row, on it, below it; columns from the hand's outer edge (the modifier column) to the key inward of the index finger.",
        )}
      </Para>
      <div className="inline-grid grid-cols-6 gap-1">
        {rows.map((r) =>
          cols.map((c) => (
            <input
              key={`${r}-${c}`}
              type="text"
              value={grid[r]?.[c] ?? ""}
              onChange={(e) => set(r, c, e.target.value)}
              maxLength={1}
              title={
                unused(c) ? t("No column here on this keyboard") : undefined
              }
              className={`h-9 w-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-center font-mono text-sm text-[var(--color-text)] ${
                unused(c) ? "opacity-30" : ""
              }`}
            />
          )),
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(SALICYLIC_SYMBOL_GRID.map((row) => [...row]))}
        className="btn-ghost h-8 border border-[var(--color-border)] px-3 text-xs"
      >
        {t("Use Salicylic_acid3's symbols")}
      </button>
    </div>
  );
}

/** Each kind of content with the thumb layer it goes on, or none. */
function LayerPicker({
  t,
  side,
  thumbLayers,
  value,
  label,
  onChange,
}: {
  t: T;
  side: "one" | "other";
  thumbLayers: Array<{ pos: number; layer: number; hand: Hand }>;
  value: (content: LayerContent) => number | null;
  label: (pos: number) => string;
  onChange: (content: LayerContent, layer: number | null) => void;
}) {
  const handName = (k: { hand: Hand }) => {
    const left = side === "one" ? k.hand === "L" : k.hand === "R";
    return left ? t("left hand") : t("right hand");
  };
  return (
    <div className="space-y-1.5">
      {CONTENTS.map((c) => (
        <div
          key={c}
          className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          <span className="text-[var(--color-text)]">{t(CONTENT_NAME[c])}</span>
          <select
            value={value(c) ?? ""}
            onChange={(e) =>
              onChange(c, e.target.value === "" ? null : Number(e.target.value))
            }
            className="h-8 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]"
          >
            <option value="">{t("Not placed")}</option>
            {thumbLayers.map((k) => (
              <option key={k.layer} value={k.layer}>
                {t("Layer {{n}} ({{key}} held) → {{hand}}", {
                  n: k.layer,
                  key: label(k.pos),
                  hand: handName(k),
                })}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
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

/**
 * Keeps a fault in the guide from blanking the page: what is shown
 * instead is a note and a way to start the guide over, which also drops
 * the saved progress that may have caused it.
 */
export class GuideBoundary extends Component<
  { t: T; boardId: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("guide failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { t, boardId } = this.props;
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 px-5 py-4 text-sm text-[var(--color-text)]">
        <p>
          {t(
            "The guide ran into a problem, probably with progress saved by an earlier version. Starting over clears it.",
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            clearProgress(boardId);
            this.setState({ failed: false });
          }}
          className="btn-electric h-9 px-4 text-sm"
        >
          {t("Start over")}
        </button>
      </div>
    );
  }
}
