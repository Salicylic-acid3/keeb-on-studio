/**
 * Which key on screen a press belongs to, and what the test has seen so far.
 *
 * Kept free of React and the DOM so the rules can be tested on their own.
 * A "source" is one thing the browser reports going down and up: a key code
 * ("key:KeyA") or a mouse button ("mouse:0").
 */
import { isTestable, type TestBoard } from "./boards";
import { modOfCode, type Mod } from "./triggers";

/** Down-up-down quicker than this is a switch bouncing, not a finger. */
export const CHATTER_MS = 40;

/**
 * Within this long of a modifier going down, a key sent together with that
 * modifier (LG(LBKT)) takes the modifier over: it was the one key's press.
 */
const IMPLIED_MOD_MS = 60;

/**
 * Keys a browser reports only once per press, or not in pairs: Caps Lock on
 * a Mac goes down when it turns on and up when it turns off, and 英数 / かな
 * often have no key-up. They flash rather than stay lit.
 */
const TAP_ONLY = new Set(["CapsLock", "Lang1", "Lang2"]);

export const LOG_SIZE = 16;

export interface LogEntry {
  n: number;
  /** `KeyboardEvent.code`, or "Mouse 0" for a button. */
  code: string;
  /** `KeyboardEvent.key`, for a key. */
  key?: string;
  mods: Mod[];
  /** Keys it lit; none means it is not on this keyboard. */
  keyIds: string[];
  chatter: boolean;
}

export interface TestState {
  /** What is held right now: source -> keys it lights. */
  pressed: Record<string, string[]>;
  /** Presses seen per key. */
  counts: Record<string, number>;
  /** Bounces seen per key. */
  chatter: Record<string, number>;
  /** Keys lit for a moment (a tap-only key, or a key-up with no key-down). */
  flash: Record<string, number>;
  lastUp: Record<string, number>;
  /** Codes pressed that no key of this keyboard sends, with how often. */
  unmapped: Record<string, number>;
  log: LogEntry[];
  recentMod?: { source: string; time: number; mod: Mod; newly: string[] };
  seq: number;
}

export function initialState(): TestState {
  return {
    pressed: {},
    counts: {},
    chatter: {},
    flash: {},
    lastUp: {},
    unmapped: {},
    log: [],
    seq: 0,
  };
}

interface CodeEntry {
  plain: string[];
  modded: Array<{ id: string; mods: Mod[] }>;
  hold: string[];
}

export interface BoardIndex {
  codes: Map<string, CodeEntry>;
  mouse: Map<number, string[]>;
  testable: string[];
}

export function indexBoard(board: TestBoard): BoardIndex {
  const codes = new Map<string, CodeEntry>();
  const mouse = new Map<number, string[]>();
  const entry = (code: string) => {
    let e = codes.get(code);
    if (!e) {
      e = { plain: [], modded: [], hold: [] };
      codes.set(code, e);
    }
    return e;
  };
  for (const key of board.keys) {
    const t = key.trigger;
    if (t.kind === "key") {
      for (const code of [t.code, ...(key.alsoCodes ?? [])]) {
        if (t.mods.length)
          entry(code).modded.push({ id: key.id, mods: t.mods });
        else entry(code).plain.push(key.id);
      }
      if (t.hold) entry(t.hold).hold.push(key.id);
    } else if (t.kind === "mouse") {
      mouse.set(t.button, [...(mouse.get(t.button) ?? []), key.id]);
    }
  }
  return {
    codes,
    mouse,
    testable: board.keys.filter(isTestable).map((k) => k.id),
  };
}

/** The keys a code pressed with `mods` held belongs to. */
export function resolve(
  index: BoardIndex,
  code: string,
  mods: Mod[],
): { ids: string[]; viaMods: Mod[] } {
  const e = index.codes.get(code);
  if (!e) return { ids: [], viaMods: [] };
  const fits = e.modded.filter((m) => m.mods.every((x) => mods.includes(x)));
  if (fits.length) {
    const most = Math.max(...fits.map((m) => m.mods.length));
    const best = fits.filter((m) => m.mods.length === most);
    return { ids: best.map((m) => m.id), viaMods: best[0].mods };
  }
  if (e.plain.length) return { ids: e.plain, viaMods: [] };
  if (e.modded.length) return { ids: e.modded.map((m) => m.id), viaMods: [] };
  return { ids: e.hold, viaMods: [] };
}

function bump(record: Record<string, number>, ids: string[], by = 1) {
  const next = { ...record };
  for (const id of ids) {
    const v = (next[id] ?? 0) + by;
    if (v > 0) next[id] = v;
    else delete next[id];
  }
  return next;
}

function pushLog(state: TestState, entry: Omit<LogEntry, "n">): TestState {
  const seq = state.seq + 1;
  return {
    ...state,
    seq,
    log: [{ ...entry, n: seq }, ...state.log].slice(0, LOG_SIZE),
  };
}

export interface PressEvent {
  code: string;
  key?: string;
  mods: Mod[];
  repeat: boolean;
  time: number;
}

