import { describe, expect, test } from 'bun:test';
import * as layout from '../../../src/core/motion/layout';

describe('fragment layout', () => {
  test('a fragment is 12 floats at the documented offsets', () => {
    expect(layout.FRAG_STRIDE).toBe(12);
    expect([
      layout.HX,
      layout.HY,
      layout.VX,
      layout.VY,
      layout.A0,
      layout.OMEGA,
      layout.DELAY,
      layout.LIFE,
      layout.MASS,
      layout.VZ,
      layout.SRC,
      layout.CX,
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test('the physics block is 16 floats with two spare', () => {
    expect(layout.PHYS_LEN).toBe(16);
    expect([
      layout.GX,
      layout.GY,
      layout.DRAG,
      layout.ADRAG,
      layout.DEPTH,
      layout.OP0,
      layout.OP1,
      layout.SC0,
      layout.SC1,
      layout.FADE_START,
      layout.REVERSE_MODE,
      layout.OMEGA0,
      layout.ZETA,
      layout.TOTAL,
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});
