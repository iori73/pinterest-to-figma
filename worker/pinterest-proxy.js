// Pinterest to Figma — CORS proxy
//
// Figma's plugin sandbox enforces standard browser CORS on fetch(), and
// Pinterest's own servers don't send Access-Control-Allow-Origin headers.
// So a plugin running only inside Figma can never fetch a Pinterest board
// page, its pin-feed API, or a pin image directly — this tiny worker does
// those fetches server-to-server (where CORS doesn't apply) and hands the
// result back with CORS enabled, restricted to Pinterest's own domains
// only so it can't be abused as an open proxy.
//
// Two modes, both GET:
//   ?url=<https://*.pinterest.com/...>    — relays board pages / pin-feed API JSON
//   ?colors=<https://*.pinimg.com/...>    — downloads a tiny thumbnail of that
//                                           image, decodes it, and returns its
//                                           top-5 dominant colors with each
//                                           color's real share of the image
//                                           (see worker/color-quantize.js).
//                                           Falls back to a 4xx/5xx response
//                                           the plugin can catch and recover
//                                           from (e.g. non-JPEG thumbnail, or
//                                           this exceeding the Workers free
//                                           tier's 10ms CPU budget) — the
//                                           plugin then uses Pinterest's own
//                                           single dominant_color instead.
//
// Deploy: this repo is connected to Cloudflare Workers via wrangler.toml —
// push to main and it auto-deploys. See README.md "Setup" if starting fresh.

import { decode as decodeJpeg } from './jpeg-decoder.js';
import { quantizeTopColors } from './color-quantize.js';

const ALLOWED_PINTEREST_HOST = /(^|\.)pinterest\.com$/i;
const ALLOWED_IMAGE_HOST = /(^|\.)pinimg\.com$/i;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
  'X-Pinterest-PWS-Handler': 'www/[username]/[slug].js',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

function errorResponse(message, status) {
  return new Response(message, { status, headers: corsHeaders() });
}

async function handlePinterestRelay(target) {
  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse('Invalid "url" query parameter', 400);
  }

  if (targetUrl.protocol !== 'https:' || !ALLOWED_PINTEREST_HOST.test(targetUrl.hostname)) {
    return errorResponse('Only https://*.pinterest.com URLs are allowed', 403);
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), { headers: BROWSER_HEADERS, redirect: 'follow' });
  } catch (err) {
    return errorResponse(`Upstream fetch failed: ${err}`, 502);
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(body, { status: upstream.status, headers });
}

// Rewrites a Pinterest image URL's size segment (e.g. "736x", "originals")
// to a tiny fixed size, so decoding stays cheap enough for the Workers free
// tier's CPU budget.
function toTinyThumbnailUrl(targetUrl) {
  const rewritten = new URL(targetUrl.toString());
  rewritten.pathname = rewritten.pathname.replace(/^\/[^/]+\//, '/60x60/');
  return rewritten;
}

async function handleColorExtraction(target) {
  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse('Invalid "colors" query parameter', 400);
  }

  if (targetUrl.protocol !== 'https:' || !ALLOWED_IMAGE_HOST.test(targetUrl.hostname)) {
    return errorResponse('Only https://*.pinimg.com URLs are allowed', 403);
  }

  const thumbUrl = toTinyThumbnailUrl(targetUrl);

  let upstream;
  try {
    upstream = await fetch(thumbUrl.toString(), { headers: BROWSER_HEADERS, redirect: 'follow' });
  } catch (err) {
    return errorResponse(`Upstream fetch failed: ${err}`, 502);
  }
  if (!upstream.ok) {
    return errorResponse(`Upstream returned HTTP ${upstream.status}`, 502);
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  // JPEG magic bytes (0xFFD8). Anything else (e.g. WebP/PNG thumbnails) we
  // don't have a decoder for — bail out so the plugin falls back cleanly.
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return errorResponse('Thumbnail is not a JPEG (decoder only supports JPEG)', 415);
  }

  try {
    const image = decodeJpeg(bytes, { useTArray: true });
    const colors = quantizeTopColors(image.data, image.width, image.height, 5);
    return new Response(JSON.stringify({ colors }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return errorResponse(`Decode failed: ${err}`, 500);
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const requestUrl = new URL(request.url);
    const relayTarget = requestUrl.searchParams.get('url');
    const colorsTarget = requestUrl.searchParams.get('colors');

    if (relayTarget) return handlePinterestRelay(relayTarget);
    if (colorsTarget) return handleColorExtraction(colorsTarget);

    return errorResponse('Missing "url" or "colors" query parameter', 400);
  },
};
