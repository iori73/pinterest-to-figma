// Pinterest to Figma — CORS proxy
//
// Figma's plugin sandbox enforces standard browser CORS on fetch(), and
// Pinterest's own servers don't send Access-Control-Allow-Origin headers.
// So a plugin running only inside Figma can never fetch a Pinterest board
// page or its pin-feed API directly — this tiny worker does that fetch
// server-to-server (where CORS doesn't apply) and hands the result back
// with CORS enabled, restricted to *.pinterest.com targets only so it
// can't be abused as an open proxy.
//
// Deploy: paste this file into a new Cloudflare Worker (free tier is
// plenty — see README.md "Deploy your own proxy"). Then put the worker's
// URL into src/config.ts as PINTEREST_PROXY_URL and rebuild the plugin.

const ALLOWED_HOST = /(^|\.)pinterest\.com$/i;

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

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing "url" query parameter', { status: 400, headers: corsHeaders() });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid "url" query parameter', { status: 400, headers: corsHeaders() });
    }

    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOST.test(targetUrl.hostname)) {
      return new Response('Only https://*.pinterest.com URLs are allowed', {
        status: 403,
        headers: corsHeaders(),
      });
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
      });
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err}`, { status: 502, headers: corsHeaders() });
    }

    const body = await upstream.arrayBuffer();
    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store');

    return new Response(body, { status: upstream.status, headers });
  },
};
