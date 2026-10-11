/**
 * What a layout must look like to be one. Apart from the rest of the
 * project code because the gallery Worker checks posts with it too, and
 * must not pull in the editor (or the keycap sets) to do so.
 */
import type { LayoutProject } from "./model";

export const PROJECT_FORMAT = "keebon-layout";
export const PROJECT_VERSION = 1;

/** A value of the right shape to be a layout (from storage or a file). */
export function isProject(value: unknown): value is LayoutProject {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<LayoutProject>;
  return (
    typeof p.name === "string" &&
    Array.isArray(p.groups) &&
    p.groups.every(
      (g) =>
        g &&
        typeof g.id === "string" &&
        g.pivot &&
        Number.isFinite(g.pivot.x) &&
        Number.isFinite(g.pivot.y),
    ) &&
    Array.isArray(p.keys) &&
    p.keys.every(
      (k) =>
        k &&
        typeof k.id === "string" &&
        Number.isFinite(k.cx) &&
        Number.isFinite(k.cy) &&
        Number.isFinite(k.w) &&
        k.w > 0 &&
        Number.isFinite(k.h) &&
        k.h > 0 &&
        Number.isFinite(k.angle) &&
        Array.isArray(k.legends) &&
        k.legends.every((l) => typeof l === "string") &&
        (k.matrix === undefined ||
          (Number.isInteger(k.matrix.row) && Number.isInteger(k.matrix.col))),
    )
  );
}
