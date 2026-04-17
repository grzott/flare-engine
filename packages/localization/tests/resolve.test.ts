import { describe, expect, test } from 'bun:test';
import { resolveLocale } from '../src/resolve.js';

describe('resolveLocale', () => {
  test('exact match wins', () => {
    expect(resolveLocale(['en-US', 'en'], ['en-US', 'en', 'pl'], 'en')).toBe('en-US');
  });

  test('language-only match when region differs', () => {
    expect(resolveLocale(['en-GB'], ['en-US', 'pl'], 'pl')).toBe('en-US');
  });

  test('returns fallback when nothing matches', () => {
    expect(resolveLocale(['ja'], ['en', 'pl'], 'en')).toBe('en');
  });

  test('returns first available when even fallback is missing', () => {
    expect(resolveLocale(['ja'], ['pl'], 'en')).toBe('pl');
  });

  test('case-insensitive + underscore-tolerant', () => {
    expect(resolveLocale(['EN_us'], ['en-US'], 'en-US')).toBe('en-US');
  });

  test('returns fallback on empty available list', () => {
    expect(resolveLocale(['en'], [], 'en')).toBe('en');
  });
});
