import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import { SpriteBatch } from '../src/sprite-batch.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { drawText, getKerning, measureText, parseBMFontJSON } from '../src/sprite-font.js';

function mockImage(): SkImageLike {
  return { width: () => 256, height: () => 256, readPixels: () => null };
}

function makeFontJSON() {
  return {
    common: { lineHeight: 20, base: 16 },
    chars: [
      {
        id: 65, // 'A'
        x: 0,
        y: 0,
        width: 10,
        height: 16,
        xoffset: 0,
        yoffset: 0,
        xadvance: 12,
      },
      {
        id: 66, // 'B'
        x: 10,
        y: 0,
        width: 10,
        height: 16,
        xoffset: 1,
        yoffset: 0,
        xadvance: 11,
      },
      {
        id: 67, // 'C'
        x: 20,
        y: 0,
        width: 9,
        height: 16,
        xoffset: 0,
        yoffset: 0,
        xadvance: 10,
      },
    ],
    kernings: [{ first: 65, second: 66, amount: -1 }],
  };
}

describe('SpriteFont', () => {
  describe('parseBMFontJSON', () => {
    it('parses font metadata', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(font.lineHeight).toBe(20);
      expect(font.base).toBe(16);
    });

    it('parses glyphs', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(font.glyphs.size).toBe(3);
      const glyphA = font.glyphs.get(65)!;
      expect(glyphA.width).toBe(10);
      expect(glyphA.xAdvance).toBe(12);
    });

    it('parses kernings', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(font.kernings.size).toBe(1);
    });

    it('handles missing kernings', () => {
      const json = {
        common: { lineHeight: 16, base: 12 },
        chars: [],
      };
      const font = parseBMFontJSON(json);
      expect(font.kernings.size).toBe(0);
    });
  });

  describe('getKerning', () => {
    it('returns kerning for known pair', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(getKerning(font, 65, 66)).toBe(-1);
    });

    it('returns 0 for unknown pair', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(getKerning(font, 66, 67)).toBe(0);
    });
  });

  describe('measureText', () => {
    it('measures text width', () => {
      const font = parseBMFontJSON(makeFontJSON());
      // "A" = 12, "B" = 11, kerning(A,B) = -1 → 12 + (-1) + 11 = 22
      expect(measureText(font, 'AB')).toBe(22);
    });

    it('returns 0 for empty string', () => {
      const font = parseBMFontJSON(makeFontJSON());
      expect(measureText(font, '')).toBe(0);
    });

    it('skips unknown characters', () => {
      const font = parseBMFontJSON(makeFontJSON());
      // 'A' = 12, '!' is unknown, 'B' = 11
      expect(measureText(font, 'A!B')).toBe(22);
    });
  });

  describe('drawText', () => {
    it('draws characters via SpriteBatch', () => {
      const font = parseBMFontJSON(makeFontJSON());
      const batch = new SpriteBatch();
      const img = mockImage();

      drawText(batch, font, img, 'ABC', 10, 20);
      expect(batch.count).toBe(3);

      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      // First glyph at x=10
      expect(commands[0]?.dstX).toBeCloseTo(10);
      expect(commands[0]?.dstY).toBeCloseTo(20);
    });

    it('applies scale', () => {
      const font = parseBMFontJSON(makeFontJSON());
      const batch = new SpriteBatch();
      const img = mockImage();

      drawText(batch, font, img, 'A', 0, 0, 2);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.dstW).toBe(20); // 10 * 2
      expect(commands[0]?.dstH).toBe(32); // 16 * 2
    });

    it('applies kerning during draw', () => {
      const font = parseBMFontJSON(makeFontJSON());
      const batch = new SpriteBatch();
      const img = mockImage();

      drawText(batch, font, img, 'AB', 0, 0);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      // A at x=0, advance=12, kern=-1, B offset=1 → B at 12-1+1=12
      expect(commands[1]?.dstX).toBeCloseTo(12);
    });
  });
});
