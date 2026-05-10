// Returns raw RGBA bytes for a 4096×64 identity LUT strip. The host wraps
// this via Skia.MakeImage into an SkImage to pass as the lut child texture.
export function createNeutralLutBytes(): Uint8Array {
  const buf = new Uint8Array(4096 * 64 * 4);
  for (let b = 0; b < 64; b++) {
    for (let g = 0; g < 64; g++) {
      for (let r = 0; r < 64; r++) {
        const x = b * 64 + r;
        const y = g;
        const off = (y * 4096 + x) * 4;
        buf[off] = Math.round((r / 63) * 255);
        buf[off + 1] = Math.round((g / 63) * 255);
        buf[off + 2] = Math.round((b / 63) * 255);
        buf[off + 3] = 255;
      }
    }
  }
  return buf;
}
