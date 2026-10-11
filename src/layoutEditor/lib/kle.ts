/**
 * Keyboard Layout Editor data in and out of the editor's model.
 *
 * Reading follows keyboard-layout-editor.com itself: setting rx or ry moves
 * the cursor back to the rotation origin. (@ijprest/kle-serial 0.15.1 does
 * not, so rotated clusters come out displaced; that is why this file has
 * its own reader.)
 */
import {
  LEGEND_SLOTS,
  rotatePoint,
  type KleExtras,
  type LayoutKey,
  type LayoutLayer,
  type LayoutProject,
  type RotationGroup,
} from "./model";

/** One KLE row: strings are keys, objects are property changes. */
export type KleItem = string | Record<string, unknown>;
export type KleRow = KleItem[];
/** A KLE document: rows, optionally led by a metadata object. */
export type KleDocument = Array<KleRow | Record<string, unknown>>;

export class KleFormatError extends Error {}

const DEFAULT_COLOR = "#cccccc";
const DEFAULT_TEXT_COLOR = "#000000";
const DEFAULT_ALIGN = 4;

// Serialized label index -> legend position, per alignment flag (KLE's own table).
// prettier-ignore
const LABEL_MAP: number[][] = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
];

const MATRIX_LABEL = /^\s*(\d+)\s*,\s*(\d+)\s*$/;

/** A key as KLE describes it: top left before rotation, plus the origin. */
interface RawKey {
  x: number;
  y: number;
  w: number;
  h: number;
  x2: number;
  y2: number;
  w2: number;
  h2: number;
  r: number;
  rx: number;
  ry: number;
  labels: string[];
  color: string;
  textColor: string;
  profile: string;
  decal: boolean;
  ghost: boolean;
  nub: boolean;
  stepped: boolean;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readRawKeys(doc: unknown): { name: string; keys: RawKey[] } {
  if (!Array.isArray(doc)) {
    throw new KleFormatError("expected a list of rows");
  }
  let name = "";
  const keys: RawKey[] = [];
  const cur = {
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    x2: 0,
    y2: 0,
    w2: 0,
    h2: 0,
    r: 0,
    rx: 0,
    ry: 0,
    color: DEFAULT_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    profile: "",
    decal: false,
    ghost: false,
    nub: false,
    stepped: false,
  };
  let align = DEFAULT_ALIGN;

  doc.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      if (rowIndex === 0 && row && typeof row === "object") {
        const meta = row as Record<string, unknown>;
        if (typeof meta.name === "string") name = meta.name;
        return;
      }
      throw new KleFormatError("expected a list of rows");
    }
    row.forEach((item: unknown, k: number) => {
      if (typeof item === "string") {
        const labels = new Array<string>(LEGEND_SLOTS).fill("");
        const map = LABEL_MAP[align] ?? LABEL_MAP[DEFAULT_ALIGN];
        item.split("\n").forEach((text, i) => {
          const slot = map[i];
          if (slot !== undefined && slot >= 0) labels[slot] = text;
        });
        keys.push({
          x: cur.x,
          y: cur.y,
          w: cur.w,
          h: cur.h,
          x2: cur.x2,
          y2: cur.y2,
          w2: cur.w2 === 0 ? cur.w : cur.w2,
          h2: cur.h2 === 0 ? cur.h : cur.h2,
          r: cur.r,
          rx: cur.rx,
          ry: cur.ry,
          labels,
          color: cur.color,
          textColor: cur.textColor,
          profile: cur.profile,
          decal: cur.decal,
          ghost: cur.ghost,
          nub: cur.nub,
          stepped: cur.stepped,
        });
        cur.x += cur.w;
        cur.w = 1;
        cur.h = 1;
        cur.x2 = cur.y2 = cur.w2 = cur.h2 = 0;
        cur.nub = cur.stepped = cur.decal = false;
        return;
      }
      if (!item || typeof item !== "object") {
        throw new KleFormatError("a row holds something that is not a key");
      }
      const p = item as Record<string, unknown>;
      if (k !== 0 && (p.r != null || p.rx != null || p.ry != null)) {
        throw new KleFormatError(
          "rotation can only be set on the first key of a row",
        );
      }
      const r = num(p.r);
      if (r !== undefined) cur.r = r;
      const rx = num(p.rx);
      const ry = num(p.ry);
      if (rx !== undefined) cur.rx = rx;
      if (ry !== undefined) cur.ry = ry;
      if (rx !== undefined || ry !== undefined) {
        // As keyboard-layout-editor.com does: back to the rotation origin.
        cur.x = cur.rx;
        cur.y = cur.ry;
      }
      const a = num(p.a);
      if (a !== undefined) align = a;
      if (typeof p.p === "string" && p.p) cur.profile = p.p;
      if (typeof p.c === "string" && p.c) cur.color = p.c;
      if (typeof p.t === "string" && p.t) {
        cur.textColor = p.t.split("\n")[0] || cur.textColor;
      }
      cur.x += num(p.x) ?? 0;
      cur.y += num(p.y) ?? 0;
      const w = num(p.w);
      if (w) cur.w = cur.w2 = w;
      const h = num(p.h);
      if (h) cur.h = cur.h2 = h;
      cur.x2 = num(p.x2) || cur.x2;
      cur.y2 = num(p.y2) || cur.y2;
      cur.w2 = num(p.w2) || cur.w2;
      cur.h2 = num(p.h2) || cur.h2;
      if (p.n) cur.nub = true;
      if (p.l) cur.stepped = true;
      if (p.d) cur.decal = true;
      if (p.g != null) cur.ghost = Boolean(p.g);
    });
    cur.y += 1;
    cur.x = cur.rx;
  });
  return { name, keys };
}

