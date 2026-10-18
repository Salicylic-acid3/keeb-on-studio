// Random walk over the guide's layer-content steps (7 and 8), against a
// built preview, to catch anything the unit tests miss: pulldowns, radios,
// the symbol grid, apply, going back, zoom, reload. Each run is seeded.
//
//   npm run build && npx vite preview --port 4173 &
//   npx -y playwright@1.49 install chromium   (once)
//   node scripts/practiceGuideStress.mjs goforty_max_ortho 11
//
// Prints "done errors 0" when nothing broke; a failing run leaves a
// screenshot in the current directory.
import { chromium } from "playwright";
const base = "http://localhost:4173";
const out = ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1900 } });
let errors = 0;
page.on("pageerror", (e) => {
  errors++;
  console.log("PAGEERROR", e.message.split("\n")[0]);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200));
});
page.on("dialog", (d) => d.accept());
async function applyOrSkip() {
  const apply = page.getByRole("button", { name: "適用" });
  if (await apply.isEnabled()) await apply.click();
  else await page.getByRole("button", { name: "設定せずに次へ" }).click();
  await page.waitForTimeout(100);
}
const id = process.argv[2] ?? "goforty_max_ortho";
let seed = Number(process.argv[3] ?? 11);
const rnd = (n) => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % n;
};
await page.goto(`${base}/practice?keyboard=${id}`, {
  waitUntil: "networkidle",
});
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("dya-studio-language", "ja");
});
await page.goto(`${base}/practice?keyboard=${id}`, {
  waitUntil: "networkidle",
});
await page.getByText(/ガイドを始める/).click();
await page.getByRole("button", { name: "始める" }).click();
await applyOrSkip();
await applyOrSkip();
await page.getByRole("button", { name: "サリチル酸のおすすめを反映" }).click();
await page.waitForTimeout(100);
if (rnd(2)) {
  const rows = page.locator("div.grid.grid-cols-\\[5rem_1fr_1fr\\]");
  await rows
    .nth(3)
    .locator("select")
    .nth(1)
    .selectOption({ label: "レイヤー" });
}
await applyOrSkip();
await applyOrSkip();
await page.getByRole("button", { name: "終わったので次へ" }).click();
await page.waitForTimeout(100);
const stepName = async () =>
  await page
    .locator("text=/^ステップ \\d+ \\/ 11$/")
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => "?");
async function check(i, what) {
  const txt = await page.locator("body").innerText();
  const svgs = await page.locator("svg[viewBox]").count();
  const step = await stepName();
  const bad =
    /問題が起きました|something went wrong/i.test(txt) || svgs === 0 || errors;
  if (bad || i % 10 === 0)
    console.log(i, step, what, "svgs", svgs, bad ? "BROKEN" : "");
  if (bad) {
    await page.screenshot({ path: `${out}/stress2-${id}.png`, fullPage: true });
    return false;
  }
  return true;
}
for (let i = 0; i < 120; i++) {
  const step = await stepName();
  const inLayerStep = /ステップ (7|8) /.test(step);
  const r = rnd(10);
  let what = "";
  try {
    if (!inLayerStep || (r >= 7 && r < 8)) {
      const target =
        rnd(1000) % 2
          ? "レイヤーの中身（片手で完結）"
          : "レイヤーの中身（反対側）";
      what = "goto " + target;
      await page
        .locator(`button[title="${target}"]`)
        .first()
        .click({ timeout: 3000 });
    } else if (r < 4) {
      const selects = page.locator("select");
      const n = await selects.count();
      const which = 2 + rnd(n - 2);
      const enabled = await selects
        .nth(which)
        .locator("option:not([disabled])")
        .evaluateAll((os) => os.map((o) => o.value));
      const v = enabled[rnd(enabled.length)];
      what = `select#${which}=${v}`;
      await selects.nth(which).selectOption({ value: v });
    } else if (r < 5) {
      const radios = page.locator("input[type=radio]");
      const n = await radios.count();
      if (n) {
        const k = rnd(n);
        what = "radio " + k;
        await radios.nth(k).check();
      }
    } else if (r < 6) {
      const inputs = page.locator("input[maxlength='1']");
      const n = await inputs.count();
      if (n) {
        const k = rnd(n);
        const ch = "!@#$%^&*()[]{};:'\"<>?/|~-=+"[rnd(27)];
        what = `grid#${k}=${ch}`;
        await inputs.nth(k).fill(rnd(4) ? ch : "");
      }
    } else if (r < 7) {
      what = "apply";
      await applyOrSkip();
    } else if (r < 9) {
      what = "zoom";
      await page
        .getByRole("button", { name: /拡大|縮小/ })
        .first()
        .click({ timeout: 2000 })
        .catch(() => {});
    } else {
      what = "reload";
      await page.reload({ waitUntil: "networkidle" });
    }
  } catch (e) {
    console.log(i, "action failed:", what, e.message.split("\n")[0]);
  }
  await page.waitForTimeout(60);
  if (!(await check(i, what))) break;
}
console.log("done errors", errors);
await browser.close();
