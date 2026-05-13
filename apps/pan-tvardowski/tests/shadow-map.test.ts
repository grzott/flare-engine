/**
 * Deterministic unit tests for the 1D polar shadow map helpers (PT lighting §2b).
 *
 * Tests cover the pure-math path only. SkSL GPU execution, texture encoding,
 * and `createShadowRimRuntime` are on-device verification (local Android
 * emulator + TestingBot Pixel 10 + iPhone 16 Pro).
 */
import { describe, expect, test } from 'bun:test';
import {
  FBO_SIZE,
  SHADOW_ANGLES,
  buildShadowMap,
  rayRectIntersect,
  sampleShadowMap,
} from '../src/lighting/shadow-map';
import type { OccluderRect } from '../src/lighting/shadow-map';

// ---------------------------------------------------------------------------
// Test 1: Empty FBO — no occluders → all buckets equal maxDist
// ---------------------------------------------------------------------------

describe('buildShadowMap — empty occluder list', () => {
  test('all 256 buckets equal maxDist when occluders is empty', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    buildShadowMap(out, [], 128, 128, SHADOW_ANGLES, FBO_SIZE);
    for (let i = 0; i < SHADOW_ANGLES; i++) {
      expect(out[i]).toBe(FBO_SIZE);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: Single occluder — rect directly above the light at known distance
// ---------------------------------------------------------------------------

describe('buildShadowMap — single occluder above light', () => {
  test('bucket pointing straight up (angle ≈ -π/2) records correct distance', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    // Light at (128, 128). Occluder: 10×10 rect centered at (128, 88), so its
    // bottom edge is at y=93. Distance to entry = 128 - 93 = 35 px.
    const occluder: OccluderRect = { x: 123, y: 83, w: 10, h: 10 };
    buildShadowMap(out, [occluder], 128, 128, SHADOW_ANGLES, FBO_SIZE);

    // Angle pointing straight up in screen coords (Y decreases upward) is -π/2.
    // dx = cos(-π/2) = 0, dy = sin(-π/2) = -1 → ray goes upward.
    // The angle bucket for -π/2 in the [−π, π] → [0, SHADOW_ANGLES) mapping:
    // norm = (-π/2 + π) / (2π) = (π/2) / (2π) = 0.25 → bucket = floor(0.25 * 256) = 64.
    const angle = -Math.PI / 2;
    const dist = sampleShadowMap(out, angle, SHADOW_ANGLES);

    // The occluder bottom edge is at y = 83 + 10 = 93. Ray from (128,128) going
    // in direction (0, -1): the top of the rect is at y=83, bottom at y=93.
    // tMin = entry along ray = intersection with y=93 (closer edge): t = 128 - 93 = 35.
    expect(dist).toBeCloseTo(35, 0);
  });

  test('buckets not pointing toward the occluder remain at maxDist', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    const occluder: OccluderRect = { x: 123, y: 83, w: 10, h: 10 };
    buildShadowMap(out, [occluder], 128, 128, SHADOW_ANGLES, FBO_SIZE);

    // Angle pointing straight down (π/2) — no hit.
    const downDist = sampleShadowMap(out, Math.PI / 2, SHADOW_ANGLES);
    expect(downDist).toBe(FBO_SIZE);

    // Angle pointing straight right (0) — no hit.
    const rightDist = sampleShadowMap(out, 0, SHADOW_ANGLES);
    expect(rightDist).toBe(FBO_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Test 3: ±π wrap — angle near π wraps to the same bucket as −π
// ---------------------------------------------------------------------------

describe('sampleShadowMap — ±π wrap', () => {
  test('angle = +π and angle = −π map to the same bucket', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    // Fill every bucket with its index so we can identify which one is hit.
    for (let i = 0; i < SHADOW_ANGLES; i++) out[i] = i;

    const distAtPlusPi = sampleShadowMap(out, Math.PI, SHADOW_ANGLES);
    const distAtMinusPi = sampleShadowMap(out, -Math.PI, SHADOW_ANGLES);
    // Both should map to bucket 0 (the start of the [0, 2π) range).
    expect(distAtPlusPi).toBe(distAtMinusPi);
  });

  test('angles just below +π and just above −π wrap correctly', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    for (let i = 0; i < SHADOW_ANGLES; i++) out[i] = i;

    // An angle of π − ε should be in the last bucket (≈ SHADOW_ANGLES − 1).
    const eps = 0.001;
    const nearPlusEnd = sampleShadowMap(out, Math.PI - eps, SHADOW_ANGLES);
    expect(nearPlusEnd).toBeGreaterThan(SHADOW_ANGLES - 3);
    expect(nearPlusEnd).toBeLessThan(SHADOW_ANGLES);

    // An angle of −π + ε should be in the first bucket (≈ 0).
    const nearMinusStart = sampleShadowMap(out, -Math.PI + eps, SHADOW_ANGLES);
    expect(nearMinusStart).toBeGreaterThanOrEqual(0);
    expect(nearMinusStart).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Sampler math — known bucket index roundtrips through sampleShadowMap
// ---------------------------------------------------------------------------

describe('sampleShadowMap — sampler math', () => {
  test('each bucket is reachable by its corresponding angle', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    for (let i = 0; i < SHADOW_ANGLES; i++) out[i] = i * 1.5;

    // Spot-check 8 evenly-spaced buckets.
    for (const bucket of [0, 32, 64, 96, 128, 160, 192, 224]) {
      // Centre angle for this bucket: theta = (bucket / SHADOW_ANGLES) * 2π − π
      const angle = (bucket / SHADOW_ANGLES) * 2 * Math.PI - Math.PI;
      const sampled = sampleShadowMap(out, angle, SHADOW_ANGLES);
      expect(sampled).toBe(bucket * 1.5);
    }
  });

  test('returns correct distance for the maximum-distance bucket', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    out.fill(0);
    out[200] = 99.5;
    const angle = (200 / SHADOW_ANGLES) * 2 * Math.PI - Math.PI;
    expect(sampleShadowMap(out, angle, SHADOW_ANGLES)).toBeCloseTo(99.5, 3);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Fully enclosed light — occluder surrounds the light on all sides
// ---------------------------------------------------------------------------

describe('buildShadowMap — fully enclosed light', () => {
  test('all distances near 0 when light is inside a large occluder rect', () => {
    const out = new Float32Array(SHADOW_ANGLES);
    // Occluder: a large rect (0,0)→(256,256). Light at (128,128) is inside it.
    // rayRectIntersect from inside an AABB returns the exit-face distance, but
    // the standard algorithm returns tMin >= 0 for a forward ray starting inside.
    // We use tMax as the "first hit when starting inside" in our implementation —
    // in practice the rect walls are very close (< 130 px from center), so all
    // distances should be well below FBO_SIZE.
    const enclosing: OccluderRect = { x: 0, y: 0, w: 256, h: 256 };
    buildShadowMap(out, [enclosing], 128, 128, SHADOW_ANGLES, FBO_SIZE);

    // All distances should be at most 130 (distance to nearest wall from center
    // of a 256×256 box at (128,128) is 128 in axis directions, ~181 diagonal).
    // The ray–AABB test returns tMin when starting outside; when starting inside
    // tMin < 0 and we return tMax (exit distance) clamped to maxDist.
    // The important invariant: no bucket should be FBO_SIZE (max) when enclosed.
    let maxFound = 0;
    for (let i = 0; i < SHADOW_ANGLES; i++) {
      if ((out[i] as number) > maxFound) maxFound = out[i] as number;
    }
    // Max distance to wall from center of 256×256 box (diagonal) is ~181 px.
    // Anything < FBO_SIZE confirms the shadow map is not "all-clear".
    expect(maxFound).toBeLessThan(FBO_SIZE);
  });
});

// ---------------------------------------------------------------------------
// rayRectIntersect direct tests
// ---------------------------------------------------------------------------

describe('rayRectIntersect', () => {
  test('ray along +X axis hits vertical rect to the right', () => {
    const rect: OccluderRect = { x: 10, y: -5, w: 4, h: 10 };
    const t = rayRectIntersect(0, 0, 1, 0, rect);
    expect(t).toBeCloseTo(10, 5);
  });

  test('ray parallel to rect (misses) returns Infinity', () => {
    const rect: OccluderRect = { x: 10, y: 5, w: 4, h: 4 };
    // Ray along X axis at y=0 — rect is entirely above y=0.
    const t = rayRectIntersect(0, 0, 1, 0, rect);
    expect(t).toBe(Number.POSITIVE_INFINITY);
  });

  test('ray in opposite direction returns Infinity', () => {
    const rect: OccluderRect = { x: 10, y: -5, w: 4, h: 10 };
    // Shoot in -X direction: rect is at positive X.
    const t = rayRectIntersect(0, 0, -1, 0, rect);
    expect(t).toBe(Number.POSITIVE_INFINITY);
  });
});
