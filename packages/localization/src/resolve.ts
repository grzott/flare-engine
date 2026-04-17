import type { LocaleCode } from './types.js';

/**
 * Negotiate the best locale match from a prioritized list against a set of
 * available locales. Matching is case-insensitive and considers language +
 * region. Returns the fallback when nothing matches.
 */
export function resolveLocale(
  requested: readonly LocaleCode[],
  available: readonly LocaleCode[],
  fallback: LocaleCode,
): LocaleCode {
  if (available.length === 0) return fallback;
  const norm = (s: string): string => s.toLowerCase().replace(/_/g, '-');
  const avail = available.map(norm);

  for (const rawReq of requested) {
    const req = norm(rawReq);
    // Exact match.
    const exactIdx = avail.indexOf(req);
    if (exactIdx !== -1) return available[exactIdx] as LocaleCode;
    // Language-only match against any region variant.
    const lang = req.split('-')[0] ?? req;
    const langIdx = avail.findIndex((a) => (a.split('-')[0] ?? a) === lang);
    if (langIdx !== -1) return available[langIdx] as LocaleCode;
  }
  // Fallback — ensure it is actually present; otherwise first available.
  const fbIdx = avail.indexOf(norm(fallback));
  if (fbIdx !== -1) return available[fbIdx] as LocaleCode;
  return available[0] as LocaleCode;
}
