import { LayoutOptions } from '../types';

export interface CellPosition {
  x: number;
  y: number;
  width: number;
}

// Compute a simple fixed-column grid position for the nth item.
// Row height is decided later once each image's natural aspect ratio is known.
export function computeCellPosition(
  index: number,
  layout: LayoutOptions,
  rowHeights: number[]
): CellPosition {
  const { columns, gap, frameWidth } = layout;
  const cellWidth = (frameWidth - gap * (columns - 1)) / columns;
  const col = index % columns;
  const row = Math.floor(index / columns);

  const x = col * (cellWidth + gap);
  const y = rowHeights.slice(0, row).reduce((sum, h) => sum + h + gap, 0);

  return { x, y, width: cellWidth };
}
