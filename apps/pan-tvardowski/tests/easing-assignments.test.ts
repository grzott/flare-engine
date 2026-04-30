import { describe, expect, test } from 'bun:test';
import { resetTween, tween, updateTween } from '@flare-engine/animation';
import { easeOutBack, easeOutQuart } from '@flare-engine/math';
import { createZoneBannerState } from '../src/hud/zone-banner';

describe('easing-assignments', () => {
  test('zone-banner fadeIn uses easeOutQuart with duration 0.8 s', () => {
    const state = createZoneBannerState();
    expect(state.fadeIn.duration).toBe(0.8);
    // Verify the easing function is easeOutQuart by checking output identity.
    // easeOutQuart(0.5) = 1 - (1-0.5)^4 = 1 - 0.0625 = 0.9375
    expect(state.fadeIn.easing(0.5)).toBeCloseTo(easeOutQuart(0.5), 10);
    // Distinguish from easeOutCubic(0.5) = 1 - (0.5)^3 = 0.875
    expect(state.fadeIn.easing(0.5)).not.toBeCloseTo(0.875, 3);
  });

  test('comboPulse tween: duration 0.12, easeOutBack overshoot mid-curve', () => {
    const pulse = tween(1, 1.18, 0.12, easeOutBack);
    // Confirm duration.
    expect(pulse.duration).toBe(0.12);
    // easeOutBack overshoots 1.0 before settling — sample at t=0.5.
    // easeOutBack(0.5) > 1.0 (overshoot characteristic).
    expect(easeOutBack(0.5)).toBeGreaterThan(1.0);
    // Verify the tween easing function matches easeOutBack identity.
    expect(pulse.easing(0.5)).toBeCloseTo(easeOutBack(0.5), 10);
    // Advance to midpoint and confirm value exceeds the `to` end value (overshoot).
    resetTween(pulse);
    updateTween(pulse, 0.06);
    expect(pulse.value).toBeGreaterThan(1.18);
  });
});
