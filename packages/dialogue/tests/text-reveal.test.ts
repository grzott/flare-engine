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

  test('punctuation delay holds the cursor, then resumes at speed', () => {
    // "A.B" — after revealing "A.", the cursor waits 0.15 s and then B still
    // needs its own 1/30 s at the normal speed.
    const s = createTextReveal('A.B');
    updateTextReveal(s, 2 / 30);
    expect(s.visibleText).toBe('A.');

    updateTextReveal(s, 0.01);
    expect(s.visibleText).toBe('A.');

    // The pause alone (0.14 s more) does not reveal B
    updateTextReveal(s, 0.14);
    expect(s.visibleText).toBe('A.');

    // One character's worth of time at 30 cps does
    updateTextReveal(s, 1 / 30 + 1e-9);
    expect(s.visibleText).toBe('A.B');
    expect(s.complete).toBe(true);
  });

  test('pause is added to the per-character time, not a speed override', () => {
    // speed 2 cps, delay 0.5 s: the old 1/punctDelay override equals the
    // speed here, so the "." gap would be no longer than the "A" gap.
    const s = createTextReveal('A.B');
    const opts = { speed: 2, punctuationDelay: 0.5 };
    const dt = 0.25;
    const appearedAt: number[] = [];
    let t = 0;
    while (!s.complete && t < 10) {
      updateTextReveal(s, dt, opts);
      t += dt;
      while (appearedAt.length < s.visibleText.length) appearedAt.push(t);
    }
    expect(appearedAt).toEqual([0.5, 1.0, 2.0]);
    const [tA, tDot, tB] = appearedAt as [number, number, number];
    expect(tB - tDot).toBeGreaterThan(tDot - tA);
  });

  test('slow text does not speed up after a full stop', () => {
    // speed 2 cps is below 1/0.15 ≈ 6.7 cps: the old code advanced the
    // character after "." in 0.15 s instead of 0.5 s.
    const s = createTextReveal('A.B');
    updateTextReveal(s, 1.0, { speed: 2 });
    expect(s.visibleText).toBe('A.');
    updateTextReveal(s, 0.4, { speed: 2 });
    expect(s.visibleText).toBe('A.');
    updateTextReveal(s, 0.3, { speed: 2 });
    expect(s.visibleText).toBe('A.B');
  });

  test('default options: a short sentence takes chars/30 plus 0.15 s per inner punctuation', () => {
    // "Hi. Go!" — 7 chars, one inner "." (the final "!" adds no trailing pause)
    const total = 7 / 30 + 0.15;
    const s = createTextReveal('Hi. Go!');
    updateTextReveal(s, total - 0.01);
    expect(s.visibleText).toBe('Hi. Go');
    expect(s.complete).toBe(false);
    updateTextReveal(s, 0.02);
    expect(s.visibleText).toBe('Hi. Go!');
    expect(s.complete).toBe(true);

    // The same sentence stepped frame by frame completes at the same time
    const stepped = createTextReveal('Hi. Go!');
    let elapsed = 0;
    while (!stepped.complete) {
      updateTextReveal(stepped, 0.001);
      elapsed += 0.001;
    }
    expect(elapsed).toBeCloseTo(total, 2);
  });

  test('one large dt honours every pause inside it', () => {
    // "A.B.C" at 30 cps: 5/30 s of characters plus two 0.15 s pauses
    const s = createTextReveal('A.B.C');
    updateTextReveal(s, 5 / 30 + 0.3 - 0.01);
    expect(s.visibleText).toBe('A.B.');
    expect(s.complete).toBe(false);
    updateTextReveal(s, 0.02);
    expect(s.complete).toBe(true);
  });

  test('a hand-built state without _pause still advances', () => {
    const s = { fullText: 'A.B', visibleText: '', complete: false, _cursor: 0 };
    updateTextReveal(s, 2 / 30);
    expect(s.visibleText).toBe('A.');
    updateTextReveal(s, 0.15 + 1 / 30 + 1e-9);
    expect(s.visibleText).toBe('A.B');
    expect(s.complete).toBe(true);
  });

  test('pause never moves the cursor or visibleText backwards', () => {
    const s = createTextReveal('A.B');
    updateTextReveal(s, 2 / 30);
    const cursor = s._cursor;
    updateTextReveal(s, 0.05);
    expect(s._cursor).toBe(cursor);
    expect(s.visibleText).toBe('A.');
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
