/**
 * Typing what the keys say: legends on the legend layer, matrix positions
 * on the matrix layer. Enter or Tab commits and moves to the next key, so
 * a whole keyboard is typed without touching the mouse; on a phone the
 * Next button does the same without closing the on-screen keyboard.
 */
import {
  IconChevronLeft,
  IconChevronRight,
  IconKeyboard,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { mainAndSub } from "../lib/edit";
import { QUICK_LABELS, type LabelLayout } from "../lib/keyLabels";
import type { LayoutKey, LayoutLayer } from "../lib/model";
import {
  parseMatrix,
  type MatrixStats,
  type SplitNumbering,
} from "../lib/order";

const FIELD =
  "min-h-11 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 focus:outline-none focus:border-[var(--color-electric)]";
const TILE =
  "min-h-11 min-w-11 px-2 flex items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors disabled:opacity-40";
const TILE_IDLE =
  "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]";
const TILE_ON =
  "border-[var(--color-electric)] text-[var(--color-text)] bg-[var(--color-electric)]/10";
const CHIP =
  "min-h-9 px-2.5 rounded-md border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]";

/** Keeps focus where it is: a tap on this must not close the phone keyboard. */
const keepFocus = (e: React.PointerEvent | React.MouseEvent) =>
  e.preventDefault();

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
      {children}
    </h3>
  );
}

function StepButtons({ onStep }: { onStep: (by: 1 | -1) => void }) {
  const { t } = useLanguage();
  return (
    <>
      <button
        type="button"
        className={`${TILE} ${TILE_IDLE}`}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => onStep(-1)}
        aria-label={t("Previous key")}
        title={t("Previous key")}
      >
        <IconChevronLeft size={18} />
      </button>
      <button
        type="button"
        className={`${TILE} ${TILE_IDLE}`}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => onStep(1)}
        aria-label={t("Next key")}
        title={t("Next key")}
      >
        <IconChevronRight size={18} />
      </button>
    </>
  );
}

// The twelve KLE positions, as rows of three: top, middle, bottom, front.
const SLOT_ROWS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
];

export interface LegendEntryProps {
  /** The one selected key, or null. */
  target: LayoutKey | null;
  selectedCount: number;
  onCommit: (main: string, sub: string) => void;
  onSlot: (slot: number, text: string) => void;
  onStep: (by: 1 | -1) => void;
  labelLayout: LabelLayout;
  onLabelLayout: (layout: LabelLayout) => void;
  capture: boolean;
  onToggleCapture: () => void;
  onFillRow: (row: "number" | "top" | "home" | "bottom" | "function") => void;
  /** Changes when the field should take the focus. */
  focusToken: number;
}

