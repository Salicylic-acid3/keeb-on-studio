/**
 * Which caps of the chosen keycap sets go on which keys of a layout.
 *
 * A cap fits a key when it is the same size and shape (a convex cap only
 * goes on a key marked convex, and a plain cap never does) and, on a
 * sculpted set, made for the key's row. Among the caps that fit, keys take one with their own
 * legend first, a blank one next, and one with some other legend last, so
 * as many keys as possible end up with the right legend and every key that
 * can be covered is.
 */
import { isIsoEnter, mainAndSub } from "./edit";
import { allKits, kitById, type Cap, type Kit } from "./kits";
import type { LayoutKey, LayoutProject } from "./model";
import { readingRows } from "./order";

export interface KitChoice {
  kitId: string;
  /** How many of this set. */
  count: number;
}

/** One physical cap out of the chosen sets. */
export interface PoolCap {
  /** Unique among the chosen sets: set, copy of the set, cap. */
  id: string;
  kitId: string;
  cap: Cap;
}

/** ok: right legend. blank: an unprinted cap. sub: some other legend. */
export type FitStatus = "ok" | "blank" | "sub";

export interface Placement {
  cap: PoolCap;
  status: FitStatus;
  /** Made for another row (only ever by hand). */
  offRow: boolean;
  /** Put here by hand; recalculating leaves it alone. */
  pinned: boolean;
}

export interface FitResult {
  placed: Map<string, Placement>;
  /** Keys nothing is left for, in reading order. */
  missing: LayoutKey[];
  /** Caps left over, in set order. */
  spare: PoolCap[];
  counts: { ok: number; blank: number; sub: number; missing: number };
}

const ALIASES: Record<string, string> = {
  backspace: "bs",
  delete: "del",
  control: "ctrl",
  capslock: "caps",
  printscreen: "prtsc",
  print: "prtsc",
  prtscr: "prtsc",
  scrolllock: "scrlk",
  scroll: "scrlk",
  pageup: "pgup",
  pagedown: "pgdn",
  insert: "ins",
  option: "opt",
  escape: "esc",
  return: "enter",
  menu: "app",
  gui: "win",
  cmd: "win",
  super: "win",
  // A space bar has nothing printed on it.
  space: "",
  spc: "",
  "＃": "#",
};

/** Legends compared loosely: case, spaces and the usual spellings aside. */
export function normalLabel(text: string): string {
  const flat = text.toLowerCase().replace(/\s+/g, "");
  return ALIASES[flat] ?? flat;
}

interface Need {
  key: LayoutKey;
  size: string;
  main: string;
  sub: string;
  row?: string;
}

/** Size and shape together: what has to match for a cap to go on a key. */
interface Form {
  w: number;
  h: number;
  iso: boolean;
  convex: boolean;
}

const formKey = (f: Form) =>
  `${f.w}x${f.h}${f.iso ? "iso" : ""}${f.convex ? "c" : ""}`;
const capForm = (cap: Cap): Form => ({
  w: cap.w,
  h: cap.h,
  iso: cap.shape === "iso",
  convex: cap.convex,
});
const capSize = (cap: Cap) => formKey(capForm(cap));

function keyForm(key: LayoutKey): Form {
  const kle = key.kle ?? {};
  const iso = isIsoEnter(key) || (key.h === 2 && (kle.x2 ?? 0) < 0);
  const w =
    !iso && kle.w2 !== undefined && kle.h2 === key.h
      ? Math.max(key.w, kle.w2)
      : key.w;
  return { w, h: key.h, iso, convex: Boolean(key.convex) };
}

function needOf(key: LayoutKey, row: string | undefined): Need {
  const { main, sub } = mainAndSub(key);
  return {
    key,
    size: formKey(keyForm(key)),
    main: normalLabel(main),
    sub: normalLabel(sub),
    row,
  };
}

function sameLegend(need: Need, cap: Cap): boolean {
  return (
    need.main === normalLabel(cap.main) &&
    (!need.sub || need.sub === normalLabel(cap.sub))
  );
}

function statusOf(need: Need, cap: Cap): FitStatus {
  if (!need.main && !need.sub) return "ok";
  if (!cap.blank && sameLegend(need, cap)) return "ok";
  return cap.blank ? "blank" : "sub";
}

function rowFits(need: Need, cap: Cap, kit: Kit | undefined): boolean {
  return !kit?.sculpted || !cap.row || !need.row || cap.row === need.row;
}

/** Sculpt rows for a layout's rows, top to bottom, counted up from the bottom. */
export function defaultRows(count: number): string[] {
  const fromBottom = ["R1", "R1", "R2", "R3", "R4"];
  return Array.from(
    { length: count },
    (_, i) => fromBottom[Math.min(count - 1 - i, fromBottom.length - 1)],
  );
}

/** Every cap of the chosen sets. */
export function poolOf(choices: KitChoice[]): PoolCap[] {
  const pool: PoolCap[] = [];
  for (const { kitId, count } of choices) {
    const kit = kitById(kitId);
    if (!kit) continue;
    for (let copy = 0; copy < count; copy++) {
      for (const cap of kit.caps) {
        pool.push({ id: `${kitId}/${copy}/${cap.index}`, kitId, cap });
      }
    }
  }
  return pool;
}

/**
 * Put the chosen sets' caps on the layout.
 *
 * `rowNames` are the sculpt rows of the layout's rows, top to bottom (see
 * readingRows). `pins` are choices made by hand: a cap id to keep on a key,
 * or null to keep the key bare.
 */
