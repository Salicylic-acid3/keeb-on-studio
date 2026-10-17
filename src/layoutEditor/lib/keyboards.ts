/**
 * The keyboards this app is for, as layouts to start from.
 *
 * The QMK (Vial) ones come from each keyboard's vial.json, collected by
 * scripts/fetchLayoutTemplates.py, and carry their matrix positions. Where
 * a keyboard has layout options, the first choice of each is shown. The
 * ZMK ones are the physical layouts the demo mode draws. Each opens with
 * the legends of its default keymap's base layer.
 */
import { ERGOTRACK, GOFORTY_MAX } from "../../lib/layouts";
import data from "../data/keyboards.json";
import { importKle, type KleDocument } from "./kle";
import { makeIsoEnter, setMainAndSub } from "./edit";
import { qmkLegend, zmkLegend } from "./firmwareLabels";
import type { KeyLabel, LabelLayout } from "./keyLabels";
import type { LayoutKey, LayoutProject } from "./model";

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

const DATA = data as unknown as {
  qmk: Array<{
    id: string;
    name: string;
    keymap: KleDocument;
    /** Layer 0 of the default keymap: keycode names by "row,col". */
    keycodes: Record<string, string>;
    /** Layers 1 and up, the same way. */
    layers?: Array<Record<string, string>>;
  }>;
  /** The base layer's bindings of each ZMK keyboard, in key order. */
  zmk: Record<string, string[] | undefined>;
  /** Layers 1 and up of each ZMK keyboard, the same way. */
  zmkLayers?: Record<string, string[][] | undefined>;
};
const QMK = DATA.qmk;

/** Legends of a JIS board are the JIS ones (2 is under ", not @). */
function layoutOf(id: string): LabelLayout {
  return /jp$/.test(id) ? "jis" : "us";
}

function withLegends(
  project: LayoutProject,
  legendOf: (key: LayoutKey, index: number) => KeyLabel | undefined,
): LayoutProject {
  return project.keys.reduce((next, key, index) => {
    const legend = legendOf(key, index);
    return legend?.main
      ? setMainAndSub(next, key.id, legend.main, legend.sub ?? "")
      : next;
  }, project);
}

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

/**
 * The InSixty JP's vial.json draws its Enter (matrix 7,7) as a 1.25u key
 * on the home row, overlapping the key beside it. On the board it is an
 * ISO Enter spanning the two rows at the right edge, so it is drawn as
 * one here.
 */
function insixtyJpEnter(keys: LayoutKey[]): LayoutKey[] {
  const enter = keys.find((k) => k.matrix?.row === 7 && k.matrix.col === 7);
  if (!enter) return keys;
  const made = makeIsoEnter({ name: "", keys, groups: [] }, [enter.id]).keys;
  // Its body takes the last 1.25u of the two rows (x 14.75 to 16, y 1 to 3).
  return made.map((k) => (k.id === enter.id ? { ...k, cx: 15.375, cy: 2 } : k));
}

/**
 * A keyboard's drawing (no legends yet) and, for each of its keys in the
 * same order, the binding of its default keymap's base layer: a QMK keycode
 * ("KC_A", "LT(1, KC_SPC)") or a ZMK binding without its "&" ("kp A").
 * The key test reads the bindings to know which key a press belongs to.
 */
export interface KeyboardBindings {
  project: LayoutProject;
  bindings: Array<string | undefined>;
  /** The same for layer 1 and up, where the keymap has them. */
  layers: Array<Array<string | undefined>>;
  firmware: "zmk" | "qmk";
  layout: LabelLayout;
}

export function keyboardBindings(id: string): KeyboardBindings | null {
  const zmk = ZMK[id];
  if (zmk) {
    const project = { ...importKle(zmkToKle(zmk)), name: zmk.name };
    const bindings = DATA.zmk[id] ?? [];
    const layers = DATA.zmkLayers?.[id] ?? [];
    return {
      project,
      bindings: project.keys.map((_k, index) => bindings[index]),
      layers: layers.map((layer) =>
        project.keys.map((_k, index) => layer[index]),
      ),
      firmware: "zmk",
      layout: "us",
    };
  }
  const board = QMK.find((b) => b.id === id);
  if (!board) return null;
  const imported = importKle(board.keymap);
  // Only the first choice of each layout option; the others are drawn
  // elsewhere in the file as alternatives.
  const shown = imported.keys.filter((k) => !k.option || k.option.choice === 0);
  const keys = board.id === "insixty_jp" ? insixtyJpEnter(shown) : shown;
  const used = new Set(keys.map((k) => k.groupId));
  // One key the drawing and the keymap place differently (the GoForty JP's
  // Enter is 1,11 in vial.json and 0,11 in keyboard.json): when a single
  // key has no keycode and a single keycode has no key, they are the pair.
  const positions = new Set(
    keys.flatMap((k) => (k.matrix ? [`${k.matrix.row},${k.matrix.col}`] : [])),
  );
  const unnamed = [...positions].filter((at) => !(at in board.keycodes));
  const unused = Object.keys(board.keycodes).filter((at) => !positions.has(at));
  const stray = unnamed.length === 1 && unused.length === 1 ? unnamed[0] : null;
  const codesOf = (layer: Record<string, string>) =>
    keys.map((key) => {
      if (!key.matrix) return undefined;
      const at = `${key.matrix.row},${key.matrix.col}`;
      return layer[at] ?? (at === stray ? layer[unused[0]] : undefined);
    });
  return {
    project: {
      name: board.name,
      keys,
      groups: imported.groups.filter((g) => used.has(g.id)),
    },
    bindings: codesOf(board.keycodes),
    layers: (board.layers ?? []).map(codesOf),
    firmware: "qmk",
    layout: layoutOf(board.id),
  };
}

/** Which firmware a keyboard of {@link keyboardTemplates} runs. */
export function keyboardFirmware(id: string): "zmk" | "qmk" | null {
  if (ZMK[id]) return "zmk";
  return QMK.some((b) => b.id === id) ? "qmk" : null;
}

export function keyboardProject(id: string): LayoutProject | null {
  const found = keyboardBindings(id);
  if (!found) return null;
  const { project, bindings, firmware, layout } = found;
  const legendOf = firmware === "zmk" ? zmkLegend : qmkLegend;
  return withLegends(project, (_key, index) => {
    const binding = bindings[index];
    return binding ? legendOf(binding, layout) : undefined;
  });
}
