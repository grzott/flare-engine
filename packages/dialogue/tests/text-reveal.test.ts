import { describe, expect, test } from 'bun:test';
import {
  completeTextReveal,
  createTextReveal,
  resetTextReveal,
  updateTextReveal,
} from '../src/text-reveal.js';

describe('createTextReveal', () => {
  test('empty string starts complete', () => {
    const s = createTextReveal('');
    expect(s.complete).toBe(true);
    expect(s.visibleText).toBe('');
    expect(s.fullText).toBe('');
  });

  test('non-empty string starts incomplete', () => {
    const s = createTextReveal('Hello');
    expect(s.complete).toBe(false);
    expect(s.visibleText).toBe('');
    expect(s.fullText).toBe('Hello');
  });
});

describe('updateTextReveal', () => {
  test('reveals characters over time at default speed (30 cps)', () => {
    const s = createTextReveal('Hello');
    // At 30 cps, after 1/30 s we should have 1 char
    updateTextReveal(s, 1 / 30);
    expect(s.visibleText).toBe('H');
    expect(s.complete).toBe(false);
  });

  test('multiple updates accumulate', () => {
    const s = createTextReveal('AB');
    updateTextReveal(s, 1 / 30); // cursor = 1
    expect(s.visibleText).toBe('A');
    updateTextReveal(s, 1 / 30); // cursor = 2
    expect(s.visibleText).toBe('AB');
    expect(s.complete).toBe(true);
  });

  test('respects custom speed', () => {
    const s = createTextReveal('ABCDEF');
    // 60 cps → 3 chars in 0.05 s
    updateTextReveal(s, 0.05, { speed: 60 });
    expect(s.visibleText).toBe('ABC');
  });

  test('does not exceed text length', () => {
    const s = createTextReveal('Hi');
    updateTextReveal(s, 10); // way past the end
    expect(s.visibleText).toBe('Hi');
    expect(s.complete).toBe(true);
  });

  test('no-op when already complete', () => {
    const s = createTextReveal('X');
    updateTextReveal(s, 1); // completes
    expect(s.complete).toBe(true);
    const cursor = s._cursor;
    updateTextReveal(s, 1); // should not change
    expect(s._cursor).toBe(cursor);
  });

  test('punctuation delay slows reveal', () => {
    // "A.B" — after revealing "A.", next char should be slowed
    const s = createTextReveal('A.B');
    // Reveal "A." first (2 chars at 30 cps = 2/30 s)
    updateTextReveal(s, 2 / 30);
    expect(s.visibleText).toBe('A.');

    // Now cursor is at 2, prevChar is '.', punctDelay = 0.15 → effectiveSpeed = 1/0.15 ≈ 6.67
    // To reveal 1 more char at 6.67 cps we need ~0.15 s
    // With a small dt, we should NOT reveal B yet
    updateTextReveal(s, 0.01);
    expect(s.visibleText).toBe('A.');

    // With full punctuation delay, B appears
    updateTextReveal(s, 0.15);
    expect(s.visibleText).toBe('A.B');
    expect(s.complete).toBe(true);
  });
});

describe('completeTextReveal', () => {
  test('instantly completes', () => {
    const s = createTextReveal('Hello World');
    completeTextReveal(s);
    expect(s.visibleText).toBe('Hello World');
    expect(s.complete).toBe(true);
    expect(s._cursor).toBe(11);
  });
});

describe('resetTextReveal', () => {
  test('resets with same text', () => {
    const s = createTextReveal('Test');
    updateTextReveal(s, 1);
    expect(s.complete).toBe(true);

    resetTextReveal(s);
    expect(s.visibleText).toBe('');
    expect(s.complete).toBe(false);
    expect(s._cursor).toBe(0);
    expect(s.fullText).toBe('Test');
  });

  test('resets with new text', () => {
    const s = createTextReveal('Old');
    completeTextReveal(s);

    resetTextReveal(s, 'New text');
    expect(s.fullText).toBe('New text');
    expect(s.visibleText).toBe('');
    expect(s.complete).toBe(false);
  });

  test('reset to empty string is immediately complete', () => {
    const s = createTextReveal('Something');
    resetTextReveal(s, '');
    expect(s.complete).toBe(true);
  });
});
