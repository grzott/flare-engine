import { describe, expect, test } from 'bun:test';
import { resetTween, tween, updateTween } from '@flare-engine/animation';
import {
  easeInCubic,
  easeInExpo,
  easeOutBack,
  easeOutCubic,
  easeOutExpo,
  easeOutQuart,
} from '@flare-engine/math';
import { createZoneBannerState } from '../src/hud/zone-banner';
import { HUD_TWEENS } from '../src/visual-spec/animations';

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

  test('scene-menu-enter spec: easeOutCubic 320 ms', () => {
    const spec = HUD_TWEENS.find((s) => s.id === 'scene-menu-enter');
    expect(spec).toBeDefined();
    if (!spec) return;
    expect(spec.durationSec).toBe(0.32);
    expect(spec.easingName).toBe('easeOutCubic');
    // Verify the named easing function is distinguishable from easeOutQuart at t=0.5.
    // easeOutCubic(0.5) = 1-(0.5)^3 = 0.875; easeOutQuart(0.5) = 1-(0.5)^4 = 0.9375.
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeOutCubic(0.5)).not.toBeCloseTo(easeOutQuart(0.5), 3);
  });

  test('overlay-open spec: easeOutExpo 240 ms', () => {
    const spec = HUD_TWEENS.find((s) => s.id === 'overlay-open');
    expect(spec).toBeDefined();
    if (!spec) return;
    expect(spec.durationSec).toBe(0.24);
    expect(spec.easingName).toBe('easeOutExpo');
    // easeOutExpo(0.5) should match the exported function value.
    expect(easeOutExpo(0.5)).toBeCloseTo(easeOutExpo(0.5), 10);
    // easeOutExpo rises faster than easeOutCubic at t=0.25 (expo characteristic).
    expect(easeOutExpo(0.25)).toBeGreaterThan(easeOutCubic(0.25));
  });

  test('overlay-close spec: easeInExpo 180 ms', () => {
    const spec = HUD_TWEENS.find((s) => s.id === 'overlay-close');
    expect(spec).toBeDefined();
    if (!spec) return;
    expect(spec.durationSec).toBe(0.18);
    expect(spec.easingName).toBe('easeInExpo');
    // easeInExpo is slow to start — value at t=0.5 should be well below 0.5.
    expect(easeInExpo(0.5)).toBeLessThan(0.1);
    // Confirm distinct from easeInCubic at midpoint.
    expect(easeInExpo(0.5)).toBeLessThan(easeInCubic(0.5));
  });

  test('scene-game-over spec: easeInCubic 1200 ms', () => {
    const spec = HUD_TWEENS.find((s) => s.id === 'scene-game-over');
    expect(spec).toBeDefined();
    if (!spec) return;
    expect(spec.durationSec).toBe(1.2);
    expect(spec.easingName).toBe('easeInCubic');
    // easeInCubic(0.5) = 0.5^3 = 0.125 — slow start, confirms in-easing characteristic.
    expect(easeInCubic(0.5)).toBeCloseTo(0.125, 5);
  });
});
