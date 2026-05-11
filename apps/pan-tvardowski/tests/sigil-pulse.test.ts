/**
 * Session #172 PT-SigilPulse — period-boundary assertions for the player
 * sigil opacity tween. Tests pin the sineInOut curve from
 * `@flare-engine/animation` at t=0, t=T/2 (peak), and t=T (full cycle).
 *
 * periodicTween(0.4, 1.0, 2.4) → minOpacity=0.4, maxOpacity=1.0, period=2.4 s
 */

import { describe, expect, test } from 'bun:test';
import { periodicTween, updatePeriodicTween } from '@flare-engine/animation';

describe('sigil-pulse periodicTween boundaries', () => {
  test('t=0: value equals minOpacity (0.4)', () => {
    const tw = periodicTween(0.4, 1.0, 2.4);
    updatePeriodicTween(tw, 0);
    expect(tw.value).toBeCloseTo(0.4, 5);
  });

  test('t=1.2 s (half period): value equals maxOpacity (1.0)', () => {
    const tw = periodicTween(0.4, 1.0, 2.4);
    updatePeriodicTween(tw, 1.2);
    expect(tw.value).toBeCloseTo(1.0, 5);
  });

  test('t=2.4 s (full period): value wraps back to minOpacity (0.4)', () => {
    const tw = periodicTween(0.4, 1.0, 2.4);
    updatePeriodicTween(tw, 2.4);
    expect(tw.value).toBeCloseTo(0.4, 5);
  });
});
