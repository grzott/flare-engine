import { clamp } from './scalar.js';

/** RGBA color with components normalized to 0-1. */
export type Color = { r: number; g: number; b: number; a: number };

/** OKLab perceptual color space (L 0-1, a and b unbounded in practice ±0.5). */
export type Oklab = { L: number; a: number; b: number };

/** OKLCH polar form of OKLab (L 0-1, C >= 0, h degrees [0,360)). */
export type Oklch = { L: number; C: number; h: number };

/**
 * Converts a single sRGB channel to linear light.
 * The 0.04045 threshold (modern WCAG errata) is numerically identical to the
 * older 0.03928 for 8-bit inputs and is shared by OKLab and WCAG luminance.
 */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Converts a single linear-light channel back to sRGB. */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

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

  /** Converts sRGB Color to OKLab. Alpha is dropped. */
  toOklab(c: Color): Oklab {
    const rl = srgbToLinear(c.r);
    const gl = srgbToLinear(c.g);
    const bl = srgbToLinear(c.b);

    const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
    const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
    const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return {
      L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    };
  },

  /**
   * Converts OKLab to sRGB Color. Out-of-gamut results are clamped to [0,1];
   * round-trips are exact only for in-gamut colors.
   */
  fromOklab(lab: Oklab, alpha = 1): Color {
    const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;

    const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    return {
      r: clamp(linearToSrgb(rl), 0, 1),
      g: clamp(linearToSrgb(gl), 0, 1),
      b: clamp(linearToSrgb(bl), 0, 1),
      a: alpha,
    };
  },

  /** Converts sRGB Color to OKLCH (polar OKLab). Achromatic colors get h = 0. */
  toOklch(c: Color): Oklch {
    const lab = Color.toOklab(c);
    const C = Math.hypot(lab.a, lab.b);
    const h = C < 1e-7 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
    return { L: lab.L, C, h };
  },

  /**
   * Converts OKLCH to sRGB Color. Hue is wrapped via ((h%360)+360)%360.
   * Out-of-gamut results are clamped; round-trips exact only in-gamut.
   */
  fromOklch(lch: Oklch, alpha = 1): Color {
    const hWrapped = ((lch.h % 360) + 360) % 360;
    const hRad = (hWrapped * Math.PI) / 180;
    return Color.fromOklab(
      { L: lch.L, a: lch.C * Math.cos(hRad), b: lch.C * Math.sin(hRad) },
      alpha,
    );
  },

  /** Euclidean distance in OKLab space between two sRGB colors. */
  deltaEOk(a: Color, b: Color): number {
    return Color.deltaEOkLab(Color.toOklab(a), Color.toOklab(b));
  },

  /** Euclidean distance between two OKLab values. */
  deltaEOkLab(a: Oklab, b: Oklab): number {
    return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
  },

  /** WCAG 2.x relative luminance. White = 1, black = 0. */
  relativeLuminance(c: Color): number {
    return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
  },

  /** WCAG 2.x contrast ratio. Order-independent; range [1, 21]. */
  contrastRatio(fg: Color, bg: Color): number {
    const l1 = Color.relativeLuminance(fg);
    const l2 = Color.relativeLuminance(bg);
    const lMax = Math.max(l1, l2);
    const lMin = Math.min(l1, l2);
    return (lMax + 0.05) / (lMin + 0.05);
  },
} as const;
