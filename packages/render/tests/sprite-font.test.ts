import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';
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

const GRIN = 0x1f600; // U+1F600, two UTF-16 units
const GRIN_LOW16 = 0xf600; // the BMP id sharing GRIN's low 16 bits

function makeAstralFontJSON(kernings: Array<{ first: number; second: number; amount: number }>) {
  const json = makeFontJSON();
  json.chars.push(
    { id: GRIN, x: 30, y: 0, width: 14, height: 16, xoffset: 2, yoffset: 0, xadvance: 15 },
    { id: GRIN_LOW16, x: 44, y: 0, width: 8, height: 16, xoffset: 0, yoffset: 0, xadvance: 9 },
  );
  json.kernings = kernings;
  return json;
}

describe('SpriteFont', () => {
  describe('astral glyph ids', () => {
    const grin = String.fromCodePoint(GRIN);

    it('measureText counts the advance of an astral glyph', () => {
      const font = parseBMFontJSON(makeAstralFontJSON([]));
      expect(measureText(font, grin)).toBe(15);
      // grin = 15, 'A' = 12
      expect(measureText(font, `${grin}A`)).toBe(27);
      expect(measureText(font, `A${grin}B`)).toBe(38);
    });

    it('drawText issues one draw for an astral glyph', () => {
      const font = parseBMFontJSON(makeAstralFontJSON([]));
      const batch = new SpriteBatch();

      drawText(batch, font, mockImage(), `${grin}A`, 10, 20);
      expect(batch.count).toBe(2);

      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.srcX).toBe(30);
      expect(commands[0]?.dstX).toBeCloseTo(12); // x + xoffset 2
      expect(commands[0]?.dstW).toBe(14);
      // 'A' follows the grin advance: 10 + 15
      expect(commands[1]?.srcX).toBe(0);
      expect(commands[1]?.dstX).toBeCloseTo(25);
    });

    it('applies kerning for an astral pair', () => {
      const font = parseBMFontJSON(
        makeAstralFontJSON([
          { first: GRIN, second: 65, amount: -3 },
          { first: 65, second: GRIN, amount: -2 },
        ]),
      );
      expect(getKerning(font, GRIN, 65)).toBe(-3);
      expect(getKerning(font, 65, GRIN)).toBe(-2);
      // 15 - 3 + 12
      expect(measureText(font, `${grin}A`)).toBe(24);
      // 12 - 2 + 15
      expect(measureText(font, `A${grin}`)).toBe(25);

      const batch = new SpriteBatch();
      drawText(batch, font, mockImage(), `${grin}A`, 0, 0);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[1]?.dstX).toBeCloseTo(12);
    });

    it('does not alias an astral pair onto the pair sharing its low 16 bits', () => {
      const font = parseBMFontJSON(
        makeAstralFontJSON([
          { first: GRIN_LOW16, second: 65, amount: -5 },
          { first: 65, second: GRIN_LOW16, amount: -4 },
        ]),
      );
      expect(getKerning(font, GRIN_LOW16, 65)).toBe(-5);
      expect(getKerning(font, GRIN, 65)).toBe(0);
      expect(getKerning(font, 65, GRIN)).toBe(0);
      expect(measureText(font, `${grin}A`)).toBe(27);
      // the BMP pair itself still kerns: 9 - 5 + 12
      expect(measureText(font, `${String.fromCodePoint(GRIN_LOW16)}A`)).toBe(16);
    });

    it('keeps both pairs apart when a font kerns each', () => {
      const font = parseBMFontJSON(
        makeAstralFontJSON([
          { first: GRIN_LOW16, second: 65, amount: -5 },
          { first: GRIN, second: 65, amount: -3 },
        ]),
      );
      expect(font.kernings.size).toBe(2);
      expect(getKerning(font, GRIN_LOW16, 65)).toBe(-5);
      expect(getKerning(font, GRIN, 65)).toBe(-3);
    });
  });

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