let idCounter = 0;
/** A fresh id for a key or a rotation group. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function round(value: number): number {
  const r = Math.round(value * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Positions as written out: four decimals, far finer than the smallest
 * grid step (0.0625u), so turning a key back into its cluster's frame does
 * not leave 0.000001 behind.
 */
function snap(value: number): number {
  const r = Math.round(value * 1e4) / 1e4;
  return Object.is(r, -0) ? 0 : r;
}

/** KLE rows (already parsed JSON) into a layout. */
export function importKle(doc: unknown): LayoutProject {
  const { name, keys: raw } = readRawKeys(doc);
  const groups: RotationGroup[] = [];
  const groupByKey = new Map<string, RotationGroup>();

  const keys = raw.map((k): LayoutKey => {
    const origin = { x: k.rx, y: k.ry };
    const centre = rotatePoint(
      { x: k.x + k.w / 2, y: k.y + k.h / 2 },
      origin,
      k.r,
    );
    let groupId: string | undefined;
    if (k.r !== 0) {
      const sig = `${k.r}|${k.rx}|${k.ry}`;
      let group = groupByKey.get(sig);
      if (!group) {
        group = { id: newId("g"), pivot: origin };
        groupByKey.set(sig, group);
        groups.push(group);
      }
      groupId = group.id;
    }

    const legends = k.labels.slice();
    let matrix: LayoutKey["matrix"];
    let option: LayoutKey["option"];
    const pos = MATRIX_LABEL.exec(legends[0]);
    if (pos && !k.decal) {
      matrix = { row: Number(pos[1]), col: Number(pos[2]) };
      legends[0] = "";
      const opt = MATRIX_LABEL.exec(legends[8]);
      if (opt) {
        option = { index: Number(opt[1]), choice: Number(opt[2]) };
        legends[8] = "";
      }
    }

    const extras: KleExtras = {};
    if (k.color !== DEFAULT_COLOR) extras.color = k.color;
    if (k.textColor !== DEFAULT_TEXT_COLOR) extras.textColor = k.textColor;
    if (k.profile) extras.profile = k.profile;
    if (k.decal) extras.decal = true;
    if (k.ghost) extras.ghost = true;
    if (k.nub) extras.nub = true;
    if (k.stepped) extras.stepped = true;
    if (k.x2 !== 0 || k.y2 !== 0 || k.w2 !== k.w || k.h2 !== k.h) {
      extras.x2 = k.x2;
      extras.y2 = k.y2;
      extras.w2 = k.w2;
      extras.h2 = k.h2;
    }

    return {
      id: newId("k"),
      cx: round(centre.x),
      cy: round(centre.y),
      w: k.w,
      h: k.h,
      angle: k.r,
      ...(groupId ? { groupId } : {}),
      legends,
      ...(matrix ? { matrix } : {}),
      ...(option ? { option } : {}),
      ...(Object.keys(extras).length > 0 ? { kle: extras } : {}),
    };
  });

  return { name, keys, groups };
}

