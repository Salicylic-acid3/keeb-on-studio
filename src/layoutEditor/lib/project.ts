/**
 * Layouts as files: the editor's own project file, which keeps everything
 * (legends, matrix positions, rotation pivots), and the text of each export.
 */
import {
  exportKle,
  importKle,
  kleToRawData,
  parseKleText,
  type KleDocument,
} from "./kle";
import type { LayoutLayer, LayoutProject } from "./model";

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

export function projectFileText(project: LayoutProject): string {
  return JSON.stringify(
    { format: PROJECT_FORMAT, version: PROJECT_VERSION, project },
    null,
    1,
  );
}

/**
 * Whatever someone pasted or chose as a file, as a layout: a project file,
 * KLE data (downloaded JSON or the Raw data box), or a VIA definition or
 * vial.json. Throws when it is none of these.
 */
export function readLayoutText(text: string): LayoutProject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const file = value as { format?: unknown; project?: unknown };
    if (file.format === PROJECT_FORMAT) {
      if (!isProject(file.project)) throw new Error("damaged project file");
      return file.project;
    }
  }
  return importKle(parseKleText(text));
}

/** KLE rows as JSON with a row to a line, the way KLE's own files read. */
export function rowsToJson(doc: KleDocument): string {
  if (doc.length === 0) return "[]";
  return `[\n${doc.map((row) => `  ${JSON.stringify(row)}`).join(",\n")}\n]`;
}

export type ExportFormat = "kle-json" | "kle-raw" | "via" | "vial" | "project";

export interface ExportText {
  text: string;
  /** File name to download it under. */
  fileName: string;
  mime: string;
}

function safeName(name: string): string {
  return (name.trim() || "layout").replace(/[^\p{L}\p{N}._-]+/gu, "_");
}

/** The text of an export. VIA and Vial always carry matrix positions. */
export function exportText(
  project: LayoutProject,
  format: ExportFormat,
  layer: LayoutLayer,
): ExportText {
  const name = safeName(project.name);
  switch (format) {
    case "kle-json":
      return {
        text: rowsToJson(exportKle(project, layer)),
        fileName: `${name}-${layer}.json`,
        mime: "application/json",
      };
    case "kle-raw":
      return {
        text: kleToRawData(exportKle(project, layer)),
        fileName: `${name}-${layer}.txt`,
        mime: "text/plain",
      };
    case "via":
    case "vial":
      // layouts.keymap is rows only: no KLE metadata object in front.
      return {
        text: rowsToJson(exportKle({ ...project, name: "" }, "matrix")),
        fileName: `${name}-${format}-keymap.json`,
        mime: "application/json",
      };
    case "project":
      return {
        text: projectFileText(project),
        fileName: `${name}.keebon-layout.json`,
        mime: "application/json",
      };
  }
}
