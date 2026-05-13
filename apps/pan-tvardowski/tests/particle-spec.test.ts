import { describe, expect, test } from 'bun:test';
import { hexToArgb } from '../src/util/hex';
import { PARTICLE_DEFS } from '../src/visual-spec/particles';
import type { ParticleSpecId } from '../src/visual-spec/types';

const HEX_REGEX = /^#[0-9a-fA-F]{6,8}$/;

describe('particle-spec', () => {
  test('every ParticleDef fill is a valid hex', () => {
    const violations = PARTICLE_DEFS.filter((d) => !HEX_REGEX.test(d.fill)).map(
      (d) => `${d.id}: ${d.fill}`,
    );
    expect(violations).toEqual([]);
  });

  test('every ParticleDef has a positive size', () => {
    const violations = PARTICLE_DEFS.filter((d) => d.size <= 0).map((d) => String(d.id));
    expect(violations).toEqual([]);
  });

  test('particle-smoke has lifetimeMs === 80', () => {
    const def = PARTICLE_DEFS.find((d) => d.id === ('particle-smoke' as ParticleSpecId));
    expect(def).toBeDefined();
    expect(def!.lifetimeMs).toBe(80);
  });

  test('particle-spark has no lifetimeMs', () => {
    const def = PARTICLE_DEFS.find((d) => d.id === ('particle-spark' as ParticleSpecId));
    expect(def).toBeDefined();
    expect(def!.lifetimeMs).toBeUndefined();
  });

  test('particle-smoke fill decodes as ARGB 0x99888888', () => {
    const def = PARTICLE_DEFS.find((d) => d.id === ('particle-smoke' as ParticleSpecId));
    expect(def).toBeDefined();
    expect(hexToArgb(def!.fill)).toBe(0x99888888);
  });
});
