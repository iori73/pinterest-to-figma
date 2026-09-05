# Pinterest to Figma

Repo: https://github.com/iori73/pinterest-to-figma

Figma plugin that imports a public Pinterest board into the canvas as a
grid of images — a free, unlimited alternative to paid board-importer
plugins (see [`PUBLISHING.md`](./PUBLISHING.md) for why it's a distinct
name/brand rather than a straight clone).

## Setup (required before it works)

Figma's plugin sandbox enforces standard browser CORS on `fetch()`, and
Pinterest's servers don't send CORS headers — so the plugin **cannot**
fetch board data (or run color analysis on images) directly; it needs a
small proxy of your own. It's free and takes about 2 minutes:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up
   (free, no credit card) → **Workers & Pages** → **Create** → **Create
   Worker**, name it (e.g. `pinterest-to-figma`) → **Deploy** (the default
   "Hello World" is fine for now).
2. Connect it to a fork/clone of this repo (**Settings → Build → connect to
   Git**) — `wrangler.toml` at the repo root already points it at
   `worker/pinterest-proxy.js`, so pushing to `main` auto-deploys from then
   on. (If you'd rather not connect Git, click **Edit code** instead and
   paste in the combined contents of `worker/pinterest-proxy.js`,
   `worker/jpeg-decoder.js`, and `worker/color-quantize.js` — but Quick Edit
   is a single file, so you'd need to manually merge them; Git deploy is
   much less fiddly here since this worker is no longer one file.)
3. Copy the worker's URL from **Overview** (looks like
   `https://pinterest-to-figma.<your-subdomain>.workers.dev`).
4. Paste it into `src/config.ts` as `PINTEREST_PROXY_URL`.
5. `npm run build`, then reload the plugin in Figma.

Free tier is 100,000 requests/day and 10ms CPU time per request — far more
requests than this plugin will ever use for personal boards, though that
CPU limit matters for the color-distribution feature (see below). See the
comment at the top of `worker/pinterest-proxy.js` for exactly what it
relays and why (only `*.pinterest.com` and `*.pinimg.com` targets — nothing
else).

## What it does

1. Paste a public Pinterest board URL (e.g. `https://www.pinterest.com/username/board-name/`
   — any country domain like `jp.pinterest.com` works too)
2. Toggle settings: preserve section structure, add a color-distribution
   bar under each image, import full-size images, pull in carousel images,
   add a source link back to each pin
3. Click **Download** — the plugin fetches the board's public pin feed
   (Pinterest's own `BoardFeedResource` endpoint, no login required) via
   your proxy, and places every pin as an image on the canvas, laid out in
   a fixed-column grid inside one frame per section

Capped at 500 pins per run (`MAX_PINS` in `src/types.ts`) to keep Figma
responsive on very large boards.

## Development

```bash
npm install
npm run build   # one-off build
npm run watch   # rebuild on change
```

Then in Figma: **Plugins → Development → Import plugin from manifest...**
and select `manifest.json` in this folder. If you change `manifest.json`
itself (e.g. `networkAccess`), fully remove and re-import the plugin rather
than just reloading — Figma appears to cache network permissions from the
original import.

## Structure

```
src/
  code.ts            # plugin sandbox: fetch, layout, place images
  ui.tsx             # plugin UI (React): board URL input + settings
  types.ts           # shared message/data types between code.ts and ui.tsx
  config.ts          # PINTEREST_PROXY_URL — set this after deploying the worker
  utils/
    pinterest.ts     # board URL parsing + Pinterest scraping/pagination (via proxy)
    grid.ts          # grid layout math
    color.ts         # hex -> Figma RGB conversion
scripts/
  build-ui.js        # inlines the bundled ui.js into dist/ui.html
worker/
  pinterest-proxy.js # Cloudflare Worker entry: CORS proxy + color extraction, see "Setup"
  jpeg-decoder.js    # vendored jpeg-js decoder (see LICENSE-jpeg-js), ESM-adapted
  color-quantize.js  # reduces a decoded image to its top-5 colors + real % share
  LICENSE-jpeg-js    # license for the vendored decoder
wrangler.toml         # tells Cloudflare's Git-connected build where the worker entry is
PUBLISHING.md         # draft Community listing copy + pre-publish checklist
```

## How the scraping works

Pinterest server-renders each board page with an embedded
`<script id="__PWS_INITIAL_PROPS__">` JSON blob containing the first ~25
pins plus a `board_id`. Further pages are fetched from Pinterest's public
`https://<host>/resource/BoardFeedResource/get/` endpoint using that
`board_id` and a pagination `bookmark`, the same request the Pinterest web
app itself makes when you scroll — no authentication needed for public
boards. Both requests go through `worker/pinterest-proxy.js` (see "Setup"),
since calling them directly from the plugin hits CORS. This was verified
against real boards (including a `jp.pinterest.com` one) with `curl` and a
local Node simulation of the worker during development — see `progress.txt`
/ `lessons.md` for details.

## How the color-distribution bar works

"Add color distribution" doesn't use Pinterest's own single `dominant_color`
field directly — instead, for each pin, the proxy fetches a tiny 60×60
thumbnail of the image (rewriting whatever size the pin's URL originally
pointed to), decodes it with a vendored copy of
[jpeg-js](https://github.com/jpeg-js/jpeg-js) (`worker/jpeg-decoder.js`),
and buckets its pixels into the top 5 colors with each one's *real*
percentage of the image (`worker/color-quantize.js`). The plugin then
draws that as a stacked horizontal bar under the image — segments don't
necessarily sum to 100% (only the top 5 are kept; the rest is a long tail
of minor colors, left unfilled rather than padded with a made-up "other"
color).

This only works for JPEG thumbnails (the vast majority of Pinterest
images — verified against both plain-JPEG and WebP-original pins, since
Pinterest transcodes small sizes to JPEG regardless of the original
format) and only within Cloudflare's free-tier **10ms CPU-time budget per
request** — decoding a 60×60 JPEG took ~6ms in local testing, comfortably
under that, but it's not a hard guarantee for every image. Whenever the
proxy can't compute a real distribution (non-JPEG thumbnail, CPU limit
exceeded, network hiccup), the plugin falls back to a single full-width
segment using Pinterest's own `dominant_color` for that pin, so the bar
never just disappears — it's just less detailed for that one image.

## Known limitations

- Public boards only (no login flow)
- Depends on a proxy you deploy and keep running — see "Setup" above
- "Select which sections to import" (from the reference plugin) is not
  implemented — sections are all-or-nothing via "Preserve section structure"
- The color-distribution bar can silently fall back to a single color per
  image if the proxy's CPU budget is exceeded — see above
- If Pinterest changes their page's embedded JSON structure, parsing in
  `src/utils/pinterest.ts` will need updating
