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
import { isEmptySetup, readCapSetup, type CapSetup } from "./capSetup";
import type { LayoutLayer, LayoutProject } from "./model";
import { PROJECT_FORMAT, PROJECT_VERSION, isProject } from "./projectShape";

export { PROJECT_FORMAT, PROJECT_VERSION, isProject } from "./projectShape";

export function projectFileText(
  project: LayoutProject,
  caps?: CapSetup | null,
): string {
  return JSON.stringify(
    {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project,
      // What was chosen in the keycap check, when anything was.
      ...(caps && !isEmptySetup(caps) ? { caps } : {}),
    },
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

/** The keycap setup a project file carries, or null (any other text too). */
export function readCapSetupText(text: string): CapSetup | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const file = value as { format?: unknown; caps?: unknown };
    return file.format === PROJECT_FORMAT ? readCapSetup(file.caps) : null;
  } catch {
    return null;
  }
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
  caps?: CapSetup | null,
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
        text: projectFileText(project, caps),
        fileName: `${name}.keebon-layout.json`,
        mime: "application/json",
      };
  }
}
