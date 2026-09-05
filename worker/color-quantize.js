// Reduces a decoded RGBA image to its top-K dominant colors with their
// share of pixels, for rendering as a proportional distribution bar.
//
// Approach: bucket each pixel by rounding R/G/B down to 5 bits (32 levels
// per channel), count pixels per bucket, then take the top K buckets and
// report each one's *actual* average color (not just the bucket's
// rounded corner) so the swatches look natural rather than banded.

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
  const countedPixels = sorted.reduce((sum, b) => sum + b.count, 0);

  return top.map((bucket) => ({
    hex: `#${toHex(bucket.rSum / bucket.count)}${toHex(bucket.gSum / bucket.count)}${toHex(bucket.bSum / bucket.count)}`,
    percent: Math.round((bucket.count / countedPixels) * 1000) / 10, // one decimal place
  }));
}