interface Cluster {
  r: number;
  rx: number;
  ry: number;
  keys: Array<{ key: LayoutKey; x: number; y: number }>;
}

/** Group keys into KLE clusters: one r / rx / ry each. */
function clustersOf(project: LayoutProject): Cluster[] {
  const pivots = new Map(project.groups.map((g) => [g.id, g.pivot]));
  const flat: Cluster = { r: 0, rx: 0, ry: 0, keys: [] };
  const rotated = new Map<string, Cluster>();

  for (const key of project.keys) {
    if (key.angle === 0) {
      flat.keys.push({
        key,
        x: snap(key.cx - key.w / 2),
        y: snap(key.cy - key.h / 2),
      });
      continue;
    }
    // A turned key outside any group pivots on its own centre.
    const pivot = (key.groupId && pivots.get(key.groupId)) || {
      x: key.cx,
      y: key.cy,
    };
    const rx = snap(pivot.x);
    const ry = snap(pivot.y);
    const local = rotatePoint(
      { x: key.cx, y: key.cy },
      { x: rx, y: ry },
      -key.angle,
    );
    const sig = `${key.angle}|${rx}|${ry}`;
    let cluster = rotated.get(sig);
    if (!cluster) {
      cluster = { r: key.angle, rx, ry, keys: [] };
      rotated.set(sig, cluster);
    }
    cluster.keys.push({
      key,
      x: snap(local.x - key.w / 2),
      y: snap(local.y - key.h / 2),
    });
  }

  const clusters = [...rotated.values()];
  if (flat.keys.length > 0) clusters.unshift(flat);
  for (const c of clusters) {
    c.keys.sort((a, b) => a.y - b.y || a.x - b.x);
  }
  return clusters;
}

function labelsFor(key: LayoutKey, layer: LayoutLayer): string[] {
  if (layer === "legend") return key.legends;
  const labels = new Array<string>(LEGEND_SLOTS).fill("");
  if (key.kle?.decal) return key.legends;
  if (key.matrix) labels[0] = `${key.matrix.row},${key.matrix.col}`;
  if (key.option) labels[8] = `${key.option.index},${key.option.choice}`;
  return labels;
}

