/**
 * Which caps of the chosen keycap sets go on which keys of a layout.
 *
 * A cap fits a key when it is the same size and, on a sculpted set, made
 * for the key's row. Convex caps are a shape of their own: they go on any
 * key of their length, whatever its row, and a key marked as convex takes
 * nothing else. Plain keys are given plain caps first. Among the caps that fit, keys take one with their own
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
  /** The cap sits a quarter turn round: a wide cap on an upright key. */
  turned: boolean;
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
  /**
   * For an upright key (taller than wide, like the 1u x 1.25u keys of a
   * numpad): the size of the wide cap that goes on it turned a quarter
   * round. Such keys are usually just a 1.25u cap stood on end.
   */
  turnedSize?: string;
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

/** What has to be equal for a cap to sit on a key: length, height, outline. */
const formKey = (f: Form) => `${f.w}x${f.h}${f.iso ? "iso" : ""}`;
/** The same with the shape, for telling piles and shortages apart. */
const shapeKey = (f: Form) => `${formKey(f)}${f.convex ? "c" : ""}`;
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
  const form = keyForm(key);
  return {
    key,
    size: formKey(form),
    ...(!form.iso && form.h > form.w
      ? { turnedSize: formKey({ ...form, w: form.h, h: form.w }) }
      : {}),
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
  // A convex cap is not sculpted to a row.
  if (cap.convex) return true;
  return !kit?.sculpted || !cap.row || !need.row || cap.row === need.row;
}

/** A key marked convex takes only convex caps; any other key takes either. */
function shapeFits(key: LayoutKey, cap: Cap): boolean {
  return !key.convex || cap.convex;
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
      turned: capSize(cap.cap) !== need.size,
    });
  };
  /** Free caps of the key's size, then the wide ones that go on turned. */
  const candidates = (need: Need): PoolCap[] => [
    ...(free.get(need.size) ?? []),
    ...(need.turnedSize ? (free.get(need.turnedSize) ?? []) : []),
  ];

  // What was decided by hand comes first and is not touched again.
  for (const need of needs) {
    if (!pins.has(need.key.id)) continue;
    const capId = pins.get(need.key.id);
    if (capId === null) {
      bare.add(need.key.id);
      continue;
    }
    const cap = candidates(need).find((c) => c.id === capId);
    if (cap && shapeFits(need.key, cap.cap)) take(need, cap, true);
  }

  /**
   * The best free cap for `need` among those `want` accepts. A plain key is
   * offered convex caps only once `lastResort` is set.
   */
  const pick = (
    need: Need,
    want: (cap: Cap) => boolean,
    lastResort: boolean,
  ) => {
    const homing = need.main === "f" || need.main === "j";
    let best: PoolCap | undefined;
    let bestScore = -1;
    for (const c of candidates(need)) {
      if (!shapeFits(need.key, c.cap)) continue;
      const turned = capSize(c.cap) !== need.size;
      // Only caps shaped the same on every row are turned on their own
      // accord; a sculpted one would lean sideways.
      if (turned && kits.get(c.kitId)?.sculpted) continue;
      if (c.cap.convex && !need.key.convex && !lastResort) continue;
      if (!rowFits(need, c.cap, kits.get(c.kitId)) || !want(c.cap)) continue;
      // A cap made upright comes before one turned round.
      const score = (turned ? 0 : 2) + (c.cap.nub === homing ? 1 : 0);
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
    lastResort: boolean,
  ) => {
    for (const need of needs) {
      if (!open(need) || !who(need)) continue;
      const cap = pick(need, want(need), lastResort);
      if (cap) take(need, cap, false);
    }
  };

  // Their own legend; then a blank cap; keys with no legend take what is
  // of least use to the others; last, a cap with some other legend. All of
  // that with caps of the key's own shape first, and only then, for plain
  // keys still bare, with the convex caps that happen to be their length.
  for (const lastResort of [false, true]) {
    pass(
      labelled,
      (need) => (cap) => !cap.blank && sameLegend(need, cap),
      lastResort,
    );
    pass(labelled, () => (cap) => cap.blank, lastResort);
    pass(
      (need) => !labelled(need),
      () => (cap) => cap.blank,
      lastResort,
    );
    pass(
      (need) => !labelled(need),
      () => () => true,
      lastResort,
    );
    pass(labelled, () => () => true, lastResort);
  }

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

/**
 * Whether a cap can go on a key at all: the same size (for an upright key,
 * also the wide cap of its size turned round), and convex if the key is
 * marked convex.
 */
export function capFitsKey(cap: Cap, key: LayoutKey): boolean {
  const need = needOf(key, undefined);
  const size = capSize(cap);
  return (
    (size === need.size || size === need.turnedSize) && shapeFits(key, cap)
  );
}

export interface ShortOf extends Form {
  count: number;
}

/** The keys nothing was left for, counted by size and shape. */
export function missingBySize(missing: LayoutKey[]): ShortOf[] {
  const counts = new Map<string, ShortOf>();
  for (const key of missing) {
    const form = keyForm(key);
    const id = shapeKey(form);
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
    const id = `${cap.cap.row ?? ""}|${shapeKey(form)}`;
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
