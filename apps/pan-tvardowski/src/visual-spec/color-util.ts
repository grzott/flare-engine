/**
 * Converts a #RRGGBB hex string to a 32-bit ARGB integer with alpha = 0xff.
 * Case-insensitive. Equivalent to `(0xff000000 | parseInt(hex.slice(1), 16)) >>> 0`.
 */
export function hexToArgb(hex: string): number {
  const rgb = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(rgb)) throw new Error(`hexToArgb: malformed hex string "${hex}"`);
  return (0xff000000 | rgb) >>> 0;
}

export interface Rgba01 {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Converts a #RRGGBB hex string from THEME_SPEC.colors into the
 * normalized {r,g,b,a} tuple expected by render-package shader factories.
 * Alpha defaults to 1; pass an alpha override for translucent fog/foam.
 */
export function hexToRgba01(hex: string, alpha?: number): Rgba01 {
  const match = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex);
  if (!match) throw new Error(`hexToRgba01: malformed hex string "${hex}"`);
  const a = alpha !== undefined ? Math.max(0, Math.min(1, alpha)) : 1;
  return {
    r: Number.parseInt(match[1] as string, 16) / 255,
    g: Number.parseInt(match[2] as string, 16) / 255,
    b: Number.parseInt(match[3] as string, 16) / 255,
    a,
  };
}
