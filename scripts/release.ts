/**
 * Release CLI: `npm run release` runs it, then builds and deploys.
 *
 * It resolves the next `YYYY.MM.DD.N` version from today's date and the
 * existing git tags, then rewrites `src/i18n/releaseNotes.json`: the
 * `upcoming` section becomes that version (dated today) and a fresh empty
 * `upcoming` is prepended. With `--commit` it also commits that one file as
 * "Release vX" and tags the commit `vX`, so the deployed build and the notes
 * it shows can never disagree.
 *
 * It refuses to release an empty `upcoming` section (nothing to say is a
 * sign the notes were not written) and refuses when the working tree has
 * other changes (they would be deployed without being committed).
 *
 * The version-resolution and JSON-rewrite logic lives in
 * `src/lib/releaseVersioning.ts` so it is unit-tested by Jest; this file only
 * does the filesystem/git plumbing.
 *
 * Run with Node's built-in TypeScript support (22.18+; older 22.x needs
 * --experimental-strip-types):
 *   node scripts/release.ts [--commit]
 * Optional env:
 *   RELEASE_DATE=YYYY-MM-DD   override the release date (defaults to UTC today)
 *   GITHUB_OUTPUT=<file>      when set, appends `version=<version>`
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyRelease,
  isReleaseEmpty,
  isUpcomingVersion,
  nextReleaseVersion,
} from "../src/lib/releaseVersioning.ts";
import type { ReleaseNotesData } from "../src/i18n/releaseNotes.ts";

const RELEASE_NOTES_PATH = fileURLToPath(
  new URL("../src/i18n/releaseNotes.json", import.meta.url),
);

/** UTC `YYYY-MM-DD` for the release date (overridable for reproducibility). */
function releaseDateIso(): string {
  const override = process.env.RELEASE_DATE;
  if (override) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) {
      throw new Error(`Invalid RELEASE_DATE: ${override} (want YYYY-MM-DD)`);
    }
    return override;
  }
  return new Date().toISOString().slice(0, 10);
}

/** Existing released versions, derived from `vX` git tags. */
function existingVersions(): string[] {
  let raw = "";
  try {
    raw = execSync("git tag --list", { encoding: "utf8" });
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("v") ? tag.slice(1) : tag));
}

/** Paths with uncommitted changes, other than the release notes themselves. */
function otherDirtyPaths(): string[] {
  const raw = execSync("git status --porcelain", { encoding: "utf8" });
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((path) => !path.endsWith("src/i18n/releaseNotes.json"));
}

function main(): void {
  const commit = process.argv.includes("--commit");
  const dateIso = releaseDateIso();
  const dateDots = dateIso.replaceAll("-", ".");
  const version = nextReleaseVersion(dateDots, existingVersions());

  const data = JSON.parse(
    readFileSync(RELEASE_NOTES_PATH, "utf8"),
  ) as ReleaseNotesData;

  const upcoming = data.releases.find((r) => isUpcomingVersion(r.version));
  if (!upcoming || isReleaseEmpty(upcoming)) {
    throw new Error(
      "The `upcoming` section of src/i18n/releaseNotes.json is empty. " +
        "Write down what changed before releasing.",
    );
  }

  if (commit) {
    const dirty = otherDirtyPaths();
    if (dirty.length > 0) {
      throw new Error(
        "Uncommitted changes would be deployed without being committed:\n  " +
          dirty.join("\n  ") +
          "\nCommit or stash them first.",
      );
    }
  }

  const updated = applyRelease(data, version, dateIso);
  writeFileSync(RELEASE_NOTES_PATH, JSON.stringify(updated, null, 2) + "\n");

  if (commit) {
    execSync("git add src/i18n/releaseNotes.json", { stdio: "inherit" });
    execSync(`git commit -q -m "Release v${version}"`, { stdio: "inherit" });
    execSync(`git tag v${version}`, { stdio: "inherit" });
    process.stderr.write(
      `Committed and tagged v${version}. After deploying, push it:\n` +
        `  git push origin main --tags\n`,
    );
  }

  // Expose the resolved version to the workflow.
  process.stdout.write(`${version}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  }
}

main();
