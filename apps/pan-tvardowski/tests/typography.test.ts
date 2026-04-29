import { describe, expect, test } from 'bun:test';
import { fontFamily, typography } from '../src/theme/typography';

describe('fontFamily', () => {
  test('exports 7 family strings', () => {
    expect(fontFamily.serif).toBe('EBGaramond_500Medium');
    expect(fontFamily.serifItalic).toBe('EBGaramond_500Medium_Italic');
    expect(fontFamily.sans).toBe('SourceSans3_400Regular');
    expect(fontFamily.sansSemiBold).toBe('SourceSans3_600SemiBold');
    expect(fontFamily.sansBold).toBe('SourceSans3_700Bold');
    expect(fontFamily.mono).toBe('JetBrainsMono_400Regular');
    expect(fontFamily.monoMedium).toBe('JetBrainsMono_500Medium');
  });
});

type AnyRole = { fontFamily: string; fontSize: number; fontWeight: string };
type WithLineHeight = { lineHeight: number };
type WithLetterSpacing = { letterSpacing: number };

describe('typography type scale', () => {
  const newKeys = [
    'displayXl',
    'displayL',
    'displayM',
    'lede',
    'bodyL',
    'bodyM',
    'bodyS',
    'label',
    'monoHud',
    'monoDebug',
    'smallcap',
  ] as const;
  for (const key of newKeys) {
    test(`${key} has fontFamily + fontSize + fontWeight`, () => {
      const role = (typography as Record<string, AnyRole>)[key] as AnyRole;
      expect(typeof role.fontFamily).toBe('string');
      expect(role.fontFamily.length).toBeGreaterThan(0);
      expect(role.fontSize).toBeGreaterThan(0);
      expect(typeof role.fontWeight).toBe('string');
    });
  }

  test('displayXl lineHeight is 121', () => {
    const all = typography as unknown as Record<string, WithLineHeight>;
    expect(all.displayXl?.lineHeight).toBe(121);
  });

  test('monoHud letterSpacing ~0.26', () => {
    const all = typography as unknown as Record<string, WithLetterSpacing>;
    expect(all.monoHud?.letterSpacing).toBeCloseTo(0.26);
  });

  test('smallcap letterSpacing ~2.64', () => {
    const all = typography as unknown as Record<string, WithLetterSpacing>;
    expect(all.smallcap?.letterSpacing).toBeCloseTo(2.64);
  });
});

describe('deprecated aliases', () => {
  const aliases = ['h1', 'h2', 'h3', 'body', 'caption', 'xs'] as const;
  for (const key of aliases) {
    test(`${key} is still defined`, () => {
      const role = (typography as Record<string, AnyRole>)[key] as AnyRole;
      expect(role).toBeDefined();
      expect(role.fontFamily.length).toBeGreaterThan(0);
      expect(role.fontSize).toBeGreaterThan(0);
    });
  }
});
