import { expect, test } from 'bun:test';
import { effectiveReduced } from '../../src/runtime/reduced-motion';
import { staticReducedMotion } from '../support/fakes';

test('effectiveReduced truth table', () => {
  const on = staticReducedMotion(true);
  const off = staticReducedMotion(false);

  expect(effectiveReduced('system', on)).toBe(true);
  expect(effectiveReduced('system', off)).toBe(false);
  expect(effectiveReduced('always', on)).toBe(true);
  expect(effectiveReduced('always', off)).toBe(true);
  expect(effectiveReduced('never', on)).toBe(false);
  expect(effectiveReduced('never', off)).toBe(false);
});

test('only system mode reads the source', () => {
  let reads = 0;
  const counting = {
    get() {
      reads++;
      return true;
    },
    subscribe: () => () => {},
  };

  effectiveReduced('always', counting);
  effectiveReduced('never', counting);
  expect(reads).toBe(0);

  effectiveReduced('system', counting);
  expect(reads).toBe(1);
});
