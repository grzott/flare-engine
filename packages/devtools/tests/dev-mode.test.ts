import { afterEach, describe, expect, it } from 'bun:test';
import { isDevMode } from '../src/dev-mode.js';

const g = globalThis as Record<string, unknown>;

afterEach(() => {
  g.__DEV__ = undefined;
});

describe('isDevMode', () => {
  it('returns false when __DEV__ is not set (Bun default)', () => {
    g.__DEV__ = undefined;
    expect(isDevMode()).toBe(false);
  });

  it('returns true when __DEV__ is set to true', () => {
    g.__DEV__ = true;
    expect(isDevMode()).toBe(true);
  });

  it('returns false when __DEV__ is explicitly false', () => {
    g.__DEV__ = false;
    expect(isDevMode()).toBe(false);
  });
});
