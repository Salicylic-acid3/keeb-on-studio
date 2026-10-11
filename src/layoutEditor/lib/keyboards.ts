/**
 * The keyboards this app is for, as layouts to start from.
 *
 * The QMK (Vial) ones come from each keyboard's vial.json, collected by
 * scripts/fetchLayoutTemplates.py, and carry their matrix positions. Where
 * a keyboard has layout options, the first choice of each is shown. The
 * ZMK ones are the physical layouts the demo mode draws.
 */
import { ERGOTRACK, GOFORTY_MAX } from "../../lib/layouts";
import qmk from "../data/keyboards.json";
import { importKle, type KleDocument } from "./kle";
import type { LayoutProject } from "./model";

export interface KeyboardTemplate {
  id: string;
  name: string;
}

interface ZmkLayout {
  name: string;
  keys: Array<{
    width: number;
    height: number;
    x: number;
    y: number;
    r?: number;
    rx?: number;
    ry?: number;
  }>;
}

const QMK = qmk as Array<{ id: string; name: string; keymap: KleDocument }>;

/**
 * The ErgoTrack's physical layout is rounded to 1/100 u, which leaves a few
 * neighbours overlapping by a hair (the fourth row on the left, and the
 * turned thumb keys against the keys beside them). As a layout to edit
 * that would show them as clashing, so those keys are moved apart by a few
 * hundredths here; the firmware's own layout is left as it is. Keyed by
 * the key's "x,y" in that layout: [dx, dy].
 */
const ERGOTRACK_TIDY: Record<string, [number, number]> = {
  "0,337": [0, 1],
  "125,337": [0, 1],
  "338,425": [-4, 0],
  "448,441": [-3, 0],
  "551,484": [-2, 0],
  "1275,484": [4, 0],
  "1379,442": [4, 0],
  "1488,425": [6, 0],
};

function tidied(layout: ZmkLayout, moves: typeof ERGOTRACK_TIDY): ZmkLayout {
  return {
    ...layout,
    keys: layout.keys.map((k) => {
      const move = moves[`${k.x},${k.y}`];
      if (!move) return k;
      const [dx, dy] = move;
      return {
        ...k,
        x: k.x + dx,
        y: k.y + dy,
        // A turned key keeps turning about its own centre.
        ...(k.rx !== undefined ? { rx: k.rx + dx } : {}),
        ...(k.ry !== undefined ? { ry: k.ry + dy } : {}),
      };
    }),
  };
}

const ZMK: Record<string, ZmkLayout> = {
  clickboard_ergotrack: tidied(ERGOTRACK, ERGOTRACK_TIDY),
  goforty_max_ortho: GOFORTY_MAX,
};

/** Every keyboard, by name. */
export function keyboardTemplates(): KeyboardTemplate[] {
  return [
    ...Object.entries(ZMK).map(([id, layout]) => ({ id, name: layout.name })),
    ...QMK.map(({ id, name }) => ({ id, name })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** A ZMK physical layout (1/100 u, 1/100 degree) as a KLE document. */
function zmkToKle(layout: ZmkLayout): KleDocument {
  return layout.keys.map((k) => {
    const rx = (k.rx ?? 0) / 100;
    const ry = (k.ry ?? 0) / 100;
    return [
      {
        r: (k.r ?? 0) / 100,
        rx,
        ry,
        x: k.x / 100 - rx,
        y: k.y / 100 - ry,
        w: k.width / 100,
        h: k.height / 100,
      },
      "",
    ];
  });
}

export function keyboardProject(id: string): LayoutProject | null {
  const zmk = ZMK[id];
  if (zmk) return { ...importKle(zmkToKle(zmk)), name: zmk.name };
  const board = QMK.find((b) => b.id === id);
  if (!board) return null;
  const project = importKle(board.keymap);
  // Only the first choice of each layout option; the others are drawn
  // elsewhere in the file as alternatives.
  const keys = project.keys.filter((k) => !k.option || k.option.choice === 0);
  const used = new Set(keys.map((k) => k.groupId));
  return {
    name: board.name,
    keys,
    groups: project.groups.filter((g) => used.has(g.id)),
  };
}
