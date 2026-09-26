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
  /** Where it lives. `null` while it is still being written. */
  href: string | null;
}

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    label: "How to use Keeb-On! Studio",
    href: "https://salicylic-acid3.hatenablog.com/entry/keebon-studio-manual",
  },
  {
    label: "How layers work",
    // The existing article; the author plans to rewrite it, so swap the URL
    // here when the new one is up.
    href: "https://salicylic-acid3.hatenablog.com/entry/layer-introduction",
  },
  {
    label: "A keymap guide for 30% keyboards",
    href: "https://salicylic-acid3.hatenablog.com/entry/be30ortho-keymap-guide",
  },
];

export const DISCORD_URL = "https://discord.gg/y5CNqgEsNg";
