import { describe, expect, test } from 'bun:test';
import { dampenedMotion, motionScale, pickContrast } from '../src/helpers.js';

describe('motionScale', () => {
  test('returns base when motion is allowed', () => {
    expect(motionScale({ reducedMotion: false })).toBe(1);
    expect(motionScale({ reducedMotion: false }, 2)).toBe(2);
  });
  test('returns 0 under reduced motion', () => {
    expect(motionScale({ reducedMotion: true }, 5)).toBe(0);
  });
});

describe('dampenedMotion', () => {
  test('passes base through when motion is allowed', () => {
    expect(dampenedMotion({ reducedMotion: false }, 10)).toBe(10);
  });
  test('applies factor under reduced motion', () => {
    expect(dampenedMotion({ reducedMotion: true }, 10)).toBe(2);
    expect(dampenedMotion({ reducedMotion: true }, 10, 0.5)).toBe(5);
  });
});

describe('pickContrast', () => {
  test('normal preference returns the first argument', () => {
    expect(pickContrast({ contrast: 'normal' }, 'a', 'b')).toBe('a');
  });
  test('high preference returns the second argument', () => {
    expect(pickContrast({ contrast: 'high' }, 'a', 'b')).toBe('b');
  });
});
