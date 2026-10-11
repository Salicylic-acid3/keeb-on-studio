/** A small layout with two turned thumb clusters, to start from. */
import { importKle, type KleDocument } from "./kle";
import type { LayoutProject } from "./model";

// prettier-ignore
const SAMPLE: KleDocument = [
  ["Esc", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "BS"],
  [{ w: 1.25 }, "Tab", "A", "S", "D", "F", "G", "H", "J", "K", "L", { w: 1.75 }, "Enter"],
  [{ w: 1.75 }, "Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", { w: 1.25 }, "Shift"],
  [{ r: 10, rx: 5.75, ry: 3.6, x: -2.75, w: 1.25 }, "Alt", { w: 1.5 }, "Space"],
  [{ r: -10, rx: 6.25, ry: 3.6, w: 1.5 }, "Space", { w: 1.25 }, "Fn"],
];

export function sampleProject(): LayoutProject {
  return importKle(SAMPLE);
}
