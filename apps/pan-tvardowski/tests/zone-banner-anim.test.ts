import { describe, expect, test } from 'bun:test';
import { createZoneBannerState, showZoneBanner, updateZoneBanner } from '../src/hud/zone-banner';

describe('zone-banner-anim', () => {
  test('createZoneBannerState fadeIn duration is 0.8 s', () => {
    const state = createZoneBannerState();
    expect(state.fadeIn.duration).toBe(0.8);
  });

  test('opacity is between 0 and 1 after 0.4 s of updateZoneBanner ticks', () => {
    const state = createZoneBannerState();
    showZoneBanner(state);
    // Advance in 20 ms steps summing to 0.4 s (20 steps).
    const steps = 20;
    const dt = 0.4 / steps;
    for (let i = 0; i < steps; i++) {
      updateZoneBanner(state, dt);
    }
    // 0.4 s < 0.8 s duration — still mid-animation.
    expect(state.opacity).toBeGreaterThan(0);
    expect(state.opacity).toBeLessThan(1);
  });
});
