/**
 * Articles linked from the splash screen's guide.
 *
 * Kept as data so a new article is one line here, not a component change.
 * An entry with `href: null` is shown but not linked, marked "coming soon":
 * that is for an article that is being written, so the splash can already
 * say it exists without pointing at a URL that does not.
 */

export interface GuideArticle {
  /** English label; a translation key. */
  label: string;
  /** English one-liner under the label; a translation key. */
  description: string;
  /** Where it lives. `null` while it is still being written. */
  href: string | null;
}

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    label: "How to use Keeb-On! Studio",
    description:
      "Connecting, editing the keymap, saving, and what each tab is for.",
    href: null,
  },
  {
    label: "How layers work",
    description:
      "What a layer is, why a small keyboard needs them, and how to hold and switch them.",
    href: null,
  },
];

export const DISCORD_URL = "https://discord.gg/y5CNqgEsNg";
