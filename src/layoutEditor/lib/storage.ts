/** The layout being edited, kept in this browser so a reload carries on. */
import type { LayoutProject } from "./model";

const STORAGE_KEY = "keebon-layout-editor-project";

function isProject(value: unknown): value is LayoutProject {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<LayoutProject>;
  return (
    typeof p.name === "string" &&
    Array.isArray(p.groups) &&
    Array.isArray(p.keys) &&
    p.keys.every(
      (k) =>
        k &&
        typeof k.id === "string" &&
        Number.isFinite(k.cx) &&
        Number.isFinite(k.cy) &&
        Number.isFinite(k.w) &&
        Number.isFinite(k.h) &&
        Number.isFinite(k.angle) &&
        Array.isArray(k.legends),
    )
  );
}

export function loadStoredProject(): LayoutProject | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const value: unknown = JSON.parse(text);
    return isProject(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeProject(project: LayoutProject): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Private windows and full storage: the editor still works, unsaved.
  }
}
