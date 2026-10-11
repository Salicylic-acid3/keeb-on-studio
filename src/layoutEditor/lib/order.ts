/**
 * The order keys are read in (rows top to bottom, left to right within a
 * row, by where they are drawn) and the matrix numbering that follows from
 * it: suggestions for keys that have no position yet, and the checks.
 */
import { keyCorners, type LayoutKey, type LayoutProject } from "./model";

/** Keys whose centres are within this many u vertically share a row. */
const ROW_REACH = 0.5;
/** A clear vertical strip at least this wide, in u, splits a keyboard. */
const SPLIT_GAP = 0.75;

const isSolid = (k: LayoutKey) => !k.kle?.decal;

/** Keys grouped into rows as drawn, each row left to right. */
export function readingRows(keys: LayoutKey[]): LayoutKey[][] {
  const sorted = keys
    .filter(isSolid)
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const rows: Array<{ sum: number; keys: LayoutKey[] }> = [];
  for (const key of sorted) {
    const row = rows.find(
      (r) => Math.abs(r.sum / r.keys.length - key.cy) < ROW_REACH,
    );
    if (row) {
      row.keys.push(key);
      row.sum += key.cy;
    } else {
      rows.push({ sum: key.cy, keys: [key] });
    }
  }
  return rows
    .sort((a, b) => a.sum / a.keys.length - b.sum / b.keys.length)
    .map((r) => r.keys.sort((a, b) => a.cx - b.cx));
}

/** The x, in u, of the widest clear strip between two halves, or null. */
export function splitAt(keys: LayoutKey[]): number | null {
  const spans = keys
    .filter(isSolid)
    .map((k) => {
      const xs = keyCorners(k).map((p) => p.x);
      return [Math.min(...xs), Math.max(...xs)] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  let best: number | null = null;
  let bestGap = SPLIT_GAP - 1e-6;
  let reach = -Infinity;
  for (const [from, to] of spans) {
    if (reach !== -Infinity && from - reach > bestGap) {
      bestGap = from - reach;
      best = (from + reach) / 2;
    }
    reach = Math.max(reach, to);
  }
  return best;
}

/**
 * How a split keyboard's halves are numbered: "across" runs each row
 * through both halves; "stacked" gives the right half its own rows after
 * the left half's (rows 0-3 left, 4-7 right), as split matrices are wired.
 */
export type SplitNumbering = "across" | "stacked";

/** Rows in the order the matrix is numbered. */
export function matrixRows(
  project: LayoutProject,
  split: SplitNumbering,
): LayoutKey[][] {
  const at = split === "stacked" ? splitAt(project.keys) : null;
  if (at === null) return readingRows(project.keys);
  return [
    ...readingRows(project.keys.filter((k) => k.cx < at)),
    ...readingRows(project.keys.filter((k) => k.cx >= at)),
  ];
}

/** The key before or after `id` in the given rows, or null at the ends. */
export function stepInRows(
  rows: LayoutKey[][],
  id: string,
  by: 1 | -1,
): string | null {
  const flat = rows.flat();
  const i = flat.findIndex((k) => k.id === id);
  if (i < 0) return null;
  return flat[i + by]?.id ?? null;
}

const cell = (row: number, col: number) => `${row},${col}`;

/**
 * A matrix position for every key that has none, carrying on from the keys
 * that do: along a row the column counts up, and a new row takes the next
 * row number. Positions already in use are skipped.
 */
export function suggestMatrix(
  project: LayoutProject,
  split: SplitNumbering,
): Map<string, { row: number; col: number }> {
  const out = new Map<string, { row: number; col: number }>();
  const used = new Set<string>();
  for (const k of project.keys) {
    if (k.matrix) used.add(cell(k.matrix.row, k.matrix.col));
  }
  let lastRow = -1;
  for (const keys of matrixRows(project, split)) {
    const numbered = keys.find((k) => k.matrix);
    const row = numbered?.matrix ? numbered.matrix.row : lastRow + 1;
    lastRow = Math.max(lastRow, row);
    let col = -1;
    for (const key of keys) {
      if (key.matrix) {
        if (key.matrix.row === row) col = key.matrix.col;
        continue;
      }
      col += 1;
      while (used.has(cell(row, col))) col += 1;
      used.add(cell(row, col));
      out.set(key.id, { row, col });
    }
  }
  return out;
}

export interface MatrixStats {
  rows: number;
  cols: number;
  /** Keys that share a position with another key. */
  duplicates: Set<string>;
  /** Keys with no position yet. */
  missing: number;
  /** Positions inside rows x cols that no key uses. */
  free: number;
  /** Which key ids sit on each used position. */
  cells: Map<string, string[]>;
}

export function matrixStats(project: LayoutProject): MatrixStats {
  const cells = new Map<string, string[]>();
  let rows = 0;
  let cols = 0;
  let missing = 0;
  for (const k of project.keys) {
    if (!isSolid(k)) continue;
    if (!k.matrix) {
      missing += 1;
      continue;
    }
    rows = Math.max(rows, k.matrix.row + 1);
    cols = Math.max(cols, k.matrix.col + 1);
    const id = cell(k.matrix.row, k.matrix.col);
    cells.set(id, [...(cells.get(id) ?? []), k.id]);
  }
  const duplicates = new Set<string>();
  for (const ids of cells.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  }
  return {
    rows,
    cols,
    duplicates,
    missing,
    free: rows * cols - cells.size,
    cells,
  };
}

/** "2,5", "2 5" or "2-5" as a matrix position; null for anything else. */
export function parseMatrix(text: string): { row: number; col: number } | null {
  const m = /^\s*(\d{1,3})\s*[,.\s\-:;/]\s*(\d{1,3})\s*$/.exec(text);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}
