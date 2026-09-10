/**
 * What a gallery refusal means, in words.
 *
 * Lives with the client rather than with the dialog because the same
 * refusals surface outside the dialog too -- publishing happens from the My
 * keymaps menu, and its errors land in the keymap tab's notice.
 */
import type { GalleryError } from "./client";

/** What went wrong, in words rather than a status code. */
export function galleryErrorMessage(
  error: GalleryError,
  t: (key: string, params?: Record<string, string | number>) => string,
  limit?: number,
): string {
  switch (error) {
    case "offline":
      return t("Could not reach the gallery.");
    case "not-configured":
      return t("The gallery is not set up on this server yet.");
    case "quota":
      return t("You already have {{count}} keymaps in the gallery.", {
        count: limit ?? 10,
      });
    case "unsupported-board":
      return t("The gallery is for ClickBoard ErgoTrack and GoFortyMax.");
    case "too-large":
      return t("That keymap is too big to publish.");
    case "not-a-keymap":
      return t("That keymap could not be read.");
    case "not-yours":
      return t("That keymap was published from another browser.");
    case "not-found":
      return t("That keymap is no longer in the gallery.");
    case "forbidden":
    case "unknown":
      return t("The gallery refused that.");
  }
}
