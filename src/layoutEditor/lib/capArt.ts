/**
 * The printed design of each set's colourways, for drawing a cap the way
 * it really looks. Every colourway of a set is one picture holding all of
 * its caps in the same places, so a cap is found by its index in the set.
 */
import data from "../data/capArt.json";

export interface CapColour {
  id: string;
  name: string;
  file: string;
  /** Caps the design file has no picture of. */
  missing?: number[];
}

interface Sheet {
  width: number;
  height: number;
  /** Where each cap of the set sits in the picture: [x, y, w, h]. */
  rects: number[][];
  colours: CapColour[];
}

const SHEETS = data as unknown as Record<string, Sheet | undefined>;

/** A cap's picture: a part of a colourway's sheet. */
export interface CapArt {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
}

/** The colourways a set comes in (none when it has no design on file). */
export function coloursOf(kitId: string): CapColour[] {
  return SHEETS[kitId]?.colours ?? [];
}

/**
 * The colourway shown for a set: the chosen one, the first when nothing is
 * chosen, none when the plain drawing is asked for ("").
 */
export function shownColour(
  kitId: string,
  chosen: string | undefined,
): CapColour | null {
  const colours = coloursOf(kitId);
  if (chosen === "") return null;
  return colours.find((c) => c.id === chosen) ?? colours[0] ?? null;
}

export function capArt(
  kitId: string,
  chosen: string | undefined,
  capIndex: number,
): CapArt | null {
  const sheet = SHEETS[kitId];
  const colour = shownColour(kitId, chosen);
  const rect = sheet?.rects[capIndex];
  if (!sheet || !colour || !rect) return null;
  if (colour.missing?.includes(capIndex)) return null;
  const [x, y, w, h] = rect;
  return {
    href: `/caps/${colour.file}`,
    x,
    y,
    w,
    h,
    sheetW: sheet.width,
    sheetH: sheet.height,
  };
}
