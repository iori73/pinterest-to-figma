// Set this to your deployed Cloudflare Worker URL (see worker/pinterest-proxy.js
// and README.md "Deploy your own proxy"). Figma's plugin sandbox enforces
// browser CORS on fetch(), and Pinterest's servers don't send CORS headers,
// so board/pin data must be fetched through this proxy rather than directly.
//
// Example: 'https://pinterest-to-figma-proxy.your-subdomain.workers.dev'
export const PINTEREST_PROXY_URL = 'https://pinterest-to-figma.iori730002204294.workers.dev';
