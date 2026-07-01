import type { LocaleCode } from './types.js';

export interface FormatTimestampOptions {
  /** Intl.DateTimeFormat date style. Defaults to 'short'. */
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  /**
   * Intl.DateTimeFormat time style. Defaults to 'short'.
   * Omit (or pass undefined) for a date-only result.
   */
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
  /** Returned for ts <= 0 or on any Intl failure. Defaults to ''. */
  fallback?: string;
}

/**
 * Format a Unix timestamp (milliseconds) as a human-readable date/time string
 * using Intl.DateTimeFormat with the given locale.
 *
 * Returns `options.fallback` (default '') for ts <= 0 or on any Intl error
 * (e.g. unsupported locale on a constrained runtime). The locale is used
 * directly as the Intl BCP-47 tag.
 *
 * Safe on all target runtimes: Bun (V8), React Native Hermes (>= 0.70), web.
 */
export function formatTimestamp(
  ts: number,
  locale: LocaleCode,
  options?: FormatTimestampOptions,
): string {
  const fallback = options?.fallback ?? '';
  if (ts <= 0) return fallback;
  try {
    const intlOpts: Intl.DateTimeFormatOptions = {
      dateStyle: options?.dateStyle ?? 'short',
    };
    if (options?.timeStyle !== undefined) {
      intlOpts.timeStyle = options.timeStyle;
    } else if (options === undefined) {
      intlOpts.timeStyle = 'short';
    }
    return new Intl.DateTimeFormat(locale, intlOpts).format(new Date(ts));
  } catch {
    return fallback;
  }
}
