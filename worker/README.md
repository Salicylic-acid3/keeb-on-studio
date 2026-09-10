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
