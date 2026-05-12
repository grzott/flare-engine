import { describe, expect, test } from 'bun:test';
import {
  createBloom,
  createChromaticAberration,
  createCrt,
  createGrayscaleFlash,
  createVignette,
} from '../src/effect.js';

describe('effect factories', () => {
  test('vignette has sensible defaults', () => {
    const e = createVignette();
    expect(e.id).toBe('vignette');
    expect(e.enabled).toBe(true);
    expect(e.uniforms).toEqual({ kind: 'vignette', intensity: 0.4, radius: 0.8, color: [0, 0, 0] });
  });

  test('grayscale-flash defaults to 0 intensity (off)', () => {
    const e = createGrayscaleFlash();
    expect(e.uniforms).toEqual({ kind: 'grayscale-flash', intensity: 0 });
  });

  test('chromatic-aberration has small default amount', () => {
    const e = createChromaticAberration();
    expect(e.uniforms.kind).toBe('chromatic-aberration');
    if (e.uniforms.kind === 'chromatic-aberration') {
      expect(e.uniforms.amount).toBeCloseTo(0.005);
    }
  });

  test('crt exposes scanline + curvature', () => {
    const e = createCrt();
    if (e.uniforms.kind === 'crt') {
      expect(e.uniforms.scanlineIntensity).toBeCloseTo(0.25);
      expect(e.uniforms.curvature).toBeCloseTo(0.12);
    }
  });

  test('bloom exposes threshold + intensity', () => {
    const e = createBloom('custom-bloom', { threshold: 0.5, intensity: 1.2 });
    expect(e.id).toBe('custom-bloom');
    if (e.uniforms.kind === 'bloom') {
      expect(e.uniforms.threshold).toBe(0.5);
      expect(e.uniforms.intensity).toBe(1.2);
    }
  });
});
