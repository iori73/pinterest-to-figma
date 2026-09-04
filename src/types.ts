// A single image ready to be placed onto the canvas
export interface PinItem {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  title?: string;
  dominantColor?: string; // hex, e.g. "#E8E8E8"
  sectionTitle?: string;
}

// Feature toggles mirroring the reference plugin's "Settings" panel,
// all available for free (no gating, no credits).
export interface BoardImportOptions {
  preserveSections: boolean;
  addDominantColor: boolean;
  importFullSize: boolean;
  importCarousel: boolean;
  addSourceLink: boolean;
}

export const DEFAULT_OPTIONS: BoardImportOptions = {
  preserveSections: false,
  addDominantColor: false,
  importFullSize: false,
  importCarousel: false,
  addSourceLink: true,
};

// Layout options for arranging imported pins
export interface LayoutOptions {
  columns: number;
  gap: number;
  frameWidth: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  columns: 4,
  gap: 24,
  frameWidth: 1200,
};

// A safety cap so a huge board can't hang Figma or blow past image-node limits.
export const MAX_PINS = 500;

// Messages sent from the plugin sandbox (code.ts) to the UI (ui.tsx)
export type MessageToUI =
  | { type: 'fetch-progress'; found: number }
  | { type: 'import-progress'; completed: number; total: number }
  | { type: 'import-complete'; imported: number; failed: number; truncated: boolean }
  | { type: 'error'; message: string };

// Messages sent from the UI (ui.tsx) to the plugin sandbox (code.ts)
export type MessageToPlugin =
  | { type: 'import-board'; boardUrl: string; options: BoardImportOptions; layout: LayoutOptions }
  | { type: 'cancel-import' };
