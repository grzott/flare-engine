import type { FractureMesh, ShardPacking } from './types';

/**
 * Lay the sized rects of `out` on shelves `atlasW` wide, tallest first, writing each x and y and
 * the size used to `out.atlasW` and `out.atlasH`. An x of NaN marks a rect not placed yet, which
 * is what lets the tallest-first order be found without a sorted copy.
 */
function shelve(count: number, padding: number, atlasW: number, out: ShardPacking): void {
  const rects = out.rects;
  for (let i = 0; i < count; i++) rects[i * 4] = Number.NaN;
  let x = padding;
  let y = padding;
  let shelfH = 0;
  let usedW = 0;
  for (let placed = 0; placed < count; placed++) {
    let tallest = -1;
    let tallestH = -1;
    for (let i = 0; i < count; i++) {
      if (Number.isNaN(rects[i * 4]!) && rects[i * 4 + 3]! > tallestH) {
        tallest = i;
        tallestH = rects[i * 4 + 3]!;
      }
    }
    const w = rects[tallest * 4 + 2]!;
    if (x > padding && x + w + padding > atlasW) {
      x = padding;
      y += shelfH + padding;
      shelfH = 0;
    }
    // The first rect on a shelf is its tallest, so it alone sets the shelf height.
    if (shelfH === 0) shelfH = tallestH;
    rects[tallest * 4] = x;
    rects[tallest * 4 + 1] = y;
    x += w + padding;
    if (x > usedW) usedW = x;
  }
  out.atlasW = usedW;
  out.atlasH = y + shelfH + padding;
}

/**
 * Pack each piece's bounding box into a shard atlas, writing into `out`: a shelf packer, tallest
 * pieces first. `out.rects` gets x, y, w, h per piece in whole atlas pixels, with `padding`
 * pixels clear between rects and around the atlas edge. When the atlas would be larger than
 * `maxAtlas` on either side, `scale` halves from 1 until it fits, so a rect is its piece's
 * bounding box times `scale`, rounded up.
 *
 * Throws a `RangeError` when `out.rects` holds fewer than 4 numbers per piece, the padding is
 * negative or not finite, or the pieces do not fit `maxAtlas` even at one pixel each.
 */
export function packShardsInto(
  mesh: FractureMesh,
  widthPx: number,
  heightPx: number,
  padding = 2,
  maxAtlas = 2048,
  out: ShardPacking,
): ShardPacking {
  const count = mesh.count;
  const rects = out.rects;
  if (rects.length < count * 4) {
    throw new RangeError(
      `packShardsInto: out.rects needs ${count * 4} numbers for ${count} pieces, got ${rects.length}`,
    );
  }
  if (!(padding >= 0) || !Number.isFinite(padding)) {
    throw new RangeError(`packShardsInto: padding must be a finite number >= 0, got ${padding}`);
  }
  const bounds = mesh.bounds;
  for (let scale = 1; ; scale /= 2) {
    let widest = 0;
    let tallest = 0;
    let area = 0;
    for (let i = 0; i < count; i++) {
      // Bounds are Float32, so a whole number of pixels can read a hair over; the slack keeps
      // that from costing a pixel.
      const w = Math.max(
        1,
        Math.ceil((bounds[i * 4 + 2]! - bounds[i * 4]!) * widthPx * scale - 1e-3),
      );
      const h = Math.max(
        1,
        Math.ceil((bounds[i * 4 + 3]! - bounds[i * 4 + 1]!) * heightPx * scale - 1e-3),
      );
      rects[i * 4 + 2] = w;
      rects[i * 4 + 3] = h;
      if (w > widest) widest = w;
      if (h > tallest) tallest = h;
      area += (w + padding) * (h + padding);
    }
    if (widest + 2 * padding <= maxAtlas) {
      // A near-square atlas first; the full width only when that comes out too tall.
      const square = Math.max(widest + 2 * padding, Math.ceil(Math.sqrt(area)) + padding);
      shelve(count, padding, Math.min(maxAtlas, square), out);
      if (out.atlasH > maxAtlas && square < maxAtlas) shelve(count, padding, maxAtlas, out);
      if (out.atlasH <= maxAtlas) {
        out.scale = scale;
        return out;
      }
    }
    if (widest === 1 && tallest === 1) {
      throw new RangeError(
        `packShardsInto: ${count} pieces do not fit an atlas of ${maxAtlas} px at any scale`,
      );
    }
  }
}
