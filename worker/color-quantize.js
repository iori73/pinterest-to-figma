// Reduces a decoded RGBA image to its top-K dominant colors with their
// share of pixels, for rendering as a proportional distribution bar.
//
// Approach: bucket each pixel by rounding R/G/B down to 5 bits (32 levels
// per channel), count pixels per bucket, then take the top K buckets and
// report each one's *actual* average color (not just the bucket's
// rounded corner) so the swatches look natural rather than banded.
//
// Percentages are each kept color's share *among the top K* (not of the
// whole image), and always sum to exactly 100 — so a bar rendered from
// these segments fills the full width edge-to-edge, matching a normal
// stacked distribution bar, rather than leaving a gap for the untracked
// long tail of minor colors beyond the top K.

const BUCKET_BITS = 5; // 32 levels per channel => cheap, still visually distinct

function toHex(n) {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

export function quantizeTopColors(rgba, width, height, topK = 5) {
  const totalPixels = width * height;
  if (totalPixels === 0) return [];

  const buckets = new Map();

  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 128) continue; // skip transparent pixels

    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const key =
      (r >> BUCKET_BITS) * 1024 + (g >> BUCKET_BITS) * 32 + (b >> BUCKET_BITS);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
      buckets.set(key, bucket);
    }
    bucket.count++;
    bucket.rSum += r;
    bucket.gSum += g;
    bucket.bSum += b;
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, topK);
  const topPixelCount = top.reduce((sum, b) => sum + b.count, 0);
  if (topPixelCount === 0) return [];

  const colors = top.map((bucket) => ({
    hex: `#${toHex(bucket.rSum / bucket.count)}${toHex(bucket.gSum / bucket.count)}${toHex(bucket.bSum / bucket.count)}`,
    percent: Math.round((bucket.count / topPixelCount) * 1000) / 10, // one decimal place
  }));

  // Rounding each percent independently can leave the total a hair off 100
  // (e.g. 99.9 or 100.1), which would show as a visible gap or overflow in
  // the rendered bar. Nudge the largest segment (colors[0], since `top` is
  // sorted by count descending) to absorb that rounding error.
  const roundedSum = colors.reduce((sum, c) => sum + c.percent, 0);
  const diff = Math.round((100 - roundedSum) * 10) / 10;
  if (colors.length > 0 && diff !== 0) colors[0].percent = Math.round((colors[0].percent + diff) * 10) / 10;

  return colors;
}