export function keyDown(
  state: TestState,
  index: BoardIndex,
  ev: PressEvent,
): TestState {
  const source = `key:${ev.code}`;
  if (ev.repeat || state.pressed[source]) return state;
  const { ids, viaMods } = resolve(index, ev.code, ev.mods);
  const last = state.lastUp[source];
  const bounced =
    ids.length > 0 && last !== undefined && ev.time - last < CHATTER_MS;
  const next: TestState = { ...state };
  if (ids.length === 0) {
    next.unmapped = bump(state.unmapped, [ev.code]);
  }

  // A key that sends a modifier with it (LG(LBKT)) shows up as the
  // modifier going down first. Undo that and hand the modifier to this key.
  const recent = state.recentMod;
  if (
    recent &&
    viaMods.includes(recent.mod) &&
    ev.time - recent.time < IMPLIED_MOD_MS &&
    state.pressed[recent.source]
  ) {
    next.counts = bump(next.counts, recent.newly, -1);
    next.pressed = { ...next.pressed, [recent.source]: ids };
    next.recentMod = undefined;
  }

  if (TAP_ONLY.has(ev.code)) {
    next.counts = bump(next.counts, ids);
    next.flash = { ...next.flash };
    for (const id of ids) next.flash[id] = next.seq + 1;
  } else {
    next.counts = bump(next.counts, ids);
    next.pressed = { ...next.pressed, [source]: ids };
  }
  if (bounced) next.chatter = bump(next.chatter, ids);

  const mod = modOfCode(ev.code);
  if (mod) {
    next.recentMod = {
      source,
      time: ev.time,
      mod,
      newly: ids,
    };
  } else if (
    next.recentMod &&
    ev.time - next.recentMod.time >= IMPLIED_MOD_MS
  ) {
    next.recentMod = undefined;
  }

  return pushLog(next, {
    code: ev.code,
    key: ev.key,
    mods: ev.mods,
    keyIds: ids,
    chatter: bounced,
  });
}

export function keyUp(
  state: TestState,
  index: BoardIndex,
  ev: { code: string; time: number },
): TestState {
  const source = `key:${ev.code}`;
  const lastUp = { ...state.lastUp, [source]: ev.time };
  if (state.pressed[source]) {
    const pressed = { ...state.pressed };
    delete pressed[source];
    return { ...state, pressed, lastUp };
  }
  const { ids } = resolve(index, ev.code, []);
  if (ids.length === 0) return { ...state, lastUp };
  const flash = { ...state.flash };
  for (const id of ids) flash[id] = state.seq + 1;
  // A key whose key-down the system kept (Print Screen on Windows) still
  // counts as pressed once; a tap-only key was counted going down.
  const counts = TAP_ONLY.has(ev.code)
    ? bump(
        state.counts,
        ids.filter((id) => !state.counts[id]),
      )
    : bump(state.counts, ids);
  return pushLog(
    { ...state, lastUp, flash, counts },
    { code: ev.code, mods: [], keyIds: ids, chatter: false },
  );
}

export function mouseDown(
  state: TestState,
  index: BoardIndex,
  ev: { button: number; time: number },
): TestState {
  const source = `mouse:${ev.button}`;
  if (state.pressed[source]) return state;
  const ids = index.mouse.get(ev.button) ?? [];
  const last = state.lastUp[source];
  const bounced =
    ids.length > 0 && last !== undefined && ev.time - last < CHATTER_MS;
  const next: TestState = {
    ...state,
    counts: bump(state.counts, ids),
    pressed: { ...state.pressed, [source]: ids },
    chatter: bounced ? bump(state.chatter, ids) : state.chatter,
  };
  return pushLog(next, {
    code: `Mouse ${ev.button}`,
    mods: [],
    keyIds: ids,
    chatter: bounced,
  });
}

export function mouseUp(
  state: TestState,
  ev: { button: number; time: number },
): TestState {
  const source = `mouse:${ev.button}`;
  const pressed = { ...state.pressed };
  delete pressed[source];
  return {
    ...state,
    pressed,
    lastUp: { ...state.lastUp, [source]: ev.time },
  };
}

/**
 * Let go of everything held, or of every key that is not a modifier: a Mac
 * sends no key-up for a key let go while Command is held, so when Command
 * comes up the rest are let go with it.
 */
export function releaseAll(
  state: TestState,
  { keepModifiers = false }: { keepModifiers?: boolean } = {},
): TestState {
  const pressed: Record<string, string[]> = {};
  if (keepModifiers) {
    for (const [source, ids] of Object.entries(state.pressed)) {
      if (source.startsWith("key:") && modOfCode(source.slice(4)))
        pressed[source] = ids;
    }
  }
  return { ...state, pressed, recentMod: undefined };
}

export function clearFlash(state: TestState, upTo: number): TestState {
  const flash = Object.fromEntries(
    Object.entries(state.flash).filter(([, token]) => token > upTo),
  );
  return { ...state, flash };
}

/** Ids of the keys held right now. */
export function heldKeys(state: TestState): Set<string> {
  const held = new Set<string>();
  for (const ids of Object.values(state.pressed))
    ids.forEach((id) => held.add(id));
  for (const id of Object.keys(state.flash)) held.add(id);
  return held;
}

/** The modifiers a keyboard or mouse event says are held. */
export function modsOf(e: {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): Mod[] {
  const mods: Mod[] = [];
  if (e.shiftKey) mods.push("shift");
  if (e.ctrlKey) mods.push("ctrl");
  if (e.altKey) mods.push("alt");
  if (e.metaKey) mods.push("meta");
  return mods;
}
