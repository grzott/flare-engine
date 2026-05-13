import { Color } from '@flare-engine/math';

/** Convert a CSS hex color ('#RRGGBB' or '#RRGGBBAA') to a 32-bit ARGB integer. */
export function hexToArgb(hex: string): number {
  return Color.toSkColor(Color.fromHex(hex));
}
