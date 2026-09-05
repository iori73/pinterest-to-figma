import { MessageToUI, MessageToPlugin, PinItem, LayoutOptions, BoardImportOptions, MAX_PINS } from './types';
import { computeCellPosition } from './utils/grid';
import { fetchAllPins, mapPinsToItems, fetchColorDistribution, ColorSegment } from './utils/pinterest';
import { hexToRgb } from './utils/color';

const COLOR_BAR_HEIGHT = 8;
const COLOR_BAR_GAP = 6;

figma.showUI(__html__, {
  width: 340,
  height: 560,
  themeColors: true,
});

let cancelled = false;

function send(message: MessageToUI) {
  figma.ui.postMessage(message);
}

// Renders a horizontal stacked bar of color segments left-to-right, each
// segment's width proportional to its share of the image. Segments don't
// necessarily sum to 100% (only the top 5 colors are kept) — the remainder
// is simply left unfilled rather than padded out with a fabricated "other" color.
function renderColorBar(
  parent: FrameNode,
  segments: ColorSegment[],
  x: number,
  y: number,
  totalWidth: number,
  labelPrefix: string
) {
  let cursorX = x;
  for (const segment of segments) {
    const rgb = hexToRgb(segment.hex);
    if (!rgb) continue;
    const width = (segment.percent / 100) * totalWidth;
    if (width < 0.5) continue;

    const bar = figma.createRectangle();
    bar.name = `${labelPrefix} — ${segment.hex} (${segment.percent}%)`;
    bar.resize(width, COLOR_BAR_HEIGHT);
    bar.x = cursorX;
    bar.y = y;
    bar.fills = [{ type: 'SOLID', color: rgb }];
    parent.appendChild(bar);

    cursorX += width;
  }
}

async function layoutSection(
  title: string,
  items: PinItem[],
  layout: LayoutOptions,
  origin: { x: number; y: number },
  onItemDone: (failed: boolean) => void
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = title;
  frame.layoutMode = 'NONE';
  frame.x = origin.x;
  frame.y = origin.y;
  frame.resize(layout.frameWidth, 100);

  const rowHeights: number[] = [];

  for (let i = 0; i < items.length; i++) {
    if (cancelled) break;
    const pin = items[i];

    const wantsColorBar = !!pin.dominantColor;

    try {
      const [image, colorSegments] = await Promise.all([
        figma.createImageAsync(pin.imageUrl),
        wantsColorBar ? fetchColorDistribution(pin.imageUrl) : Promise.resolve(null),
      ]);

      const cellPosition = computeCellPosition(i, layout, rowHeights);
      const scale = cellPosition.width / pin.width;
      const cellHeight = pin.height * scale;
      const extraHeight = wantsColorBar ? COLOR_BAR_GAP + COLOR_BAR_HEIGHT : 0;

      const row = Math.floor(i / layout.columns);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, cellHeight + extraHeight);

      const rect = figma.createRectangle();
      rect.name = pin.title || `Pin ${i + 1}`;
      rect.resize(cellPosition.width, cellHeight);
      rect.x = cellPosition.x;
      rect.y = cellPosition.y;
      rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];

      if (pin.sourceUrl) {
        rect.setPluginData('sourceUrl', pin.sourceUrl);
        try {
          (rect as unknown as { hyperlink: HyperlinkTarget | null }).hyperlink = {
            type: 'URL',
            value: pin.sourceUrl,
          };
        } catch {
          // Older @figma/plugin-typings / editor combinations may not support hyperlinks; plugin data above still records it.
        }
      }

      frame.appendChild(rect);

      if (wantsColorBar) {
        // Real per-image color proportions when the proxy could compute
        // them; otherwise fall back to Pinterest's single dominant_color
        // as one full-width segment, so the bar is never just missing.
        const segments: ColorSegment[] = colorSegments ?? (pin.dominantColor ? [{ hex: pin.dominantColor, percent: 100 }] : []);
        renderColorBar(frame, segments, cellPosition.x, cellPosition.y + cellHeight + COLOR_BAR_GAP, cellPosition.width, rect.name);
      }
    } catch {
      // Skip pins whose image failed to load (deleted, private, or unsupported format).
      onItemDone(true);
      continue;
    }

    onItemDone(false);
  }

  const totalHeight = rowHeights.reduce((sum, h) => sum + h + layout.gap, -layout.gap);
  frame.resize(layout.frameWidth, Math.max(totalHeight, 1));
  return frame;
}

async function importBoard(boardUrl: string, options: BoardImportOptions, layout: LayoutOptions) {
  cancelled = false;

  try {
    const rawPins = await fetchAllPins(boardUrl, {
      onProgress: (found) => send({ type: 'fetch-progress', found }),
    });

    if (rawPins.length === 0) {
      send({ type: 'error', message: 'No pins found on this board.' });
      return;
    }

    const items = mapPinsToItems(rawPins, options);
    const total = items.length;
    let processed = 0;
    let failedCount = 0;

    const onItemDone = (failed: boolean) => {
      processed++;
      if (failed) failedCount++;
      send({ type: 'import-progress', completed: processed, total });
    };

    const sections = new Map<string, PinItem[]>();
    for (const item of items) {
      const key = item.sectionTitle || 'Pinterest Import';
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(item);
    }

    const createdFrames: FrameNode[] = [];
    let cursorY = figma.viewport.center.y;
    const originX = figma.viewport.center.x - layout.frameWidth / 2;

    for (const [title, sectionItems] of sections) {
      if (cancelled) break;
      const frame = await layoutSection(title, sectionItems, layout, { x: originX, y: cursorY }, onItemDone);
      createdFrames.push(frame);
      cursorY += frame.height + layout.gap * 2;
    }

    if (createdFrames.length > 0) {
      figma.currentPage.selection = createdFrames;
      figma.viewport.scrollAndZoomIntoView(createdFrames);
    }

    send({
      type: 'import-complete',
      imported: processed - failedCount,
      failed: failedCount,
      truncated: rawPins.length >= MAX_PINS,
    });
  } catch (err) {
    send({ type: 'error', message: describeError(err) });
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json;
    } catch {
      // fall through
    }
    const anyErr = err as { message?: unknown; name?: unknown; toString?: () => string };
    if (typeof anyErr.message === 'string') return anyErr.message;
    if (typeof anyErr.name === 'string') return `${anyErr.name}: request failed (likely blocked by the plugin's network access permissions)`;
  }
  return String(err);
}

figma.ui.onmessage = async (message: MessageToPlugin) => {
  switch (message.type) {
    case 'import-board':
      await importBoard(message.boardUrl, message.options, message.layout);
      break;
    case 'cancel-import':
      cancelled = true;
      break;
  }
};