export function fitCaps(
  project: LayoutProject,
  choices: KitChoice[],
  rowNames: string[],
  pins: ReadonlyMap<string, string | null> = new Map(),
): FitResult {
  const rows = readingRows(project.keys);
  const needs: Need[] = rows.flatMap((keys, i) =>
    keys.map((key) => needOf(key, rowNames[i])),
  );
  const pool = poolOf(choices);
  const kits = new Map(allKits().map((k) => [k.id, k]));
  const free = new Map<string, PoolCap[]>();
  for (const cap of pool) {
    const size = capSize(cap.cap);
    free.set(size, [...(free.get(size) ?? []), cap]);
  }
  const placed = new Map<string, Placement>();
  const bare = new Set<string>();
  const take = (need: Need, cap: PoolCap, pinned: boolean) => {
    const list = free.get(capSize(cap.cap))!;
    list.splice(list.indexOf(cap), 1);
    placed.set(need.key.id, {
      cap,
      status: statusOf(need, cap.cap),
      offRow: !rowFits(need, cap.cap, kits.get(cap.kitId)),
      pinned,
    });
  };

  // What was decided by hand comes first and is not touched again.
  for (const need of needs) {
    if (!pins.has(need.key.id)) continue;
    const capId = pins.get(need.key.id);
    if (capId === null) {
      bare.add(need.key.id);
      continue;
    }
    const cap = (free.get(need.size) ?? []).find((c) => c.id === capId);
    if (cap) take(need, cap, true);
  }

  /** The best free cap for `need` among those `want` accepts. */
  const pick = (need: Need, want: (cap: Cap) => boolean) => {
    const homing = need.main === "f" || need.main === "j";
    let best: PoolCap | undefined;
    let bestScore = -1;
    for (const c of free.get(need.size) ?? []) {
      if (!rowFits(need, c.cap, kits.get(c.kitId)) || !want(c.cap)) continue;
      const score = c.cap.nub === homing ? 1 : 0;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  };
  const open = (need: Need) =>
    !placed.has(need.key.id) && !bare.has(need.key.id);
  const labelled = (need: Need) => Boolean(need.main || need.sub);
  const pass = (
    who: (need: Need) => boolean,
    want: (need: Need) => (cap: Cap) => boolean,
  ) => {
    for (const need of needs) {
      if (!open(need) || !who(need)) continue;
      const cap = pick(need, want(need));
      if (cap) take(need, cap, false);
    }
  };

  // Their own legend; then a blank cap; keys with no legend take what is
  // of least use to the others; last, a cap with some other legend.
  pass(labelled, (need) => (cap) => !cap.blank && sameLegend(need, cap));
  pass(labelled, () => (cap) => cap.blank);
  pass(
    (need) => !labelled(need),
    () => (cap) => cap.blank,
  );
  pass(
    (need) => !labelled(need),
    () => () => true,
  );
  pass(labelled, () => () => true);

  const missing = needs.filter((n) => !placed.has(n.key.id)).map((n) => n.key);
  const used = new Set([...placed.values()].map((p) => p.cap.id));
  const counts = { ok: 0, blank: 0, sub: 0, missing: missing.length };
  for (const p of placed.values()) counts[p.status] += 1;
  return {
    placed,
    missing,
    spare: pool.filter((c) => !used.has(c.id)),
    counts,
  };
}

/** Whether a spare cap can go on a key at all: the same size and shape. */
export function capFitsKey(cap: Cap, key: LayoutKey): boolean {
  return capSize(cap) === needOf(key, undefined).size;
}

export interface ShortOf extends Form {
  count: number;
}

/** The keys nothing was left for, counted by size and shape. */
export function missingBySize(missing: LayoutKey[]): ShortOf[] {
  const counts = new Map<string, ShortOf>();
  for (const key of missing) {
    const form = keyForm(key);
    const id = formKey(form);
    const entry = counts.get(id) ?? { ...form, count: 0 };
    entry.count += 1;
    counts.set(id, entry);
  }
  return [...counts.values()];
}

/**
 * Caps sorted into the piles a person would sort them into: by row, then
 * by length, then by shape.
 */
export interface CapPile {
  row?: string;
  w: number;
  h: number;
  iso: boolean;
  convex: boolean;
  caps: PoolCap[];
}

export function pileCaps(caps: PoolCap[]): CapPile[] {
  const piles = new Map<string, CapPile>();
  for (const cap of caps) {
    const form = capForm(cap.cap);
    const id = `${cap.cap.row ?? ""}|${formKey(form)}`;
    let pile = piles.get(id);
    if (!pile) {
      pile = {
        ...form,
        ...(cap.cap.row ? { row: cap.cap.row } : {}),
        caps: [],
      };
      piles.set(id, pile);
    }
    pile.caps.push(cap);
  }
  // R4 (the top row) first, caps of no particular row last.
  const rowRank = (row?: string) => (row ? -Number(row.slice(1)) : 1);
  const shapeRank = (p: CapPile) => (p.iso ? 2 : p.convex ? 1 : 0);
  return [...piles.values()]
    .map((p) => ({
      ...p,
      caps: p.caps
        .slice()
        .sort(
          (a, b) =>
            Number(a.cap.blank) - Number(b.cap.blank) ||
            a.cap.main.localeCompare(b.cap.main),
        ),
    }))
    .sort(
      (a, b) =>
        rowRank(a.row) - rowRank(b.row) ||
        a.w - b.w ||
        a.h - b.h ||
        shapeRank(a) - shapeRank(b),
    );
}

/** One of each of the given sets against the layout, for a side-by-side look. */
export function compareSets(
  project: LayoutProject,
  rowNames: string[],
  kits: Kit[],
): Array<{ kit: Kit; counts: FitResult["counts"] }> {
  return kits.map((kit) => ({
    kit,
    counts: fitCaps(project, [{ kitId: kit.id, count: 1 }], rowNames).counts,
  }));
}
