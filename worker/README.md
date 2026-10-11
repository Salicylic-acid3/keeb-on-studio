# The gallery Worker

Everything except `/api/gallery` is the built app, served from the assets
binding exactly as before. This directory is only the keymap gallery.

## Setting it up

The gallery needs a KV namespace per environment. Create them once:

```
cd <the repo>
npx wrangler kv namespace create GALLERY --env dev
npx wrangler kv namespace create GALLERY --env release
```

Each prints an id. Put them in `wrangler.toml`, replacing
`REPLACE_WITH_DEV_NAMESPACE_ID` and `REPLACE_WITH_RELEASE_NAMESPACE_ID`.

Then set the maintainer token, which is what lets a reported keymap be taken
down. Pick a long random string and keep it somewhere you will find it again:

```
npx wrangler secret put GALLERY_MAINTAINER_TOKEN --env release
```

Until a namespace is bound, `/api/gallery` answers `503
gallery-not-configured` and the app says the gallery is not set up yet. The
rest of the app is unaffected, so deploying before doing any of this is safe.

Deploy as before:

```
npm run build
npx wrangler deploy --env release
```

## Running it locally

```
npm run build
npx wrangler dev --env dev --local
```

`--local` uses a KV namespace on disk under `.wrangler/`, so nothing touches
the real gallery. For the maintainer token locally, put it in `.dev.vars`
(git-ignored):

```
GALLERY_MAINTAINER_TOKEN=whatever-you-like
```

## Taking a keymap down

Reports hide a keymap on their own once three different browsers report it
(`REPORTS_TO_HIDE` in `gallery.ts`). Hidden means off the list but still
reachable by its own link, so a conversation already in progress does not
break before you have looked at it.

To remove one for good:

```
curl -s https://keeb-on.studio/api/gallery | python3 -m json.tool
curl -X DELETE https://keeb-on.studio/api/gallery/<id> \
  -H "authorization: Bearer <GALLERY_MAINTAINER_TOKEN>" \
  -H "content-type: application/json" -d '{}'
```

## What it costs

The free tier allows 1,000 KV writes a day. A publish is two (the post and the
author's index), a report is one, and the report that crosses the hide
threshold is one more. Reads are effectively unlimited by comparison, and a
page of the gallery is a single `list` — the cards live in KV metadata, so
showing twenty-four keymaps reads no values at all.

## What is and is not enforced

The board name (`ergotrack`, `goforty-max`) is checked against the app's own
supported list, but it is self-reported and forgeable, exactly as it is when a
keyboard reports it over the wire. It keeps the gallery about these keyboards;
it is not a proof of ownership, and there is deliberately no device id in a
post to make it one.

An author is a random token a browser keeps, and only its hash is stored. It
limits one browser to ten posts and lets that browser delete its own — it is
not an account, and someone determined can mint another. The real backstops
are the size cap, the same keymap validator a file goes through, and reports.

If that ever stops being enough, the next lever is a Cloudflare rate-limiting
rule on `/api/gallery` in the dashboard, which needs no code change.

## Layouts from the layout editor

The layout editor (`/layout`) has its own shelf in the same namespace, under
`/api/gallery/layouts`: the same routes, the same reports and the same ten
posts per author, counted apart from keymaps. Its keys start with `layout:`
and `layoutauthor:`, so a page of keymaps lists no layouts and the other way
round. A layout is not tied to a keyboard; what is checked is that it is a
layout-editor project with a name and between 1 and 400 keys.

Taking one down is the same command with `layouts/` in the path:

```
curl -s https://keeb-on.studio/api/gallery/layouts | python3 -m json.tool
curl -X DELETE https://keeb-on.studio/api/gallery/layouts/<id> \
  -H "authorization: Bearer <GALLERY_MAINTAINER_TOKEN>" \
  -H "content-type: application/json" -d '{}'
```

A card in the editor draws the layout itself, which costs one read per card
on top of the list. Reads are not what the free tier runs out of.

## Signing in with GitHub (the layout editor's My layouts)

The layout editor saves layouts to the user's own Gists. Reading and writing
them goes straight from the browser to GitHub; the Worker only does the one
step a page cannot, trading GitHub's one-time code for a token
(`/api/github/token`, see `github.ts`). It needs a GitHub OAuth App:

1. On GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   Homepage URL `https://keeb-on.studio`, Authorization callback URL
   `https://keeb-on.studio/layout`.
2. Give the Worker the app's Client ID and a client secret generated there:

```
npx wrangler secret put GITHUB_CLIENT_ID --env release
npx wrangler secret put GITHUB_CLIENT_SECRET --env release
```

Until both are set, `/api/github/config` answers `503 not-configured` and the
editor says saving to Gists is not set up; nothing else is affected. The dev
environment has another address, so it needs an OAuth App of its own (with
that address as the callback) to try signing in there.