function labelString(labels: string[], align: number): string {
  const map = LABEL_MAP[align];
  const out = map.map((slot) => (slot >= 0 ? (labels[slot] ?? "") : ""));
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** A layout as KLE rows carrying the chosen layer's text. */
export function exportKle(
  project: LayoutProject,
  layer: LayoutLayer,
): KleDocument {
  const doc: KleDocument = [];
  if (project.name) doc.push({ name: project.name });

  const clusters = clustersOf(project);
  // The default alignment cannot place the front-left and front-right legends.
  const needsFullAlign = project.keys.some((key) => {
    const labels = labelsFor(key, layer);
    return Boolean(labels[9] || labels[11]);
  });
  const align = needsFullAlign ? 0 : DEFAULT_ALIGN;

  const cur = {
    x: 0,
    y: 0,
    r: 0,
    rx: 0,
    ry: 0,
    color: DEFAULT_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    profile: "",
    ghost: false,
    align: DEFAULT_ALIGN,
  };
  let first = true;

  for (const cluster of clusters) {
    let row: KleRow = [];
    let rowY: number | null = null;
    for (const { key, x, y } of cluster.keys) {
      const props: Record<string, unknown> = {};
      if (rowY === null || y !== rowY) {
        // A new row.
        if (row.length > 0) doc.push(row);
        row = [];
        if (!first) {
          cur.y += 1;
          cur.x = cur.rx;
        }
        if (rowY === null) {
          const changed =
            cluster.r !== cur.r ||
            cluster.rx !== cur.rx ||
            cluster.ry !== cur.ry;
          if (changed) {
            props.r = cluster.r;
            props.rx = cluster.rx;
            props.ry = cluster.ry;
            cur.r = cluster.r;
            cur.rx = cluster.rx;
            cur.ry = cluster.ry;
            cur.x = cluster.rx;
            cur.y = cluster.ry;
          }
        }
        rowY = y;
        first = false;
      }
      if (y !== cur.y) {
        props.y = snap(y - cur.y);
        cur.y = y;
      }
      if (x !== cur.x) {
        props.x = snap(x - cur.x);
        cur.x = x;
      }
      if (align !== cur.align) {
        props.a = align;
        cur.align = align;
      }
      const extras = key.kle ?? {};
      const color = extras.color ?? DEFAULT_COLOR;
      if (color !== cur.color) {
        props.c = color;
        cur.color = color;
      }
      const textColor = extras.textColor ?? DEFAULT_TEXT_COLOR;
      if (textColor !== cur.textColor) {
        props.t = textColor;
        cur.textColor = textColor;
      }
      const profile = extras.profile ?? "";
      if (profile !== cur.profile && profile) {
        props.p = profile;
        cur.profile = profile;
      }
      const ghost = Boolean(extras.ghost);
      if (ghost !== cur.ghost) {
        props.g = ghost;
        cur.ghost = ghost;
      }
      if (key.w !== 1) props.w = key.w;
      if (key.h !== 1) props.h = key.h;
      if (extras.w2 !== undefined && extras.h2 !== undefined) {
        if (extras.x2) props.x2 = extras.x2;
        if (extras.y2) props.y2 = extras.y2;
        if (extras.w2 !== key.w) props.w2 = extras.w2;
        if (extras.h2 !== key.h) props.h2 = extras.h2;
      }
      if (extras.nub) props.n = true;
      if (extras.stepped) props.l = true;
      if (extras.decal) props.d = true;

      if (Object.keys(props).length > 0) row.push(props);
      row.push(labelString(labelsFor(key, layer), align));
      cur.x = snap(cur.x + key.w);
    }
    if (row.length > 0) doc.push(row);
  }
  return doc;
}

/** Quote the bare property names of KLE's "Raw data" so JSON.parse reads it. */
function relaxedToJson(src: string): string {
  let out = "";
  let i = 0;
  const bareKey = /[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/y;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\") j += 1;
        j += 1;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    bareKey.lastIndex = i;
    const m = bareKey.exec(src);
    if (m) {
      out += `"${m[0]}"`;
      i += m[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Text someone pasted or a file they chose into KLE rows. Accepts KLE's
 * downloaded JSON, its "Raw data" box, and a VIA definition or vial.json
 * (whose layouts.keymap is KLE rows).
 */
export function parseKleText(text: string): KleDocument {
  const trimmed = text.trim();
  if (!trimmed) throw new KleFormatError("nothing to read");
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    const body = trimmed.replace(/,\s*$/, "");
    try {
      value = JSON.parse(relaxedToJson(`[${body}]`));
    } catch {
      throw new KleFormatError("not KLE data");
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const layouts = (value as { layouts?: { keymap?: unknown } }).layouts;
    value = layouts?.keymap;
  }
  if (!Array.isArray(value)) throw new KleFormatError("not KLE data");
  // A single row pasted on its own: [ "A", "B" ].
  if (value.length > 0 && value.every((v) => !Array.isArray(v))) {
    const looksLikeRow = value.some((v) => typeof v === "string");
    if (looksLikeRow) value = [value];
  }
  return value as KleDocument;
}

/** KLE rows as the "Raw data" box shows them: bare property names, a row a line. */
export function kleToRawData(doc: KleDocument): string {
  const item = (v: KleItem): string =>
    typeof v === "string"
      ? JSON.stringify(v)
      : `{${Object.entries(v)
          .map(([k, val]) => `${k}:${JSON.stringify(val)}`)
          .join(",")}}`;
  return doc
    .map((row) =>
      Array.isArray(row) ? `[${row.map(item).join(",")}]` : item(row),
    )
    .join(",\n");
}
