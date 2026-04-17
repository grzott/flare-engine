import type { LocaleCode } from './types.js';

/**
 * Minimal CLDR-inspired plural classifier. Supports a handful of locales
 * natively — fall back to English rules if unknown. This is not a full ICU
 * implementation; it covers the categories used by our string tables.
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type PluralRule = (n: number) => PluralCategory;

const ENGLISH: PluralRule = (n) => (n === 1 ? 'one' : 'other');

const POLISH: PluralRule = (n) => {
  if (n === 1) return 'one';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
};

const RUSSIAN: PluralRule = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many';
  return 'other';
};

const ARABIC: PluralRule = (n) => {
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
};

const JAPANESE: PluralRule = () => 'other';

const RULES: Record<string, PluralRule> = {
  en: ENGLISH,
  de: ENGLISH,
  es: ENGLISH,
  fr: (n) => (n === 0 || n === 1 ? 'one' : 'other'),
  it: ENGLISH,
  pt: ENGLISH,
  nl: ENGLISH,
  pl: POLISH,
  ru: RUSSIAN,
  uk: RUSSIAN,
  ar: ARABIC,
  ja: JAPANESE,
  ko: JAPANESE,
  zh: JAPANESE,
};

export function pluralCategory(locale: LocaleCode, n: number): PluralCategory {
  const lang = locale.toLowerCase().split(/[-_]/)[0] ?? 'en';
  const rule = RULES[lang] ?? ENGLISH;
  return rule(n);
}
