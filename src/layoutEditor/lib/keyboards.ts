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

const ZMK: Record<string, ZmkLayout> = {
  clickboard_ergotrack: ERGOTRACK,
  goforty_max_ortho: GOFORTY_MAX,
};

const QMK = qmk as Array<{ id: string; name: string; keymap: KleDocument }>;

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