function LegendEntry({
  target,
  selectedCount,
  onCommit,
  onSlot,
  onStep,
  labelLayout,
  onLabelLayout,
  capture,
  onToggleCapture,
  onFillRow,
  focusToken,
}: LegendEntryProps) {
  const { t } = useLanguage();
  const mainRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ forId: "", main: "", sub: "" });
  const [allSlots, setAllSlots] = useState(false);

  useEffect(() => {
    if (focusToken === 0) return;
    mainRef.current?.focus();
    mainRef.current?.select();
  }, [focusToken]);

  // Arriving on the next key with the box still focused: select what is
  // there, so typing replaces it instead of adding to it.
  const targetId = target?.id;
  useEffect(() => {
    const el = mainRef.current;
    if (el && document.activeElement === el) el.select();
  }, [targetId]);

  const saved = target ? mainAndSub(target) : { main: "", sub: "" };
  const live = target && draft.forId === target.id ? draft : saved;
  const edit = (patch: { main?: string; sub?: string }) => {
    if (target) setDraft({ forId: target.id, ...live, ...patch });
  };
  const commit = () => {
    if (target && (live.main !== saved.main || live.sub !== saved.sub)) {
      onCommit(live.main, live.sub);
    }
  };
  const go = (by: 1 | -1) => {
    commit();
    onStep(by);
    mainRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  };

  const rows: Array<{
    id: "number" | "top" | "home" | "bottom" | "function";
    label: string;
  }> = [
    { id: "function", label: "F1 …" },
    { id: "number", label: "1 2 3 …" },
    { id: "top", label: "Q W E …" },
    { id: "home", label: "A S D …" },
    { id: "bottom", label: "Z X C …" },
  ];

  return (
    <div>
      <Heading>{t("Key legend")}</Heading>
      {target ? (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <input
              ref={mainRef}
              className={`${FIELD} flex-1`}
              value={live.main}
              onChange={(e) => edit({ main: e.target.value })}
              onKeyDown={onKeyDown}
              onBlur={commit}
              placeholder={t("Key legend")}
              aria-label={t("Key legend")}
              enterKeyHint="next"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <input
              className={`${FIELD} w-20`}
              value={live.sub}
              onChange={(e) => edit({ sub: e.target.value })}
              onKeyDown={onKeyDown}
              onBlur={commit}
              placeholder={t("Shifted")}
              aria-label={t("Shifted legend")}
              enterKeyHint="next"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <StepButtons onStep={go} />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            {t("Enter or Tab moves to the next key.")}
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {QUICK_LABELS.map((label) => (
              <button
                key={label}
                type="button"
                className={CHIP}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => {
                  onCommit(label, "");
                  setDraft({ forId: "", main: "", sub: "" });
                  onStep(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-[var(--color-cyber)] hover:underline mb-2"
            onClick={() => setAllSlots((on) => !on)}
            aria-expanded={allSlots}
          >
            {allSlots ? t("Hide the 12 positions") : t("All 12 positions")}
          </button>
          {allSlots && (
            <div className="grid grid-cols-3 gap-1 mb-2">
              {SLOT_ROWS.flat().map((slot) => (
                <input
                  // Remount per key so each box shows that key's own text.
                  key={`${target.id}:${slot}:${target.legends[slot] ?? ""}`}
                  className={`${FIELD} !px-2 text-xs ${slot >= 9 ? "opacity-70" : ""}`}
                  defaultValue={target.legends[slot] ?? ""}
                  aria-label={t("Position {{n}}", { n: slot + 1 })}
                  onBlur={(e) => onSlot(slot, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">
          {selectedCount > 1
            ? t(
                "Several keys are selected: pour a row into them, left to right.",
              )
            : t(
                "Select a key to type its legend. A double click starts typing.",
              )}
        </p>
      )}

      {selectedCount > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={CHIP}
              onClick={() => onFillRow(row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={capture}
          className={`${TILE} flex-1 ${capture ? TILE_ON : TILE_IDLE}`}
          onClick={onToggleCapture}
        >
          <IconKeyboard size={18} />
          {t("Type with key presses")}
        </button>
        <select
          value={labelLayout}
          onChange={(e) => onLabelLayout(e.target.value as LabelLayout)}
          aria-label={t("Legend set")}
          className={`${FIELD} !px-2`}
        >
          <option value="us">US</option>
          <option value="jis">JIS</option>
        </select>
      </div>
      {capture && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
          {t(
            "Each key you press on your own keyboard becomes the selected key's legend, and the selection moves on. Turn this off to use shortcuts again.",
          )}
        </p>
      )}
    </div>
  );
}

export interface MatrixEntryProps {
  target: LayoutKey | null;
  /** What Enter on an empty box takes up. */
  suggestion: { row: number; col: number } | null;
  onCommit: (position: { row: number; col: number } | null) => void;
  onStep: (by: 1 | -1) => void;
  stats: MatrixStats;
  /** How many keys have a faint suggested number. */
  suggested: number;
  onAdoptAll: () => void;
  onRenumber: () => void;
  /** The layout has two halves. */
  split: boolean;
  numbering: SplitNumbering;
  onNumbering: (numbering: SplitNumbering) => void;
  onPickCell: (row: number, col: number) => void;
  focusToken: number;
}

function MatrixEntry({
  target,
  suggestion,
  onCommit,
  onStep,
  stats,
  suggested,
  onAdoptAll,
  onRenumber,
  split,
  numbering,
  onNumbering,
  onPickCell,
  focusToken,
}: MatrixEntryProps) {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ forId: "", text: "", bad: false });

  useEffect(() => {
    if (focusToken === 0) return;
    ref.current?.focus();
    ref.current?.select();
  }, [focusToken]);

  const targetId = target?.id;
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) el.select();
  }, [targetId]);

  const saved = target?.matrix
    ? `${target.matrix.row},${target.matrix.col}`
    : "";
  const live = target && draft.forId === target.id ? draft : null;
  const text = live ? live.text : saved;

  /** Returns false when what is typed is not a position. */
  const commit = (adopt: boolean): boolean => {
    if (!target) return true;
    if (text.trim() === "") {
      if (target.matrix) onCommit(null);
      else if (adopt && suggestion) onCommit(suggestion);
      return true;
    }
    const parsed = parseMatrix(text);
    if (!parsed) {
      setDraft({ forId: target.id, text, bad: true });
      return false;
    }
    if (text !== saved) onCommit(parsed);
    return true;
  };
  const go = (by: 1 | -1) => {
    if (!commit(by === 1)) return;
    setDraft({ forId: "", text: "", bad: false });
    onStep(by);
    ref.current?.focus();
  };

  // One more row and column than in use, so the table can grow by a tap.
  const tableRows = Math.min(stats.rows + 1, 16);
  const tableCols = Math.min(stats.cols + 1, 24);
  const targetCell = target?.matrix
    ? `${target.matrix.row},${target.matrix.col}`
    : null;

  return (
    <div>
      <Heading>{t("Matrix position (row, column)")}</Heading>
      {target ? (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <input
              ref={ref}
              className={`${FIELD} flex-1 tabular-nums ${
                live?.bad ? "!border-[#e5484d]" : ""
              }`}
              value={text}
              onChange={(e) =>
                setDraft({ forId: target.id, text: e.target.value, bad: false })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  go(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => commit(false)}
              placeholder={
                suggestion ? `${suggestion.row},${suggestion.col}` : "0,0"
              }
              aria-label={t("Matrix position (row, column)")}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
            />
            <StepButtons onStep={go} />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2 leading-relaxed">
            {live?.bad
              ? t("Type the row and the column, like 2,5.")
              : suggestion && !target.matrix
                ? t(
                    "Enter takes the faint number and moves on. Typing replaces it.",
                  )
                : t("Enter or Tab moves to the next key.")}
          </p>
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">
          {t("Select a key to give it a matrix position.")}
        </p>
      )}

      <p className="text-xs text-[var(--color-text-secondary)] mb-2 tabular-nums">
        {stats.rows > 0
          ? t("{{rows}} rows x {{cols}} columns, {{free}} free", {
              rows: stats.rows,
              cols: stats.cols,
              free: stats.free,
            })
          : t("No positions yet")}
        {stats.missing > 0 &&
          ` · ${t("{{count}} keys without one", { count: stats.missing })}`}
      </p>
      {stats.duplicates.size > 0 && (
        <p role="alert" className="text-xs text-[#e5484d] mb-2">
          {t("{{count}} keys share a position with another key.", {
            count: stats.duplicates.size,
          })}
        </p>
      )}

      {split && (
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
          {t("Two halves")}
          <select
            value={numbering}
            onChange={(e) => onNumbering(e.target.value as SplitNumbering)}
            className={`${FIELD} !px-2 flex-1`}
          >
            <option value="across">{t("Columns run on across both")}</option>
            <option value="stacked">{t("Right half gets its own rows")}</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <button
          type="button"
          className={`${TILE} ${TILE_IDLE}`}
          onClick={onAdoptAll}
          disabled={suggested === 0}
        >
          {t("Take all faint numbers")}
        </button>
        <button
          type="button"
          className={`${TILE} ${TILE_IDLE}`}
          onClick={onRenumber}
        >
          {t("Renumber everything")}
        </button>
      </div>

      {stats.rows > 0 && (
        <div className="overflow-x-auto">
          <table
            className="border-separate"
            style={{ borderSpacing: 2 }}
            aria-label={t("Matrix table")}
          >
            <tbody>
              {Array.from({ length: tableRows }, (_, row) => (
                <tr key={row}>
                  {Array.from({ length: tableCols }, (_, col) => {
                    const id = `${row},${col}`;
                    const used = stats.cells.get(id)?.length ?? 0;
                    const mine = id === targetCell;
                    const colour = mine
                      ? "bg-[var(--color-electric)] border-[var(--color-electric)]"
                      : used > 1
                        ? "bg-[#e5484d] border-[#e5484d]"
                        : used === 1
                          ? "bg-[var(--color-text-muted)] border-transparent"
                          : "border-[var(--color-border-hover)]";
                    return (
                      <td key={col} className="p-0">
                        <button
                          type="button"
                          disabled={!target}
                          onClick={() => onPickCell(row, col)}
                          title={id}
                          aria-label={id}
                          className={`block w-6 h-6 rounded-[4px] border ${colour}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
            {t(
              "Filled squares are in use. Tap a square to give the selected key that position.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function EntryPanel({
  layer,
  legend,
  matrix,
}: {
  layer: LayoutLayer;
  legend: LegendEntryProps;
  matrix: MatrixEntryProps;
}) {
  return (
    <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
      {layer === "matrix" ? (
        <MatrixEntry {...matrix} />
      ) : (
        <LegendEntry {...legend} />
      )}
    </div>
  );
}
