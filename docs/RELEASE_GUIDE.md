# Release & Release Notes Guide

Keeb-On! Studio ships from `main` by hand, and every release is recorded in the
in-app **Release Notes** page (`https://keeb-on.studio/release-notes`), which is
also where the app gets the version it shows on the top screen.

The rule that makes this work: **a change and its release note are one
commit.** A patch that changes something a person would notice carries its
own entry in the `upcoming` section of `src/i18n/releaseNotes.json`. The
release step then only stamps a version on what is already written.

## Versioning

Versions are date based: `YYYY.MM.DD.N`, where `N` starts at `0` and increments
for each additional release on the same day (e.g. `2026.09.26.0`,
`2026.09.26.1`). The version is decided by the release script from the date and
the existing `vYYYY.MM.DD.N` git tags — you never set it by hand.

## How a release happens

```
cd ~/自キ設計_パブリック/keeb-on-studio
git status --short          # must be clean apart from releaseNotes.json
npm run release
git push origin main --tags
```

`npm run release` is `scripts/release.ts --commit`, then the build, then the
deploy:

1. **Refuses** if the `upcoming` section is empty (nothing to say means the
   notes were not written — go write them), or if the working tree has
   uncommitted changes other than the release notes (they would be deployed
   without being committed).
2. Rewrites `src/i18n/releaseNotes.json`: `upcoming` becomes the new version,
   dated today, and a fresh empty `upcoming` is prepended.
3. Commits that one file as `Release vYYYY.MM.DD.N` and tags the commit
   `vYYYY.MM.DD.N`.
4. `npm run build`, then `npx wrangler deploy --env release`.

The push at the end is yours: the tag is what the next release counts from, so
it has to reach GitHub.

The version-resolution and JSON-rewrite logic lives in
`src/lib/releaseVersioning.ts` and is unit-tested
(`src/lib/__tests__/releaseVersioning.test.ts`).

To deploy without a release (a hotfix you will fold into the next notes, say)
the old pair still works: `npm run build && npx wrangler deploy --env release`.
The top screen then keeps showing the previous version, which is honest.

## Writing release notes in a patch

**When a patch adds or changes something a user would notice, it includes an
entry in the `upcoming` section of `src/i18n/releaseNotes.json`.** Patches
handed over for `git am` follow this too: the entry is part of the same
commit.

- The `upcoming` section is the first entry in `releases`, with
  `"version": "upcoming"`. **If it is missing, create it** at the top of
  `releases`:

  ```json
  {
    "version": "upcoming",
    "date": null,
    "changes": { "major": [], "minor": [], "patch": [] }
  }
  ```

- Add each change as an object under the right category, in English,
  Japanese and Chinese:

  ```json
  {
    "en": "Short user-facing description.",
    "ja": "利用者向けの短い説明。",
    "zh": "面向用户的简短说明。"
  }
  ```

- Optionally reference the pull request(s) with a `pr` field — a single number
  or an array. It renders as a `#123` link to GitHub on the release notes page.

- Write from the user's perspective (what changed for them), not the
  implementation. Keep each entry to one sentence. When a change only works
  with newer firmware, say which commit of which repository.

### Optional release summary

A release can carry an optional `summary` above the categorized changes — a
`lead` sentence and a few `highlights` — for a human overview of a big release.
Add it to the `upcoming` section (it carries into the release), and only when
it adds value:

```json
{
  "version": "upcoming",
  "date": null,
  "summary": {
    "lead": {
      "en": "A big update across the board.",
      "ja": "全体的に大規模にアップデートしました。",
      "zh": "全面的大幅更新。"
    },
    "highlights": [
      { "en": "Added X.", "ja": "X を追加しました。", "zh": "新增 X。" }
    ]
  },
  "changes": { "major": [], "minor": [], "patch": [] }
}
```

Purely internal changes (refactors, test-only changes, dependency bumps with no
user-visible effect) do **not** need an entry.

## Classifying a change: major / minor / patch

Put each entry under the category that matches its user impact:

- **major** — new capability or a significant, visible change to how the app
  works: a new tab/page, a new editor, a redesign, a new integration, or
  anything that changes existing behavior in a way users must notice.
- **minor** — a new but self-contained enhancement to existing functionality:
  an added option, a new control, a quality-of-life improvement, a performance
  win users can feel.
- **patch** — bug fixes, small polish, copy/wording updates, and other
  corrections that don't add functionality.

When in doubt, pick the lower category (a fix is a `patch`, not a `minor`).
