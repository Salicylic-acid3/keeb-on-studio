/**
 * Renders design/og-image.html to public/og-image.png at 1200x630.
 *
 *   node design/render-og-image.mjs
 *
 * Needs Playwright's Chromium. The banner is checked in as a PNG because it
 * is served as a static asset, but the HTML beside it is the source of truth:
 * edit that, re-run this, commit both.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
});
await page.goto("file://" + join(here, "og-image.html"), {
  waitUntil: "networkidle",
});
await page.screenshot({ path: join(here, "..", "public", "og-image.png") });
await browser.close();
console.log("wrote public/og-image.png");
