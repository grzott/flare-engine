import { describe, expect, it } from 'bun:test';
import {
  easeInBack,
  easeInBounce,
  easeInCirc,
  easeInCubic,
  easeInElastic,
  easeInExpo,
  easeInOutBack,
  easeInOutBounce,
  easeInOutCirc,
  easeInOutCubic,
  easeInOutElastic,
  easeInOutExpo,
  easeInOutQuad,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutSine,
  easeInQuad,
  easeInQuart,
  easeInQuint,
  easeInSine,
  easeOutBack,
  easeOutBounce,
  easeOutCirc,
  easeOutCubic,
  easeOutElastic,
  easeOutExpo,
  easeOutQuad,
  easeOutQuart,
  easeOutQuint,
  easeOutSine,
  linear,
  springIn,
  springInOut,
  springOut,
  step,
} from '../src/index.js';
import type { EasingFn } from '../src/index.js';

const allEasings: [string, EasingFn][] = [
  ['linear', linear],
  ['step', step],
  ['easeInQuad', easeInQuad],
  ['easeOutQuad', easeOutQuad],
  ['easeInOutQuad', easeInOutQuad],
  ['easeInCubic', easeInCubic],
  ['easeOutCubic', easeOutCubic],
  ['easeInOutCubic', easeInOutCubic],
  ['easeInQuart', easeInQuart],
  ['easeOutQuart', easeOutQuart],
  ['easeInOutQuart', easeInOutQuart],
  ['easeInQuint', easeInQuint],
  ['easeOutQuint', easeOutQuint],
  ['easeInOutQuint', easeInOutQuint],
  ['easeInSine', easeInSine],
  ['easeOutSine', easeOutSine],
  ['easeInOutSine', easeInOutSine],
  ['easeInExpo', easeInExpo],
  ['easeOutExpo', easeOutExpo],
  ['easeInOutExpo', easeInOutExpo],
  ['easeInCirc', easeInCirc],
  ['easeOutCirc', easeOutCirc],
  ['easeInOutCirc', easeInOutCirc],
  ['easeInBack', easeInBack],
  ['easeOutBack', easeOutBack],
  ['easeInOutBack', easeInOutBack],
  ['easeInElastic', easeInElastic],
  ['easeOutElastic', easeOutElastic],
  ['easeInOutElastic', easeInOutElastic],
  ['easeInBounce', easeInBounce],
  ['easeOutBounce', easeOutBounce],
  ['easeInOutBounce', easeInOutBounce],
  ['springIn', springIn],
  ['springOut', springOut],
  ['springInOut', springInOut],
];

describe('easings — boundary tests', () => {
  for (const [name, fn] of allEasings) {
    if (name === 'step') {
      // step is special: f(0) = 0, f(1) = 1, but f(<1) = 0
      it(`${name}(0) ≈ 0`, () => expect(fn(0)).toBeCloseTo(0, 4));
      it(`${name}(1) = 1`, () => expect(fn(1)).toBeCloseTo(1, 4));
      continue;
    }
    it(`${name}(0) ≈ 0`, () => expect(fn(0)).toBeCloseTo(0, 4));
    it(`${name}(1) ≈ 1`, () => expect(fn(1)).toBeCloseTo(1, 4));
  }
});

describe('easings — monotonicity for standard curves', () => {
  const monotonic: EasingFn[] = [
    linear,
    easeInQuad,
    easeOutQuad,
    easeInOutQuad,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInQuint,
    easeOutQuint,
    easeInOutQuint,
    easeInSine,
    easeOutSine,
    easeInOutSine,
    easeInExpo,
    easeOutExpo,
    easeInOutExpo,
    easeInCirc,
    easeOutCirc,
    easeInOutCirc,
  ];
  for (const fn of monotonic) {
    it(`${fn.name} is monotonically non-decreasing`, () => {
      let prev = fn(0);
      for (let i = 1; i <= 100; i++) {
        const curr = fn(i / 100);
        expect(curr).toBeGreaterThanOrEqual(prev - 1e-10);
        prev = curr;
      }
    });
  }
});

describe('easings — midpoint tests', () => {
  it('linear(0.5) = 0.5', () => expect(linear(0.5)).toBeCloseTo(0.5));
  it('easeInOutQuad(0.5) = 0.5', () => expect(easeInOutQuad(0.5)).toBeCloseTo(0.5));
  it('easeInOutCubic(0.5) = 0.5', () => expect(easeInOutCubic(0.5)).toBeCloseTo(0.5));
  it('easeInOutSine(0.5) = 0.5', () => expect(easeInOutSine(0.5)).toBeCloseTo(0.5));
});

describe('easings count', () => {
  it('has 35 named easing functions', () => {
    expect(allEasings.length).toBe(35);
  });
});
