/** The layout being edited, kept in this browser so a reload carries on. */
import { readCapSetup, type CapSetup } from "./capSetup";
import type { LayoutProject } from "./model";
import { isProject } from "./project";

const STORAGE_KEY = "keebon-layout-editor-project";

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

const CAPS_KEY = "keebon-layout-editor-caps";

/** What was chosen in the keycap check, for the stored layout. */
export function loadStoredCaps(): CapSetup | null {
  try {
    const text = window.localStorage.getItem(CAPS_KEY);
    return text ? readCapSetup(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function storeCaps(caps: CapSetup): void {
  try {
    window.localStorage.setItem(CAPS_KEY, JSON.stringify(caps));
  } catch {
    // As storeProject.
  }
}
