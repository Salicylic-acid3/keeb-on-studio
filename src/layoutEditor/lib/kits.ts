/**
 * Keycap sets as the editor understands them, read straight out of each
 * set's Keyboard Layout Editor file (the same files the product pages
 * show), so a set changes here when its KLE file is replaced.
 *
 * What is read off each cap:
 *  - size: the KLE width and height; a stepped cap (Caps Lock) counts as its
 *    full footprint; the stepped Enter is its own shape.
 *  - row: on sets whose rows are sculpted differently, the "R4" / "R3" ...
 *    label standing at the left of the cap's row in the file.
 *  - legend: the texts on the top of the cap. The texts on the front are
 *    the file's own size notes ("1.75", "1.25c") and are not legends; a
 *    trailing "c" marks a convex cap, which is how every convex cap in
 *    these files is told from a plain one.
 */
import clickprofile from "../data/kits/clickprofile.json";
import goforty from "../data/kits/goforty.json";
import lowprofile from "../data/kits/lowprofile.json";
import premium from "../data/kits/premium.json";
import standard from "../data/kits/standard.json";
import { importKle } from "./kle";
import type { LayoutKey } from "./model";

export interface Cap {
  /** Index of the cap within its set. */
  index: number;
  /** Footprint in u. */
  w: number;
  h: number;
  shape: "plain" | "iso";
  /** Sculpt row ("R1" ... "R4"); undefined when the set has none or the cap fits any. */
  row?: string;
  main: string;
  sub: string;
  /** Nothing printed on top. */
  blank: boolean;
  convex: boolean;
  /** Homing bump (F, J). */
  nub: boolean;
  /** Cap and legend colours from the KLE file, for drawing it. */
  color?: string;
  textColor?: string;
}

/** The switches a keyboard is built with, which decide the caps that go on. */
export type SwitchType = "mx" | "lowprofile" | "click";

export const SWITCH_TYPES: SwitchType[] = ["mx", "lowprofile", "click"];

export interface Kit {
  id: string;
  name: string;
  /** The switches this set's caps go on. */
  switches: SwitchType[];
  /** Rows are sculpted differently, so a cap only fits its own row. */
  sculpted: boolean;
  caps: Cap[];
}

const ROW_LABEL = /^R(\d)/;

function topOf(key: LayoutKey): number {
  return key.cy - key.h / 2;
}

/** Legend texts on the top of a KLE key: [main, shifted]. */
function topLegends(key: LayoutKey): { main: string; sub: string } {
  const top = key.legends.slice(0, 9).map((s) => s.trim());
  if (top[6] && top[0]) return { main: top[6], sub: top[0] };
  return { main: top.find(Boolean) ?? "", sub: "" };
}

/** Caps of a set from its KLE document. */
export function capsFromKle(doc: unknown, sculpted: boolean): Cap[] {
  const { keys } = importKle(doc);
  const rowLabels = keys.filter(
    (k) => k.kle?.decal && ROW_LABEL.test(k.legends.find(Boolean) ?? ""),
  );
  const caps: Cap[] = [];
  for (const key of keys) {
    if (key.kle?.decal) continue;
    const kle = key.kle ?? {};
    const iso = key.h === 2 && (kle.x2 ?? 0) < 0;
    // A stepped cap covers its second rectangle's width.
    const w =
      !iso && kle.w2 !== undefined && kle.h2 === key.h
        ? Math.max(key.w, kle.w2)
        : key.w;

    let row: string | undefined;
    if (sculpted && !iso) {
      // The row label to the left whose 1u band this cap starts in.
      let best: LayoutKey | undefined;
      for (const label of rowLabels) {
        if (label.cx >= key.cx) continue;
        if (Math.abs(topOf(label) - topOf(key)) > 0.01) continue;
        if (!best || label.cx > best.cx) best = label;
      }
      const m = best && ROW_LABEL.exec(best.legends.find(Boolean) ?? "");
      if (m) row = `R${m[1]}`;
    }

    const { main, sub } = topLegends(key);
    const front = key.legends.slice(9, 12).join("");
    caps.push({
      index: caps.length,
      w,
      h: key.h,
      shape: iso ? "iso" : "plain",
      ...(row ? { row } : {}),
      main,
      sub,
      blank: !main && !sub,
      convex: /c\s*$/i.test(front),
      nub: Boolean(kle.nub),
      ...(kle.color ? { color: kle.color } : {}),
      ...(kle.textColor ? { textColor: kle.textColor } : {}),
    });
  }
  if (sculpted) inheritRows(caps, keys);
  return caps;
}

/**
 * A row of caps with no label of its own, sitting directly under labelled
 * caps (the second line of a group in the file), takes the row of the cap
 * above it.
 */
function inheritRows(caps: Cap[], keys: LayoutKey[]): void {
  const solid = keys.filter((k) => !k.kle?.decal);
  let changed = true;
  while (changed) {
    changed = false;
    caps.forEach((cap, i) => {
      if (cap.row || cap.shape === "iso") return;
      const key = solid[i];
      const above = solid.findIndex((other, j) => {
        if (!caps[j].row) return false;
        const touches =
          Math.abs(other.cy + other.h / 2 - (key.cy - key.h / 2)) < 0.01;
        const overlaps =
          Math.min(other.cx + other.w / 2, key.cx + key.w / 2) -
            Math.max(other.cx - other.w / 2, key.cx - key.w / 2) >
          0.01;
        return touches && overlaps;
      });
      if (above >= 0) {
        cap.row = caps[above].row;
        changed = true;
      }
    });
  }
}

function kit(
  id: string,
  name: string,
  switches: SwitchType[],
  sculpted: boolean,
  doc: unknown,
): Kit {
  return { id, name, switches, sculpted, caps: capsFromKle(doc, sculpted) };
}

let cache: Kit[] | null = null;

/** Every set the editor knows, parsed once. */
export function allKits(): Kit[] {
  cache ??= [
    kit("standard", "Acid Caps Standard", ["mx"], true, standard),
    kit("premium", "Acid Caps Premium", ["mx"], true, premium),
    kit(
      "lowprofile",
      "Acid Caps LowProfile",
      ["mx", "lowprofile"],
      false,
      lowprofile,
    ),
    kit("goforty", "GoForty Caps", ["mx", "lowprofile"], false, goforty),
    kit(
      "clickprofile",
      "Acid Caps ClickProfile",
      ["click"],
      false,
      clickprofile,
    ),
  ];
  return cache;
}

/** The sets whose caps go on the given switches. */
export function kitsFor(switchType: SwitchType): Kit[] {
  return allKits().filter((k) => k.switches.includes(switchType));
}

export function kitById(id: string): Kit | undefined {
  return allKits().find((k) => k.id === id);
}
