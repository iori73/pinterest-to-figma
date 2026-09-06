import { BoardImportOptions, PinItem, MAX_PINS, ImportSelection, BoardMeta } from '../types';
import { PINTEREST_PROXY_URL } from '../config';

interface RawPinImage {
  url: string;
  width: number;
  height: number;
}

interface RawPin {
  id: string;
  type: string;
  images?: Record<string, RawPinImage>;
  dominant_color?: string;
  grid_title?: string;
  title?: string;
  board_section?: { id: string; title: string } | null;
  carousel_data?: { carousel_slots: Array<{ images: Record<string, RawPinImage> }> } | null;
}

interface ParsedBoardUrl {
  hostname: string;
  username: string;
  slug: string;
  boardUrlPath: string;
}

interface RawBoard {
  name?: string;
  pin_count?: number;
}

// Figma's plugin sandbox enforces standard browser CORS on fetch(), and
// Pinterest's servers don't send CORS headers, so every request to
// pinterest.com is routed through our own proxy (see worker/pinterest-proxy.js)
// which fetches it server-to-server and adds CORS headers to the response.
function proxied(targetUrl: string): string {
  return `${PINTEREST_PROXY_URL}/?url=${encodeURIComponent(targetUrl)}`;
}

function proxiedColors(imageUrl: string): string {
  return `${PINTEREST_PROXY_URL}/?colors=${encodeURIComponent(imageUrl)}`;
}

export interface ColorSegment {
  hex: string;
  percent: number;
}

// Asks the proxy to decode a tiny thumbnail of this image and return its
// top-5 dominant colors with each one's real share of the image (see
// worker/color-quantize.js). Returns null on any failure — a non-JPEG
// thumbnail, a network error, or the proxy exceeding Cloudflare's free-tier
// CPU budget — so the caller can fall back to Pinterest's own single
// dominant_color instead.
export async function fetchColorDistribution(imageUrl: string): Promise<ColorSegment[] | null> {
  try {
    const res = await fetch(proxiedColors(imageUrl));
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.colors) || json.colors.length === 0) return null;
    return json.colors;
  } catch {
    return null;
  }
}

// Figma's plugin sandbox (where this runs) doesn't reliably provide the
// WHATWG URL class, so this is parsed by hand instead of `new URL(...)`.
export function parseBoardUrl(input: string): ParsedBoardUrl | null {
  const trimmed = input.trim();
  const match = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(trimmed);
  if (!match) return null;

  let hostname = match[1].toLowerCase();
  const pathname = match[2] || '';
  // Anchored so "pinterest.evil.com" or "notpinterest.com" can't slip
  // through as if they were a real Pinterest host — matches the worker's
  // own allowlist check (worker/pinterest-proxy.js) for consistency.
  if (!/(^|\.)pinterest\.com$/i.test(hostname)) return null;

  // Bare "pinterest.com" (no subdomain) defaults to www; locale subdomains
  // like jp.pinterest.com / fr.pinterest.com are kept as-is, since Pinterest
  // geo-redirects www -> a locale host anyway and the board data lives there.
  if (hostname === 'pinterest.com') hostname = 'www.pinterest.com';

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const [username, slug] = parts;
  return { hostname, username, slug, boardUrlPath: `/${username}/${slug}/` };
}

async function fetchBoardHtml(hostname: string, boardUrlPath: string): Promise<string> {
  const res = await fetch(proxied(`https://${hostname}${boardUrlPath}`));
  if (!res.ok) {
    throw new Error(`Could not open this board (HTTP ${res.status}). Check that the URL is public.`);
  }
  return res.text();
}

async function fetchBoardPage(
  hostname: string,
  boardId: string,
  boardUrlPath: string,
  bookmark: string | null,
  pageSize = 25
): Promise<{ pins: RawPin[]; bookmark: string | null }> {
  const options: Record<string, unknown> = {
    board_id: boardId,
    board_url: boardUrlPath,
    field_set_key: 'react_grid_pin',
    filter_section_pins: true,
    page_size: pageSize,
  };
  if (bookmark) options.bookmarks = [bookmark];

  const data = encodeURIComponent(JSON.stringify({ options, context: {} }));
  const res = await fetch(proxied(`https://${hostname}/resource/BoardFeedResource/get/?data=${data}`));
  if (!res.ok) {
    throw new Error(`Pinterest API error (HTTP ${res.status}). It may be rate-limiting this request.`);
  }

  const json = await res.json();
  const resourceResponse = json?.resource_response ?? {};
  const pins: RawPin[] = (resourceResponse.data ?? []).filter(
    (pin: RawPin | null): pin is RawPin => !!pin && pin.type === 'pin' && !!pin.images
  );
  return { pins, bookmark: resourceResponse.bookmark ?? null };
}

function assertProxyConfigured() {
  if (!PINTEREST_PROXY_URL || PINTEREST_PROXY_URL.includes('REPLACE-ME')) {
    throw new Error(
      'No proxy configured. Deploy worker/pinterest-proxy.js (see README.md "Deploy your own proxy"), then set PINTEREST_PROXY_URL in src/config.ts and rebuild.'
    );
  }
}

