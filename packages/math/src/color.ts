import { clamp } from './scalar.js';

/** RGBA color with components normalized to 0-1. */
export type Color = { r: number; g: number; b: number; a: number };

export const Color = {
  WHITE: { r: 1, g: 1, b: 1, a: 1 } as Color,
  BLACK: { r: 0, g: 0, b: 0, a: 1 } as Color,
  TRANSPARENT: { r: 0, g: 0, b: 0, a: 0 } as Color,

  /** Creates a Color from normalized 0-1 components. */
  create(r = 0, g = 0, b = 0, a = 1): Color {
    return { r, g, b, a };
  },

  /** Parses a hex string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA). */
  fromHex(hex: string): Color {
    // Strip leading #
    let h = hex.startsWith('#') ? hex.slice(1) : hex;

    if (h.length === 3) {
      h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
    } else if (h.length === 4) {
      h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! + h[3]! + h[3]!;
    }

    const r = Number.parseInt(h.slice(0, 2), 16) / 255;
    const g = Number.parseInt(h.slice(2, 4), 16) / 255;
    const b = Number.parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  },

  /** Converts to hex string #RRGGBB or #RRGGBBAA if alpha < 1. */
  toHex(c: Color): string {
    const r = Math.round(clamp(c.r, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(clamp(c.g, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(clamp(c.b, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
    if (c.a < 1) {
      const a = Math.round(clamp(c.a, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0');
      return `#${r}${g}${b}${a}`;
    }
    return `#${r}${g}${b}`;
  },

  /** Linearly interpolates between two colors. */
  lerp(a: Color, b: Color, t: number): Color {
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
      a: a.a + (b.a - a.a) * t,
    };
  },

  /** Component-wise multiplication. */
  multiply(a: Color, b: Color): Color {
    return {
      r: a.r * b.r,
      g: a.g * b.g,
      b: a.b * b.b,
      a: a.a * b.a,
    };
  },

  /**
   * Converts to a Skia-compatible color number (0xAARRGGBB).
   * Compatible with @shopify/react-native-skia Skia.Color() format.
   */
  toSkColor(c: Color): number {
    const r = Math.round(clamp(c.r, 0, 1) * 255) & 0xff;
    const g = Math.round(clamp(c.g, 0, 1) * 255) & 0xff;
    const b = Math.round(clamp(c.b, 0, 1) * 255) & 0xff;
    const a = Math.round(clamp(c.a, 0, 1) * 255) & 0xff;
    return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  },
} as const;
