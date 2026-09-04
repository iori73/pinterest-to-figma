# Figma Community listing — draft

Status: **draft, not submitted.** Everything below is ready to paste into the
Community publish flow once you've tested the plugin yourself and made the
icon/cover images. Nothing here has been sent anywhere.

## ⚠️ Naming / branding — read first

The plugin you asked me to match (`Pinterest Importer` by Figmats,
https://www.figma.com/community/plugin/1414676079568412945) is an existing
paid Community listing. Reusing Pinterest's logo, that plugin's name, or its
cover art would look like impersonation and can get a listing rejected or
taken down — even though the *feature itself* (paste a board link, get a
grid of images) isn't anything exclusive to them.

This draft uses a different name, different cover concept, and no Pinterest
logo asset — only functional overlap, which is fine. If you want, I can
rename it again to something even further from the original; right now it's
set to **"Pinterest to Figma"**.

## ⚠️ This plugin depends on infrastructure you host — read before publishing

Earlier drafts of this said "no backend, no third-party server." That turned
out to be wrong: Figma's plugin sandbox enforces standard browser CORS, and
Pinterest's servers don't send CORS headers, so the plugin cannot fetch
board data directly — it routes through `worker/pinterest-proxy.js`, a
Cloudflare Worker you deploy under your own account (see README.md
"Setup"). This is genuinely free (Cloudflare's free tier: 100k requests/day)
but it does mean:

- If your Worker goes down, is deleted, or you let the Cloudflare account
  lapse, **the published plugin breaks for everyone using it** — not just
  you. This is a real maintenance commitment, unlike a plugin with no
  external dependency.
- Community reviewers may ask about the network access request pointing at
  `*.workers.dev` rather than `*.pinterest.com` directly — the justification
  text below explains why; keep that explanation intact when you submit.
- Consider Cloudflare's dashboard analytics occasionally to watch for abuse
  (someone hammering your worker URL from outside the plugin) — the worker
  only relays `*.pinterest.com` targets, which limits the damage, but it's
  still a public endpoint.

If this ongoing responsibility isn't something you want, the honest
alternative is not publishing this to Community and instead keeping it as a
personal dev-mode plugin (which is exactly how it works today, and needs no
publishing step at all).

## Listing fields

**Plugin name**
```
Pinterest to Figma
```

**Tagline** (shown under the name in search results, ~60 chars)
```
Import any public Pinterest board into Figma as a grid — free
```

**Introduction (first paragraph, shown above the fold)**
```
Paste a public Pinterest board link and get every pin laid out on your
canvas as an image grid — no account linking, no credit limits, no paywall.
```

**Description body**
```
✨ Turn a Pinterest board into a Figma moodboard in one click

Paste any public Pinterest board URL and this plugin fetches every pin's
image directly onto your canvas, arranged in a clean grid you can
immediately start designing with.

🧩 Features (all included, no upgrade required):
• Preserve section structure — group pins into separate frames that match
  your board's sections
• Add dominant color — drop a small color swatch from each image, handy
  for building a palette from your references
• Import full-size images — use each pin's original resolution instead of
  the default preview size
• Carousel images — pull in every image from multi-image pins, not just
  the first
• Add source link — every image keeps a clickable link back to its
  original pin

📌 How to use:
1. Open any public Pinterest board in a browser and copy its URL
2. Paste it into the plugin and toggle the settings you want
3. Click Download — pins appear on your canvas as a grid, ready to move,
   resize, or drop into a moodboard

🔒 Notes:
• Works with public boards only — private boards require being logged in,
  which this plugin does not do
• Large boards are capped at 500 pins per run to keep Figma responsive
• Board data is relayed through a small proxy so it can be fetched inside
  Figma at all (Figma's plugin sandbox blocks direct cross-origin requests
  to sites that don't opt in, and Pinterest doesn't). The proxy only relays
  Pinterest URLs and doesn't store anything — it exists purely to get around
  that restriction, not to collect data

Found a board that doesn't import correctly, or a section that isn't
grouped as you'd expect? Feedback is welcome — see the support link below.
```

**Tags / categories** (Community lets you pick from a fixed list + free-text tags)
```
Primary category: Utilities
Suggested tags: images, import, pinterest, moodboard, inspiration,
                grid, reference, productivity
```

**Support / contact link**
```
https://github.com/iori73/pinterest-to-figma/issues
```

**Third-party payment toggle**: leave **off** — this plugin is fully free
with no external payment/credit system, unlike the reference plugin.

**Permissions / network access justification** (shown to reviewers/users)
```
This plugin requests network access to *.workers.dev, which is a
self-hosted proxy (source included in the plugin's repo, worker/pinterest-
proxy.js) that relays requests to Pinterest's own public board/pin-feed
endpoints. It's needed because Figma's plugin sandbox blocks cross-origin
requests to sites without CORS support, and Pinterest doesn't send CORS
headers. The proxy only forwards *.pinterest.com URLs and stores nothing.
Separately, i.pinimg.com is accessed directly to download each pin's image
onto the canvas.
```

## Assets you still need to make

| Asset | Spec | Status |
|---|---|---|
| Plugin icon | 128×128 PNG, transparent background | **missing** — do not reuse Pinterest's "P" mark |
| Cover image | 1920×960 PNG/JPG (Community's required cover ratio) | **missing** |
| Screenshots (optional but recommended) | 1-3 images showing the Settings panel and an imported grid | **missing** |

I can draft cover/icon concepts as an Artifact mockup if useful, but actual
exportable PNGs need to be made in Figma/an image tool — that's a manual
step for you.

## Pre-publish checklist

- [ ] `npm run build` succeeds with no errors (confirmed as of this draft)
- [ ] Deploy `worker/pinterest-proxy.js` to Cloudflare Workers (see
      README.md "Setup") and set `PINTEREST_PROXY_URL` in `src/config.ts`
      — **not yet done; `src/config.ts` still has the `REPLACE-ME`
      placeholder as of this draft**
- [x] The worker's request/response logic (fetching a real board + its pin
      feed, adding CORS headers, rejecting non-Pinterest/non-https targets)
      was verified by simulating it locally in Node against live Pinterest
      URLs — see `progress.txt`. This is **not** the same as confirming the
      actual deployed Cloudflare Worker works, which still needs doing.
- [ ] Manually load via **Plugins → Development → Import plugin from
      manifest…** and run it against 2-3 real boards (small, large, board
      with sections, board with carousel pins) using your deployed proxy URL
- [x] Support link set to the GitHub repo's issues page (see above)
- [ ] Add `icon.png` and cover image, wire them up in the Community publish
      dialog (not part of `manifest.json`)
- [ ] Re-read the description above and adjust tone/wording to taste
- [ ] Only then: Figma menu → Plugins → Development → your plugin →
      Publish

None of the above has been done automatically — publishing is a manual,
one-way action you should take yourself.
