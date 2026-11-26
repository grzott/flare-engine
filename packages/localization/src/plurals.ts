import type { LocaleCode } from './types.js';

/**
 * Minimal CLDR-inspired plural classifier. Supports a handful of locales
 * natively — fall back to English rules if unknown. This is not a full ICU
 * implementation; it covers the categories used by our string tables.
 *
 * The sign of the count is ignored, and a non-integer count follows CLDR's
 * visible-fraction rules: a JS number shows fraction digits only when it is
 * not an integer, so CLDR's `v = 0` is `Number.isInteger(n)`.
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** Receives a finite, non-negative count. */
type PluralRule = (n: number) => PluralCategory;

const ENGLISH: PluralRule = (n) => (n === 1 ? 'one' : 'other');

// CLDR `i = 0,1`: the integer part decides, so 0.5 and 1.5 are `one`.
const FRENCH: PluralRule = (n) => (n < 2 ? 'one' : 'other');

const POLISH: PluralRule = (n) => {
  if (!Number.isInteger(n)) return 'other';
  if (n === 1) return 'one';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
};

const RUSSIAN: PluralRule = (n) => {
  if (!Number.isInteger(n)) return 'other';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many';
  return 'other';
};

const ARABIC: PluralRule = (n) => {
  if (!Number.isInteger(n)) return 'other';
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
};

const JAPANESE: PluralRule = () => 'other';

// Keyed by lower-case tag with `-` separators. A full tag wins over its language.
const RULES: Record<string, PluralRule> = {
  en: ENGLISH,
  de: ENGLISH,
  es: ENGLISH,
  fr: FRENCH,
  it: ENGLISH,
  pt: FRENCH,
  'pt-pt': ENGLISH,
  nl: ENGLISH,
  pl: POLISH,
  ru: RUSSIAN,
  uk: RUSSIAN,
  ar: ARABIC,
  ja: JAPANESE,
  ko: JAPANESE,
  zh: JAPANESE,
};

const SUBTAG_SEPARATOR = /[-_]/;
const UNDERSCORES = /_/g;

function ruleFor(locale: LocaleCode): PluralRule {
  const tag = locale.toLowerCase();
  const sep = tag.search(SUBTAG_SEPARATOR);
  if (sep < 0) return RULES[tag] ?? ENGLISH;
  return RULES[tag.replace(UNDERSCORES, '-')] ?? RULES[tag.slice(0, sep)] ?? ENGLISH;
}

/**
 * Plural category of `n` in `locale`. The sign of `n` is ignored, a
 * non-integer follows CLDR's visible-fraction rules, and `NaN` or an infinity
 * is `other`. A region with its own entry (`pt-PT`) is looked up before its
 * language; an unknown locale uses the English rule.
 */
export function pluralCategory(locale: LocaleCode, n: number): PluralCategory {
  if (!Number.isFinite(n)) return 'other';
  return ruleFor(locale)(Math.abs(n));
}
