import { describe, expect, test } from 'bun:test';
import { AMBIENCE_DRIFT_SPREAD, VEL_FAST, VEL_SLOW } from '../src/fx/ambience';

describe('parallax-audit', () => {
  test('VEL_SLOW / VEL_FAST === 0.5 (folio XIIB 0.5× ratio)', () => {
    expect(VEL_SLOW / VEL_FAST).toBe(0.5);
  });

  test('AMBIENCE_DRIFT_SPREAD === 16 (folio XIIB ±8 px/s = ±1 tile)', () => {
    expect(AMBIENCE_DRIFT_SPREAD).toBe(16);
  });
});
