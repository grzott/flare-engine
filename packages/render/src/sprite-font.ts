import type { SkImageLike } from '@flare/assets';
import type { SpriteBatch } from './sprite-batch.js';

/** A single glyph in a bitmap font. */
export interface Glyph {
  /** Character code (Unicode). */
  id: number;
  /** Source rect in the font texture. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Draw offset. */
  xOffset: number;
  yOffset: number;
  /** Horizontal advance after this glyph. */
  xAdvance: number;
}

/** Kerning pair. */
export interface KerningPair {
  first: number;
  second: number;
  amount: number;
}

/** Parsed bitmap font data. */
export interface BitmapFont {
  /** Line height in pixels. */
  lineHeight: number;
  /** Baseline offset. */
  base: number;
  /** Glyph map by character code. */
  glyphs: Map<number, Glyph>;
  /** Kerning map. Key = `first << 16 | second`. */
  kernings: Map<number, number>;
}

/**
 * Parse BMFont JSON format (common output from tools like Hiero, BMFont, msdf-bmfont).
 */
export function parseBMFontJSON(json: unknown): BitmapFont {
  const data = json as {
    common: { lineHeight: number; base: number };
    chars: Array<{
      id: number;
      x: number;
      y: number;
      width: number;
      height: number;
      xoffset: number;
      yoffset: number;
      xadvance: number;
    }>;
    kernings?: Array<{ first: number; second: number; amount: number }>;
  };

  const glyphs = new Map<number, Glyph>();
  for (const c of data.chars) {
    glyphs.set(c.id, {
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      xOffset: c.xoffset,
      yOffset: c.yoffset,
      xAdvance: c.xadvance,
    });
  }

  const kernings = new Map<number, number>();
  if (data.kernings) {
    for (const k of data.kernings) {
      kernings.set((k.first << 16) | k.second, k.amount);
    }
  }

  return {
    lineHeight: data.common.lineHeight,
    base: data.common.base,
    glyphs,
    kernings,
  };
}

/** Get kerning between two characters. */
export function getKerning(font: BitmapFont, first: number, second: number): number {
  return font.kernings.get((first << 16) | second) ?? 0;
}

/** Measure the width of a text string in pixels. */
export function measureText(font: BitmapFont, text: string): number {
  let width = 0;
  let prevCode = -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const glyph = font.glyphs.get(code);
    if (!glyph) continue;
    if (prevCode >= 0) {
      width += getKerning(font, prevCode, code);
    }
    width += glyph.xAdvance;
    prevCode = code;
  }
  return width;
}

/**
 * Draw text using a SpriteBatch.
 * Characters are batched as individual sprites from the font texture.
 */
export function drawText(
  batch: SpriteBatch,
  font: BitmapFont,
  image: SkImageLike,
  text: string,
  x: number,
  y: number,
  scale = 1,
): void {
  let cursorX = x;
  let prevCode = -1;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const glyph = font.glyphs.get(code);
    if (!glyph) continue;

    if (prevCode >= 0) {
      cursorX += getKerning(font, prevCode, code) * scale;
    }

    batch.drawRaw(
      image,
      glyph.x,
      glyph.y,
      glyph.width,
      glyph.height,
      cursorX + glyph.xOffset * scale,
      y + glyph.yOffset * scale,
      glyph.width * scale,
      glyph.height * scale,
    );

    cursorX += glyph.xAdvance * scale;
    prevCode = code;
  }
}
