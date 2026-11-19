import { describe, expect, test } from 'bun:test';
import { createStream, nextUnit, type PrngStream } from '../../src/core/prng';

const draw = (st: PrngStream, n: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(nextUnit(st));
  return out;
};

const CONCERNS = ['sites', 'velocity', 'timing', 'noise'] as const;

describe('createStream / nextUnit', () => {
  test('the same seed and concern give the same 1,000 values', () => {
    for (const concern of CONCERNS) {
      expect(draw(createStream(7, concern), 1000)).toEqual(draw(createStream(7, concern), 1000));
    }
  });

  test('different concerns of one seed give different sequences', () => {
    for (let a = 0; a < CONCERNS.length; a++) {
      for (let b = a + 1; b < CONCERNS.length; b++) {
        expect(draw(createStream(7, CONCERNS[a]!), 1000)).not.toEqual(
          draw(createStream(7, CONCERNS[b]!), 1000),
        );
      }
    }
  });

  test('different seeds give different sequences', () => {
    expect(draw(createStream(1, 'sites'), 1000)).not.toEqual(draw(createStream(2, 'sites'), 1000));
  });

  test('every value is in [0, 1)', () => {
    for (const seed of [0, 1, 2, 3, 0x7fffffff, 0xffffffff]) {
      for (const concern of CONCERNS) {
        for (const value of draw(createStream(seed, concern), 1000)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      }
    }
  });

  test('the state is one int32, so a stream can be copied and resumed', () => {
    const st = createStream(3, 'noise');
    draw(st, 10);
    expect(Number.isInteger(st.s)).toBe(true);
    expect(st.s | 0).toBe(st.s);
    const copy: PrngStream = { s: st.s };
    expect(draw(copy, 100)).toEqual(draw(st, 100));
  });

  test('the values spread over the unit interval', () => {
    const values = draw(createStream(1, 'sites'), 1000);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.05);
  });
});
