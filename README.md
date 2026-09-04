# Pinterest to Figma

Repo: https://github.com/iori73/pinterest-to-figma

Figma plugin that imports a public Pinterest board into the canvas as a
grid of images — a free, unlimited alternative to paid board-importer
plugins (see [`PUBLISHING.md`](./PUBLISHING.md) for why it's a distinct
name/brand rather than a straight clone).

## Setup (required before it works)

Figma's plugin sandbox enforces standard browser CORS on `fetch()`, and
Pinterest's servers don't send CORS headers — so the plugin **cannot**
fetch board data directly; it needs a small proxy of your own. It's free
and takes about 2 minutes:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up
   (free, no credit card) → **Workers & Pages** → **Create** → **Create
   Worker**.
2. Give it any name (e.g. `pinterest-to-figma-proxy`) → **Deploy** (the
   default "Hello World" is fine for now).
3. Click **Edit code** and replace everything with the contents of
   [`worker/pinterest-proxy.js`](./worker/pinterest-proxy.js) from this
   repo → **Deploy**.
4. Copy the worker's URL (shown at the top, looks like
   `https://pinterest-to-figma-proxy.<your-subdomain>.workers.dev`).
5. Paste it into `src/config.ts` as `PINTEREST_PROXY_URL`.
6. `npm run build`, then reload the plugin in Figma.

Free tier is 100,000 requests/day — far more than this plugin will ever use
for personal boards. See the comment at the top of `worker/pinterest-proxy.js`
for what it does and why (it only relays `*.pinterest.com` URLs — nothing else).

## What it does

1. Paste a public Pinterest board URL (e.g. `https://www.pinterest.com/username/board-name/`
   — any country domain like `jp.pinterest.com` works too)
2. Toggle settings: preserve section structure, add dominant color swatch,
   import full-size images, pull in carousel images, add a source link back
   to each pin
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
  pinterest-proxy.js # Cloudflare Worker: CORS proxy, see "Setup" above
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

## Known limitations

- Public boards only (no login flow)
- Depends on a proxy you deploy and keep running — see "Setup" above
- "Select which sections to import" (from the reference plugin) is not
  implemented — sections are all-or-nothing via "Preserve section structure"
- If Pinterest changes their page's embedded JSON structure, parsing in
  `src/utils/pinterest.ts` will need updating
