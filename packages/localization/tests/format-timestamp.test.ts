import { describe, expect, test } from 'bun:test';
import { formatTimestamp } from '../src/format-timestamp.js';

const FIXED_TS = new Date('2024-01-15T14:30:00.000Z').getTime();

describe('formatTimestamp — zero / negative timestamps', () => {
  test('ts = 0 returns empty string by default', () => {
    expect(formatTimestamp(0, 'en')).toBe('');
  });

  test('ts < 0 returns empty string', () => {
    expect(formatTimestamp(-1, 'en')).toBe('');
    expect(formatTimestamp(-1000, 'en')).toBe('');
  });

  test('custom fallback is returned for ts <= 0', () => {
    expect(formatTimestamp(0, 'en', { fallback: 'N/A' })).toBe('N/A');
    expect(formatTimestamp(-1, 'en', { fallback: '—' })).toBe('—');
  });
});

describe('formatTimestamp — positive timestamps', () => {
  test('returns a non-empty string for a valid timestamp', () => {
    expect(formatTimestamp(FIXED_TS, 'en').length).toBeGreaterThan(0);
  });

  test('output matches inline Intl.DateTimeFormat for en locale', () => {
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(FIXED_TS));
    expect(formatTimestamp(FIXED_TS, 'en')).toBe(expected);
  });

  test('output matches inline Intl.DateTimeFormat for pl locale', () => {
    const expected = new Intl.DateTimeFormat('pl', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(FIXED_TS));
    expect(formatTimestamp(FIXED_TS, 'pl')).toBe(expected);
  });

  test('en and pl outputs differ (locale is applied)', () => {
    const en = formatTimestamp(FIXED_TS, 'en');
    const pl = formatTimestamp(FIXED_TS, 'pl');
    expect(en).not.toBe(pl);
  });
});

describe('formatTimestamp — dateStyle option', () => {
  test('dateStyle: long produces a longer result than short', () => {
    const short = formatTimestamp(FIXED_TS, 'en', { dateStyle: 'short' });
    const long = formatTimestamp(FIXED_TS, 'en', { dateStyle: 'long' });
    expect(long.length).toBeGreaterThan(short.length);
  });

  test('dateStyle medium with timeStyle short matches inline Intl', () => {
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(FIXED_TS));
    expect(formatTimestamp(FIXED_TS, 'en', { dateStyle: 'medium', timeStyle: 'short' })).toBe(
      expected,
    );
  });
});

describe('formatTimestamp — date-only (omit timeStyle)', () => {
  test('passing options without timeStyle gives date-only result', () => {
    const dateOnly = formatTimestamp(FIXED_TS, 'en', { dateStyle: 'short' });
    const withTime = formatTimestamp(FIXED_TS, 'en');
    const expected = new Intl.DateTimeFormat('en', { dateStyle: 'short' }).format(
      new Date(FIXED_TS),
    );
    expect(dateOnly).toBe(expected);
    expect(withTime).not.toBe(dateOnly);
  });

  test('date-only result does not contain a colon (no time component)', () => {
    const result = formatTimestamp(FIXED_TS, 'en', { dateStyle: 'short' });
    expect(result).not.toContain(':');
  });
});

describe('formatTimestamp — timeStyle option', () => {
  test('timeStyle: long matches inline Intl', () => {
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'short',
      timeStyle: 'long',
    }).format(new Date(FIXED_TS));
    expect(formatTimestamp(FIXED_TS, 'en', { timeStyle: 'long' })).toBe(expected);
  });
});

describe('formatTimestamp — graceful failure', () => {
  test('invalid locale does not throw — returns fallback', () => {
    let result: string;
    expect(() => {
      result = formatTimestamp(FIXED_TS, 'xx-INVALID-999');
    }).not.toThrow();
    expect(result!).toBe('');
  });

  test('invalid locale with custom fallback returns that fallback', () => {
    const result = formatTimestamp(FIXED_TS, 'xx-INVALID-999', { fallback: 'error' });
    expect(result).toBe('error');
  });
});
