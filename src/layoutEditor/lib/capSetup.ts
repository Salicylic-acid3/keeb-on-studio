/**
 * What was chosen in the keycap check, kept with the layout so a reload,
 * a project file or another device carries on with the same caps: the
 * switches, the sets and their colourways, the sculpt row of each line,
 * and the caps put on keys by hand.
 */
import type { KitChoice } from "./fit";
import { SWITCH_TYPES, kitById, type SwitchType } from "./kits";

export interface CapSetup {
  switchType: SwitchType | null;
  sets: KitChoice[];
  /** Colourway per set ("" = the plain drawing). */
  colours: Record<string, string>;
  /** Sculpt row per line of the layout, where it was changed. */
  rows: Record<number, string>;
  /** [key id, cap id or null for a key kept bare]. */
  pins: Array<[string, string | null]>;
}

export const EMPTY_CAP_SETUP: CapSetup = {
  switchType: null,
  sets: [],
  colours: {},
  rows: {},
  pins: [],
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * A setup out of storage or a file, keeping only what is still valid (a
 * set this app no longer has is dropped). Null when it is not a setup.
 */
export function readCapSetup(value: unknown): CapSetup | null {
  if (!isRecord(value)) return null;
  const switchType = SWITCH_TYPES.includes(value.switchType as SwitchType)
    ? (value.switchType as SwitchType)
    : null;
  const sets: KitChoice[] = [];
  if (Array.isArray(value.sets)) {
    for (const s of value.sets) {
      if (!isRecord(s) || typeof s.kitId !== "string") continue;
      const count = Number(s.count);
      if (!kitById(s.kitId) || !Number.isInteger(count)) continue;
      if (count < 1 || count > 9) continue;
      if (sets.some((x) => x.kitId === s.kitId)) continue;
      sets.push({ kitId: s.kitId, count });
    }
  }
  const colours: Record<string, string> = {};
  if (isRecord(value.colours)) {
    for (const [kitId, colour] of Object.entries(value.colours)) {
      if (kitById(kitId) && typeof colour === "string") colours[kitId] = colour;
    }
  }
  const rows: Record<number, string> = {};
  if (isRecord(value.rows)) {
    for (const [index, row] of Object.entries(value.rows)) {
      if (/^\d+$/.test(index) && typeof row === "string" && /^R\d$/.test(row))
        rows[Number(index)] = row;
    }
  }
  const pins: Array<[string, string | null]> = [];
  if (Array.isArray(value.pins)) {
    for (const p of value.pins) {
      if (!Array.isArray(p) || typeof p[0] !== "string") continue;
      if (p[1] !== null && typeof p[1] !== "string") continue;
      pins.push([p[0], p[1]]);
    }
  }
  return { switchType, sets, colours, rows, pins };
}

export function isEmptySetup(setup: CapSetup): boolean {
  return setup.switchType === null && setup.sets.length === 0;
}
