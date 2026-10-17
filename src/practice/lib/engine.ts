/**
 * One run of typing practice: where in the text the person is, what they
 * have typed, and what each key press did.
 *
 * Pure functions over a `Run`, so the page is only a thin shell and the
 * behaviour (SPEC §6.1, §6.2) can be tested without a browser:
 *
 * - Each unit of the text accepts several spellings; a press is right when
 *   it extends at least one spelling that fits what was typed so far.
 * - A spelling that is complete and that the press does not extend ends
 *   the unit, and the press is applied to the next one (ん typed as a
 *   single n before "ka").
 * - "stop" mode holds the position on a wrong press; "advance" mode counts
 *   it and moves on to the next unit.
 * - A unit none of whose spellings can be typed on the keymap is skipped
 *   and recorded as unavailable, in either mode.
 */
import { tokenize, type RomajiUnit } from "./romaji";

export type StopMode = "stop" | "advance";

export interface Press {
  unit: number;
  /** The character the text wanted. */
  expected: string;
  /** The character that came. */
  got: string;
  ok: boolean;
  time: number;
}

export interface Skipped {
  unit: number;
  text: string;
  /** The characters no key types, the reason it was skipped. */
  chars: string[];
}

export interface Run {
  units: RomajiUnit[];
  /** The unit being typed; `units.length` once the text is done. */
  index: number;
  /** What has been typed of the current unit. */
  prefix: string;
  /** Spellings of the current unit still possible (typeable, fit the prefix). */
  live: string[];
  /** The typed spelling of each finished unit, in order. */
  done: string[];
  presses: Press[];
  skipped: Skipped[];
  /** Units that had a wrong press (shown as misses in "advance" mode). */
  wrong: Set<number>;
  startedAt: number | null;
  finishedAt: number | null;
}

export type Typeable = (ch: string) => boolean;

function typeableAlt(alt: string, typeable: Typeable): boolean {
  for (const c of alt) if (!typeable(c)) return false;
  return true;
}

/**
 * Enter unit `index`: skip every unit no spelling of which can be typed,
 * and close the run at the end of the text.
 */
function enter(run: Run, index: number, typeable: Typeable, now: number): Run {
  let i = index;
  const skipped = [...run.skipped];
  const done = [...run.done];
  while (i < run.units.length) {
    const unit = run.units[i];
    const live = unit.alts.filter((a) => typeableAlt(a, typeable));
    if (live.length) {
      return { ...run, index: i, prefix: "", live, skipped, done };
    }
    const chars = [...new Set([...unit.alts[0]].filter((c) => !typeable(c)))];
    skipped.push({ unit: i, text: unit.text, chars });
    done.push("");
    i++;
  }
  return {
    ...run,
    index: i,
    prefix: "",
    live: [],
    skipped,
    done,
    finishedAt: run.finishedAt ?? now,
  };
}

/** A run over `text`, positioned on its first typeable unit. */
export function startRun(text: string, typeable: Typeable, now: number): Run {
  const run: Run = {
    units: tokenize(text),
    index: 0,
    prefix: "",
    live: [],
    done: [],
    presses: [],
    skipped: [],
    wrong: new Set(),
    startedAt: null,
    finishedAt: null,
  };
  const entered = enter(run, 0, typeable, now);
  // A text with nothing typeable is over before it starts, which is fine.
  return entered.index >= entered.units.length
    ? { ...entered, finishedAt: null }
    : entered;
}

export function isDone(run: Run): boolean {
  return run.index >= run.units.length;
}

/** The character the text wants next, or null when the run is over. */
export function expected(run: Run): string | null {
  if (isDone(run)) return null;
  const alt = run.live.find((a) => a.length > run.prefix.length) ?? run.live[0];
  return alt ? (alt[run.prefix.length] ?? null) : null;
}

export type PressResult = "ok" | "miss" | "ignored";

/**
 * Apply a typed character. The run is returned unchanged with "ignored"
 * when it is over.
 */
export function press(
  run: Run,
  ch: string,
  mode: StopMode,
  typeable: Typeable,
  now: number,
): { run: Run; result: PressResult } {
  if (isDone(run)) return { run, result: "ignored" };
  const startedAt = run.startedAt ?? now;
  const next = run.prefix + ch;
  const extended = run.live.filter((a) => a.startsWith(next));

  if (extended.length) {
    const presses = [...run.presses, press_(run, ch, ch, true, now)];
    if (extended.some((a) => a === next)) {
      // The unit is complete; a longer spelling it is also a prefix of
      // ("n" of "nn") stays open only until the next press settles it.
      const longer = extended.filter((a) => a.length > next.length);
      if (longer.length === 0) {
        return {
          run: enter(
            { ...run, presses, startedAt, done: [...run.done, next] },
            run.index + 1,
            typeable,
            now,
          ),
          result: "ok",
        };
      }
      return {
        run: { ...run, presses, startedAt, prefix: next, live: extended },
        result: "ok",
      };
    }
    return {
      run: { ...run, presses, startedAt, prefix: next, live: extended },
      result: "ok",
    };
  }

  // Not an extension. If what is typed already completes a spelling, the
  // unit is done and this press belongs to the next unit.
  if (run.live.some((a) => a === run.prefix) && run.prefix.length > 0) {
    const moved = enter(
      { ...run, startedAt, done: [...run.done, run.prefix] },
      run.index + 1,
      typeable,
      now,
    );
    if (isDone(moved)) {
      // Nothing left to type; the stray press is not a miss of anything.
      return { run: moved, result: "ignored" };
    }
    return press(moved, ch, mode, typeable, now);
  }

  const want = expected(run) ?? "";
  const presses = [...run.presses, press_(run, want, ch, false, now)];
  const wrong = new Set(run.wrong).add(run.index);
  if (mode === "stop") {
    return { run: { ...run, presses, wrong, startedAt }, result: "miss" };
  }
  // Advance: the rest of the unit is taken as typed, by its shown spelling.
  const shown = run.live.find((a) => a.startsWith(run.prefix)) ?? run.live[0];
  return {
    run: enter(
      { ...run, presses, wrong, startedAt, done: [...run.done, shown] },
      run.index + 1,
      typeable,
      now,
    ),
    result: "miss",
  };
}

function press_(
  run: Run,
  expected: string,
  got: string,
  ok: boolean,
  time: number,
): Press {
  return { unit: run.index, expected, got, ok, time };
}

/**
 * The romaji line as shown: what was typed, what the current unit still
 * needs by the spelling that fits so far, and the rest by their preferred
 * spellings.
 */
export function romajiLine(run: Run): {
  typed: string;
  current: string;
  rest: string;
} {
  const typed = run.done.join("") + run.prefix;
  if (isDone(run)) return { typed, current: "", rest: "" };
  const alt =
    run.live.find((a) => a.startsWith(run.prefix)) ?? run.live[0] ?? "";
  const current = alt.slice(run.prefix.length);
  const rest = run.units
    .slice(run.index + 1)
    .map((u) => u.alts[0] ?? "")
    .join("");
  return { typed, current, rest };
}

/** Index of the unit each character of the romaji line belongs to. */
export function unitOfTyped(run: Run): number[] {
  const out: number[] = [];
  run.done.forEach((d, i) => {
    for (let k = 0; k < d.length; k++) out.push(i);
  });
  for (let k = 0; k < run.prefix.length; k++) out.push(run.index);
  return out;
}
