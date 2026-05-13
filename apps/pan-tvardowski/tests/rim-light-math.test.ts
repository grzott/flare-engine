/**
 * Deterministic unit tests for rim-light pure-number helpers.
 *
 * SkSL GPU execution is intentionally NOT tested here — shader correctness
 * is on-device only (local Android emulator + TestingBot Pixel 10 + iPhone 16 Pro).
 */
import { describe, expect, test } from 'bun:test';
import {
  RIM_LIGHT_UNIFORM_COUNT,
  analyticalNormal,
  attenuation,
  packRimLightUniforms,
} from '../src/lighting/rim-light-runtime';

describe('packRimLightUniforms', () => {
  test('fills 12 slots in declaration order', () => {
    const buf = new Float32Array(RIM_LIGHT_UNIFORM_COUNT);
    packRimLightUniforms(buf, 360, 640, 180, 80, 1.0, 0.72, 0.25, 1.8, 160, 180, 100, 48);

    expect(buf[0]).toBe(360); // width
    expect(buf[1]).toBe(640); // height
    expect(buf[2]).toBe(180); // lightX
    expect(buf[3]).toBe(80); // lightY
    expect(buf[4]).toBeCloseTo(1.0); // lightR
    expect(buf[5]).toBeCloseTo(0.72); // lightG
    expect(buf[6]).toBeCloseTo(0.25); // lightB
    expect(buf[7]).toBeCloseTo(1.8); // lightIntensity
    expect(buf[8]).toBe(160); // lightRadius
    expect(buf[9]).toBe(180); // bossX
    expect(buf[10]).toBe(100); // bossY
    expect(buf[11]).toBe(48); // bossRadius
  });

  test('slot count matches RIM_LIGHT_UNIFORM_COUNT', () => {
    expect(RIM_LIGHT_UNIFORM_COUNT).toBe(12);
  });

  test('mutates the same buffer instance — no alloc after first call', () => {
    const buf = new Float32Array(RIM_LIGHT_UNIFORM_COUNT);
    const ref = buf;
    packRimLightUniforms(buf, 360, 640, 10, 20, 1, 1, 1, 1, 100, 0, 0, 40);
    // Re-call with different values: same reference, updated contents.
    packRimLightUniforms(buf, 720, 1280, 90, 50, 0.5, 0.5, 0.5, 2.0, 200, 360, 200, 60);
    expect(buf).toBe(ref);
    expect(buf[0]).toBe(720);
    expect(buf[2]).toBe(90);
    expect(buf[11]).toBe(60);
  });
});

describe('analyticalNormal', () => {
  test('at boss center (dx=0, dy=0) returns (0, 0, 1)', () => {
    const [nx, ny, nz] = analyticalNormal(0, 0, 48);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeCloseTo(0);
    expect(nz).toBeCloseTo(1);
  });

  test('at exact bossRadius edge is radial unit vector in XY (nz~=0)', () => {
    const r = 48;
    // Point directly to the right.
    const [nx, ny, nz] = analyticalNormal(r, 0, r);
    expect(nx).toBeCloseTo(1, 3);
    expect(ny).toBeCloseTo(0, 3);
    // nz = sqrt(1 - t²) where t=1 → nz = 0
    expect(nz).toBeCloseTo(0, 3);
  });

  test('at 45-degree edge point is unit vector', () => {
    const r = 48;
    const [nx, ny, nz] = analyticalNormal(r, 0, r);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    expect(len).toBeCloseTo(1, 5);
  });

  test('at halfway radius vector length is 1', () => {
    const r = 48;
    const [nx, ny, nz] = analyticalNormal(r / 2, 0, r);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    expect(len).toBeCloseTo(1, 5);
  });

  test('at center returns (0,0,1) regardless of radius', () => {
    for (const rad of [10, 48, 200]) {
      const [nx, ny, nz] = analyticalNormal(0, 0, rad);
      expect(nx).toBeCloseTo(0);
      expect(ny).toBeCloseTo(0);
      expect(nz).toBeCloseTo(1);
    }
  });
});

describe('attenuation', () => {
  test('at d=0 returns 1.0', () => {
    expect(attenuation(0, 160)).toBeCloseTo(1.0);
  });

  test('at d=lightRadius returns ~0.5', () => {
    // 1 / (1 + r²/r²) = 1 / 2 = 0.5
    const r = 160;
    expect(attenuation(r, r)).toBeCloseTo(0.5, 5);
  });

  test('at d=2*lightRadius returns ~0.2', () => {
    // 1 / (1 + (2r)²/r²) = 1 / (1 + 4) = 0.2
    const r = 160;
    expect(attenuation(2 * r, r)).toBeCloseTo(0.2, 5);
  });

  test('returns 0 when lightRadius is 0', () => {
    expect(attenuation(10, 0)).toBe(0);
  });

  test('attenuation decreases monotonically with distance', () => {
    const r = 100;
    let prev = attenuation(0, r);
    for (const d of [10, 20, 50, 100, 200, 500]) {
      const cur = attenuation(d, r);
      expect(cur).toBeLessThan(prev);
      prev = cur;
    }
  });
});