function assertParsedBoardUrl(boardUrlInput: string): ParsedBoardUrl {
  const parsed = parseBoardUrl(boardUrlInput);
  if (!parsed) {
    throw new Error(
      "That doesn't look like a Pinterest board URL, e.g. https://www.pinterest.com/username/board-name/ (your country's Pinterest domain also works)"
    );
  }
  return parsed;
}

interface InitialBoardState {
  parsed: ParsedBoardUrl;
  boardId: string;
  board: RawBoard;
  initialPins: RawPin[];
  initialBookmark: string | null;
}

// Fetches the board page HTML once and pulls out everything both
// fetchBoardMeta and fetchAllPins need, so the page is only fetched once
// even when a caller wants both the pin count and the pins themselves.
async function loadInitialBoardState(boardUrlInput: string): Promise<InitialBoardState> {
  assertProxyConfigured();
  const parsed = assertParsedBoardUrl(boardUrlInput);

  const html = await fetchBoardHtml(parsed.hostname, parsed.boardUrlPath);
  const propsMatch = html.match(
    /<script id="__PWS_INITIAL_PROPS__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!propsMatch) {
    throw new Error('Could not read this board. It may be private, empty, or Pinterest changed its page format.');
  }

  let initialProps: any;
  try {
    initialProps = JSON.parse(propsMatch[1]);
  } catch {
    throw new Error("Could not parse Pinterest's board data.");
  }

  const state = initialProps?.initialReduxState ?? {};
  const boards = state.boards ?? {};
  const boardId = Object.keys(boards)[0];
  if (!boardId) {
    throw new Error('Could not find a board on this page. Double check the URL points to a board, not a single pin.');
  }
  const board: RawBoard = boards[boardId] ?? {};

  const boardFeedResources = state.resources?.BoardFeedResource ?? {};
  const feedKey = Object.keys(boardFeedResources)[0];
  const feedEntry = feedKey ? boardFeedResources[feedKey] : null;

  const initialPins: RawPin[] = (feedEntry?.data ?? []).filter(
    (pin: RawPin | null): pin is RawPin => !!pin && pin.type === 'pin' && !!pin.images
  );

  return { parsed, boardId, board, initialPins, initialBookmark: feedEntry?.bookmark ?? null };
}

// Fetches just enough to show the user the board's total pin count before
// they commit to importing anything.
export async function fetchBoardMeta(boardUrlInput: string): Promise<BoardMeta> {
  const { parsed, board } = await loadInitialBoardState(boardUrlInput);
  return {
    pinCount: typeof board.pin_count === 'number' ? board.pin_count : 0,
    boardName: board.name || parsed.slug,
  };
}

export interface FetchPinsCallbacks {
  onProgress?: (found: number) => void;
}

export async function fetchAllPins(
  boardUrlInput: string,
  selection: ImportSelection,
  callbacks: FetchPinsCallbacks = {}
): Promise<RawPin[]> {
  const { parsed, boardId, initialPins, initialBookmark } = await loadInitialBoardState(boardUrlInput);

  let pins = initialPins;
  let bookmark = initialBookmark;
  callbacks.onProgress?.(pins.length);

  // "Newest N" can stop as soon as we have enough — cheaper than a full
  // scan. "Oldest N" and "All" both need to walk the whole board (capped
  // at MAX_PINS) since we don't know where the tail is until we get there.
  const canStopEarly = selection.direction === 'newest' && selection.count != null;

  while (bookmark && pins.length < MAX_PINS) {
    if (canStopEarly && pins.length >= (selection.count as number)) break;
    const page = await fetchBoardPage(parsed.hostname, boardId, parsed.boardUrlPath, bookmark);
    pins = pins.concat(page.pins);
    bookmark = page.bookmark;
    callbacks.onProgress?.(pins.length);
  }

  const bounded = pins.slice(0, MAX_PINS);
  if (selection.count == null) return bounded; // "All" — direction is irrelevant to the same full set
  return selection.direction === 'newest' ? bounded.slice(0, selection.count) : bounded.slice(-selection.count);
}

function pickImage(images: Record<string, RawPinImage>, fullSize: boolean): RawPinImage | null {
  if (fullSize && images.orig) return images.orig;
  return images['736x'] || images['474x'] || images['236x'] || images.orig || null;
}

export function mapPinsToItems(pins: RawPin[], options: BoardImportOptions): PinItem[] {
  const items: PinItem[] = [];

  for (const pin of pins) {
    const title = pin.grid_title || pin.title || undefined;
    const sourceUrl = options.addSourceLink ? `https://www.pinterest.com/pin/${pin.id}/` : undefined;
    const sectionTitle = options.preserveSections ? pin.board_section?.title : undefined;
    const dominantColor = options.addDominantColor ? pin.dominant_color : undefined;

    const slots =
      options.importCarousel && pin.carousel_data?.carousel_slots?.length
        ? pin.carousel_data.carousel_slots
        : [{ images: pin.images! }];

    slots.forEach((slot, index) => {
      const image = pickImage(slot.images, options.importFullSize);
      if (!image) return;
      items.push({
        id: slots.length > 1 ? `${pin.id}-${index}` : pin.id,
        imageUrl: image.url,
        width: image.width,
        height: image.height,
        sourceUrl,
        title,
        dominantColor,
        sectionTitle,
      });
    });
  }

  return items;
}
