import { describe, expect, test } from 'bun:test';
import { pluralCategory } from '../src/plurals.js';

describe('pluralCategory', () => {
  test('English: 1 → one, rest → other', () => {
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
  });

  test('Polish: 1 → one, 2–4 → few, rest → many', () => {
    expect(pluralCategory('pl', 1)).toBe('one');
    expect(pluralCategory('pl', 2)).toBe('few');
    expect(pluralCategory('pl', 4)).toBe('few');
    expect(pluralCategory('pl', 5)).toBe('many');
    expect(pluralCategory('pl', 12)).toBe('many');
    expect(pluralCategory('pl', 22)).toBe('few');
  });

  test('Russian: 21 → one, 22 → few, 25 → many, 11 → many', () => {
    expect(pluralCategory('ru', 21)).toBe('one');
    expect(pluralCategory('ru', 22)).toBe('few');
    expect(pluralCategory('ru', 25)).toBe('many');
    expect(pluralCategory('ru', 11)).toBe('many');
  });

  test('Arabic: 0 → zero, 1 → one, 2 → two, 3 → few, 11 → many', () => {
    expect(pluralCategory('ar', 0)).toBe('zero');
    expect(pluralCategory('ar', 1)).toBe('one');
    expect(pluralCategory('ar', 2)).toBe('two');
    expect(pluralCategory('ar', 3)).toBe('few');
    expect(pluralCategory('ar', 11)).toBe('many');
    expect(pluralCategory('ar', 100)).toBe('other');
  });

  test('Japanese / Korean / Chinese always → other', () => {
    expect(pluralCategory('ja', 0)).toBe('other');
    expect(pluralCategory('zh-CN', 1)).toBe('other');
    expect(pluralCategory('ko', 5)).toBe('other');
  });

  test('Unknown locale falls back to English rules', () => {
    expect(pluralCategory('xx', 1)).toBe('one');
    expect(pluralCategory('xx', 5)).toBe('other');
  });
});

// Every key of the RULES table in src/plurals.ts.
const SUPPORTED = [
  'en',
  'de',
  'es',
  'fr',
  'it',
  'pt',
  'nl',
  'pl',
  'ru',
  'uk',
  'ar',
  'ja',
  'ko',
  'zh',
] as const;

const DOMAIN: number[] = [0.5, 1.5, 2.5, -0.5, -1.5, -2.5];
for (let n = -100; n <= 100; n++) DOMAIN.push(n);

function mismatches(locale: string): string[] {
  const intl = new Intl.PluralRules(locale);
  const out: string[] = [];
  for (const n of DOMAIN) {
    const expected = intl.select(n);
    const actual = pluralCategory(locale, n);
    if (actual !== expected) out.push(`${locale} ${n}: got ${actual}, Intl says ${expected}`);
  }
  return out;
}

describe('pluralCategory agrees with Intl.PluralRules', () => {
  for (const locale of SUPPORTED) {
    test(`${locale}: integers -100..100 and ±0.5, ±1.5, ±2.5`, () => {
      expect(mismatches(locale)).toEqual([]);
    });
  }

  test('pt-PT keeps its own rule instead of the pt one', () => {
    expect(mismatches('pt-PT')).toEqual([]);
    expect(pluralCategory('pt-PT', 0)).toBe('other');
    expect(pluralCategory('pt_PT', 0)).toBe('other');
    expect(pluralCategory('pt', 0)).toBe('one');
  });

  test('a region without its own entry uses the language rule', () => {
    expect(pluralCategory('pl-PL', -2)).toBe('few');
    expect(pluralCategory('fr_CA', 1.5)).toBe('one');
    expect(pluralCategory('pt-BR', 0)).toBe('one');
  });

  test('non-finite counts match Intl', () => {
    for (const locale of SUPPORTED) {
      const intl = new Intl.PluralRules(locale);
      for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(pluralCategory(locale, n)).toBe(intl.select(n));
      }
    }
  });
});
