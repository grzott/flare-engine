import { describe, expect, test } from 'bun:test';
import { ZONE_VISUAL_SPECS } from '../src/visual-spec';
import { BASELINE_POSTFX, resolvePostFx } from '../src/visual-spec/postfx';

describe('Zone 8 postfxOverride round-trip', () => {
  test('zone8.postfxOverride is defined and carries a bloom sub-object', () => {
    const z8 = ZONE_VISUAL_SPECS[8];
    expect(z8.postfxOverride).toBeDefined();
    expect(z8.postfxOverride?.bloom).toBeDefined();
    expect(z8.postfxOverride?.bloom?.threshold).toBeLessThan(BASELINE_POSTFX.bloom.threshold);
    expect(z8.postfxOverride?.bloom?.intensity).toBeGreaterThan(BASELINE_POSTFX.bloom.intensity);
  });

  test('resolvePostFx(BASELINE_POSTFX, zone8.postfxOverride) produces zone-specific bloom', () => {
    const z8 = ZONE_VISUAL_SPECS[8];
    const resolved = resolvePostFx(BASELINE_POSTFX, z8.postfxOverride);
    expect(resolved.bloom.threshold).toBeCloseTo(0.6);
    expect(resolved.bloom.intensity).toBeCloseTo(0.65);
    expect(resolved.vignette).toBe(BASELINE_POSTFX.vignette);
  });
});
