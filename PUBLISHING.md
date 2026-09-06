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

(For what it's worth: I couldn't find an official Figma policy that
proactively rejects lookalike-named plugins — their [Community Guidelines](https://help.figma.com/hc/en-us/articles/360038510573-Figma-Community-Guidelines)
and [copyright/IP policy](https://www.figma.com/legal/copyright-and-ip-policy/)
only cover trademark complaints reactively, filed by the rights-holder
after the fact. So this isn't "Figma will auto-reject you" — it's "don't
give Figmats/Pinterest a legitimate complaint to file," which staying
distinct already avoids.)

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
• Choose how many to import — see the board's pin count up front, then
  pick a preset (20/50/100/All, scaled to the board's size) and whether
  you want the newest or oldest pins
• Preserve section structure — group pins into separate frames that match
  your board's sections
• Add color distribution — a bar under each image showing its top colors'
  real share of the picture (not just one swatch), handy for building a
  palette from your references
• Import full-size images — use each pin's original resolution instead of
  the default preview size
• Carousel images — pull in every image from multi-image pins, not just
  the first
• Add source link — every image keeps a clickable link back to its
  original pin

📌 How to use:
1. Open any public Pinterest board in a browser and copy its URL
2. Paste it into the plugin and click Load board
3. Choose how many pins to import and toggle the settings you want
4. Click Import — pins appear on your canvas as a grid, ready to move,
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
This plugin requests network access to one specific Cloudflare Worker
(source included in this repo, worker/pinterest-proxy.js) that relays
requests to Pinterest's own public board/pin-feed endpoints and runs
color analysis on pin thumbnails. It's needed because Figma's plugin
sandbox blocks cross-origin requests to sites without CORS support, and
Pinterest doesn't send CORS headers. The proxy only forwards
*.pinterest.com and *.pinimg.com URLs and stores nothing. Separately,
i.pinimg.com is accessed directly to download each pin's image onto the
canvas (that path doesn't go through the proxy — figma.createImageAsync()
isn't subject to browser CORS).
```

**Network access category** (a dropdown in the publish form: Unknown /
Unrestricted / Restricted / No access): pick **Restricted** — the plugin
declares specific domains in `manifest.json` rather than requesting
unrestricted access, which is what resolves the "Unknown" state.

**Privacy policy**: Figma only requires one if the plugin "processes user
data" (per their [plugin review guidelines](https://help.figma.com/hc/en-us/articles/360039958914-Plugin-and-widget-review-guidelines)).
This plugin doesn't collect, store, or transmit anything about the person
using it — it only relays public Pinterest content through your proxy and
places images on their own canvas. No privacy policy should be required,
but re-read that guideline yourself before submitting, since "processes
user data" is Figma's call to interpret, not this draft's.

## Assets

| Asset | Spec | Status |
|---|---|---|
| Plugin icon | 128×128 PNG | **draft ready**: `assets/icon.png` (source: `assets/icon.html`) — rounded-square blue gradient with a moodboard-tile motif, no Pinterest branding |
| Cover image | 1920×1080 PNG/JPG or video | **draft ready**: `assets/cover.png` (source: `assets/cover.html`) — title, tagline, FREE badge, and a mock imported grid with a color-distribution bar hint |
| Screenshots/carousel (optional but recommended, up to 9) | Show the board-load screen, the count/newest-oldest picker, Settings, and an imported grid with the color-distribution bars | **missing** — needs real screenshots from inside Figma, which only you can take |

Both drafts are generated (HTML → screenshot at the exact pixel size), not
hand-picked stock art — look them over and tell me if you want the copy,
colors, or layout changed; the `.html` sources are easy to tweak and
re-render. One thing to double-check yourself at upload time: `icon.png`
has its corners pre-rounded (28px radius) — if Figma's upload dialog also
rounds icons automatically, that could look like a double-rounded corner.
If so, say so and I'll regenerate a sharp-cornered version (one line change
in `assets/icon.html`).

I can draft cover/icon concepts as an Artifact mockup if useful, but actual
exportable PNGs need to be made in Figma/an image tool — that's a manual
step for you.

## Pre-publish checklist

- [x] `npm run build` and `npx tsc --noEmit` succeed with no errors
- [x] `worker/pinterest-proxy.js` deployed to Cloudflare Workers (Git-connected
      auto-deploy via `wrangler.toml`), `PINTEREST_PROXY_URL` set in
      `src/config.ts`, and `manifest.json`'s `networkAccess` narrowed to that
      exact worker hostname
- [x] Verified end-to-end against real boards (`jp.pinterest.com`), including
      the board pin-count preview, newest/oldest/custom selection, and the
      color-distribution bar — see `progress.txt` for what was tested and how
- [x] Security review completed (see "Security" section below) — the SSRF
      redirect gap and thumbnail-size-rewrite bypass were both found and
      fixed, not just theoretical concerns left unaddressed
- [x] Support link set to the GitHub repo's issues page (see above)
- [ ] You've personally loaded it via **Plugins → Development → Import
      plugin from manifest…** and run it against a few more real boards
      yourself (small, large, board with sections, board with carousel pins)
      — I've verified the underlying logic and network calls extensively,
      but haven't been able to run the actual Figma desktop/browser app from
      here, so this step is still yours to do
- [x] `assets/icon.png` and `assets/cover.png` drafted — review them, and
      wire them up in the Community publish dialog when ready (they're not
      part of `manifest.json`, so nothing auto-applies this)
- [ ] Re-read the description above and adjust tone/wording to taste
- [ ] Only then: Figma menu → Plugins → Development → your plugin →
      Publish

None of the above has been done automatically — publishing is a manual,
one-way action you should take yourself.

## Security

A focused review of `worker/pinterest-proxy.js`, `manifest.json`, and
`src/utils/pinterest.ts` on 2026-09-06 found and fixed two real issues
(not just theoretical) before this was suggested for publishing:

1. **SSRF via unvalidated redirect** — the worker fetched with
   `redirect: 'follow'`, which only validates the *initial* URL's host. If
   Pinterest (or pinimg.com) ever redirected off-domain, the worker would
   silently relay whatever that redirect pointed to — since the worker is
   a public endpoint with no auth, this could've been abused as an open
   proxy to arbitrary sites. Fixed: redirects are now followed manually,
   re-validating the host at every hop, capped at 5 hops. Verified with a
   mocked cross-host redirect that it's refused before any network call to
   the disallowed host.
2. **Thumbnail-size-rewrite bypass** — the color-extraction endpoint forces
   every image request down to a tiny 60×60 thumbnail (that's what keeps
   JPEG decoding inside Cloudflare's free-tier 10ms CPU budget). The rewrite
   used a regex anchored on a single leading slash, which a crafted path
   like `https://i.pinimg.com//originals/...` (doubled slash) would bypass
   entirely, forcing the worker to decode a full-resolution image instead —
   defeating the whole CPU-budget assumption. Fixed: the path is now
   reconstructed from filtered segments instead of a regex replace, closing
   that bypass (verified against the doubled- and tripled-slash cases).

Also hardened: `manifest.json`'s `networkAccess` was narrowed from
`*.workers.dev` to the one specific deployed worker hostname, and the
client-side `parseBoardUrl()` host check was tightened to match the
worker's own anchored allowlist (it previously accepted any hostname merely
*containing* "pinterest." — e.g. `pinterest.evil.com` — which the worker's
stricter check would still have rejected, but gave a confusing generic
error instead of a clear "not a Pinterest URL" message).

Lower-priority notes, not fixed (judgment calls, not obvious bugs):
- The `esbuild` devDependency has a moderate CVE, but it only applies to
  `esbuild serve`'s dev server, which this project's build never invokes
  (`npm run build` only does one-shot `--bundle --outfile=`) — not
  exploitable here, upgrade at your convenience for hygiene.
- The worker sends a spoofed browser `User-Agent` to Pinterest — not a
  security vulnerability in this plugin, but worth knowing it's presenting
  itself as a browser rather than disclosing itself as a bot; Pinterest
  could choose to rate-limit or block it under their own terms at any time,
  which would break the plugin for everyone until you noticed and adjusted.
- The vendored JPEG decoder (`worker/jpeg-decoder.js`, from the
  battle-tested `jpeg-js` library) has its own built-in resolution/memory
  guards (100 megapixels / 512MB by default) against malformed or
  oversized input — not disabled or weakened here.
