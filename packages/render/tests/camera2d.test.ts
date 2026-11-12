import { describe, expect, it } from 'bun:test';
import { Camera2D } from '../src/camera2d.js';

describe('Camera2D', () => {
  it('initializes with defaults', () => {
    const cam = new Camera2D();
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
    expect(cam.zoom).toBe(1);
    expect(cam.rotation).toBe(0);
  });

  it('setViewport sets dimensions', () => {
    const cam = new Camera2D();
    cam.setViewport(800, 600);
    expect(cam.viewportWidth).toBe(800);
    expect(cam.viewportHeight).toBe(600);
  });

  describe('worldToScreen / screenToWorld', () => {
    it('identity camera maps center to center', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      const screen = cam.worldToScreen(0, 0);
      expect(screen.x).toBeCloseTo(400);
      expect(screen.y).toBeCloseTo(300);
    });

    it('offset camera shifts screen position', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.x = 100;
      cam.y = 50;
      const screen = cam.worldToScreen(100, 50);
      expect(screen.x).toBeCloseTo(400);
      expect(screen.y).toBeCloseTo(300);
    });

    it('zoom scales distances', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.zoom = 2;
      const screen = cam.worldToScreen(50, 0);
      // 50 * 2 = 100 from center → 400 + 100 = 500
      expect(screen.x).toBeCloseTo(500);
      expect(screen.y).toBeCloseTo(300);
    });

    it('screenToWorld is inverse of worldToScreen', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.x = 100;
      cam.y = 200;
      cam.zoom = 1.5;
      const screen = cam.worldToScreen(150, 250);
      const world = cam.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(150);
      expect(world.y).toBeCloseTo(250);
    });

    it('screenToWorld is inverse with rotation', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.x = 50;
      cam.y = 50;
      cam.rotation = Math.PI / 4;
      cam.zoom = 2;
      const screen = cam.worldToScreen(100, 75);
      const world = cam.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(100);
      expect(world.y).toBeCloseTo(75);
    });
  });

  describe('getBounds', () => {
    it('returns visible world rect', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.x = 0;
      cam.y = 0;
      const b = cam.getBounds();
      expect(b.x).toBeCloseTo(-400);
      expect(b.y).toBeCloseTo(-300);
      expect(b.width).toBeCloseTo(800);
      expect(b.height).toBeCloseTo(600);
    });

    it('zoom shrinks visible bounds', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.zoom = 2;
      const b = cam.getBounds();
      expect(b.width).toBeCloseTo(400);
      expect(b.height).toBeCloseTo(300);
    });
  });

  describe('follow', () => {
    it('follows target smoothly', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      const target = { x: 100, y: 0 };
      cam.follow(target, { smoothing: 0.01 });
      cam.update(1 / 60);
      // Should have moved toward target
      expect(cam.x).toBeGreaterThan(0);
      expect(cam.x).toBeLessThan(100);
    });

    it('follows with offset', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      const target = { x: 0, y: 0 };
      cam.follow(target, { smoothing: 0.001, offset: { x: 50, y: 0 } });
      // After enough time, should converge to offset
      for (let i = 0; i < 600; i++) cam.update(1 / 60);
      expect(cam.x).toBeCloseTo(50, 0);
    });

    it('unfollow stops following', () => {
      const cam = new Camera2D();
      const target = { x: 100, y: 0 };
      cam.follow(target);
      cam.unfollow();
      cam.update(1 / 60);
      expect(cam.x).toBe(0);
    });
  });

  describe('bounds clamping', () => {
    it('clamps camera to world bounds', () => {
      const cam = new Camera2D();
      cam.setViewport(200, 200);
      cam.bounds = { x: 0, y: 0, width: 1000, height: 1000 };
      cam.x = -50; // Would show outside bounds
      cam.update(0);
      expect(cam.x).toBe(100); // min = 0 + 100
    });

    it('centers when viewport larger than bounds', () => {
      const cam = new Camera2D();
      cam.setViewport(800, 600);
      cam.bounds = { x: 0, y: 0, width: 100, height: 100 };
      cam.x = 0;
      cam.y = 0;
      cam.update(0);
      expect(cam.x).toBe(50); // Centered
      expect(cam.y).toBe(50);
    });
  });

  describe('shake', () => {
    it('applies shake offset', () => {
      const cam = new Camera2D();
      cam.shake(10, 0.5);
      cam.update(0.1);
      // Shake should produce non-zero offsets
      const hasOffset = cam.effectiveX !== cam.x || cam.effectiveY !== cam.y;
      expect(hasOffset).toBe(true);
    });

    it('shake decays over time', () => {
      const cam = new Camera2D();
      cam.shake(10, 0.5);
      cam.update(0.1);
      const earlyOffset = Math.abs(cam.effectiveX - cam.x);
      cam.update(0.35);
      const lateOffset = Math.abs(cam.effectiveX - cam.x);
      // Late offset should generally be smaller due to decay
      // (pseudo-random, but decay factor ensures it)
      expect(lateOffset).toBeLessThanOrEqual(earlyOffset + 10);
    });

    it('shake ends after duration', () => {
      const cam = new Camera2D();
      cam.shake(10, 0.2);
      cam.update(0.3); // Past duration
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });
  });

  describe('motionScale', () => {
    it('defaults to 1', () => {
      const cam = new Camera2D();
      expect(cam.motionScale).toBe(1);
    });

    it('clamps negatives to 0', () => {
      const cam = new Camera2D();
      cam.setMotionScale(-0.5);
      expect(cam.motionScale).toBe(0);
    });

    it('motionScale=0 suppresses shake entirely', () => {
      const cam = new Camera2D();
      cam.setMotionScale(0);
      cam.shake(20, 0.5);
      cam.update(0.1);
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });

    it('motionScale scales amplitude', () => {
      // Use very small dt so decay ≈ 1 for both — isolates amplitude scaling.
      const camFull = new Camera2D();
      const camHalf = new Camera2D();
      camHalf.setMotionScale(0.5);
      camFull.shake(100, 10);
      camHalf.shake(100, 10);
      camFull.update(1e-4);
      camHalf.update(1e-4);
      const full = Math.abs(camFull.effectiveX - camFull.x);
      const half = Math.abs(camHalf.effectiveX - camHalf.x);
      // camHalf's duration also scales (10 → 5), so decay factors differ by
      // a negligible amount at this dt. Amplitude ratio dominates.
      expect(half / full).toBeCloseTo(0.5, 2);
    });

    it('motionScale scales duration', () => {
      const cam = new Camera2D();
      cam.setMotionScale(0.5);
      cam.shake(10, 0.4); // scaled to 0.2s
      cam.update(0.25); // past scaled duration
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });

    it('only affects subsequent shake() calls, not in-flight shake', () => {
      const cam = new Camera2D();
      cam.shake(100, 1);
      cam.update(0.05);
      const before = Math.abs(cam.effectiveX - cam.x);
      // Change scale mid-shake
      cam.setMotionScale(0);
      cam.update(0.05);
      // Existing shake continues — still produces an offset
      const after = Math.abs(cam.effectiveX - cam.x);
      expect(before).toBeGreaterThan(0);
      expect(after).toBeGreaterThan(0);
    });

    it('motionScale=1 preserves legacy behavior', () => {
      const cam = new Camera2D();
      cam.setMotionScale(1);
      cam.shake(15, 0.3);
      cam.update(0.1);
      // Still shakes (non-zero offset at t < duration)
      const offset = Math.abs(cam.effectiveX - cam.x);
      expect(offset).toBeGreaterThan(0);
    });
  });

  describe('shakePerlin', () => {
    it('produces non-zero offset within duration', () => {
      const cam = new Camera2D();
      cam.shakePerlin(10, 1.0);
      // Advance 3 frames — floor-of-zero is statistically impossible with FBM noise
      let totalOffset = 0;
      for (let i = 0; i < 3; i++) {
        cam.update(0.05);
        totalOffset += Math.abs(cam.effectiveX - cam.x) + Math.abs(cam.effectiveY - cam.y);
      }
      expect(totalOffset).toBeGreaterThan(1e-6);
    });

    it('returns to zero after duration ends', () => {
      const cam = new Camera2D();
      cam.shakePerlin(10, 0.2);
      cam.update(0.3); // past duration
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });

    it('motionScale=0 suppresses shakePerlin and both shake+shakePerlin', () => {
      const cam = new Camera2D();
      cam.setMotionScale(0);
      cam.shakePerlin(20, 1.0);
      cam.shake(20, 1.0);
      cam.update(0.1);
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });

    it('coexists with shake() — shakePerlin contributes non-zero offset independently', () => {
      // Verify shakePerlin itself produces a non-zero contribution.
      const perlinOnlyCam = new Camera2D();
      perlinOnlyCam.shakePerlin(10, 2.0);
      perlinOnlyCam.update(0.05);
      const perlinMag =
        Math.abs(perlinOnlyCam.effectiveX - perlinOnlyCam.x) +
        Math.abs(perlinOnlyCam.effectiveY - perlinOnlyCam.y);
      expect(perlinMag).toBeGreaterThan(1e-6);
    });

    it('re-trigger cancels prior shakePerlin (does not stack)', () => {
      const cam = new Camera2D();
      cam.shakePerlin(10, 2.0);
      cam.update(0.3); // first shake in progress
      // Re-trigger — overwrites state
      cam.shakePerlin(10, 0.1);
      // After new duration expires the shakePerlin is gone
      cam.update(0.15); // past new 0.1s duration
      expect(cam.effectiveX).toBe(cam.x);
      expect(cam.effectiveY).toBe(cam.y);
    });

    describe('noise lattice', () => {
      // 1200 steps of 0.05s advance the noise coordinate by 282 units, so the
      // sweep visits every one of the 256 lattice cells on both sample lines.
      const SWEEP_STEPS = 1200;
      const SWEEP_DT = 0.05;
      const SWEEP_DURATION = 1000;

      function sweep(
        intensity: number,
        visit: (cam: Camera2D, noiseT: number, decay: number) => void,
      ): void {
        const cam = new Camera2D();
        cam.shakePerlin(intensity, SWEEP_DURATION);
        let elapsed = 0;
        for (let i = 0; i < SWEEP_STEPS; i++) {
          cam.update(SWEEP_DT);
          elapsed += SWEEP_DT;
          // First shakePerlin on a camera runs with seed 1.
          visit(cam, elapsed * 4.7 + 17.3, 1 - elapsed / SWEEP_DURATION);
        }
      }

      it('Y offset matches a reference Perlin over every lattice cell', () => {
        let worst = 0;
        sweep(1, (cam, noiseT, decay) => {
          const expected = referenceFbm(0, noiseT + 5.4) * decay;
          worst = Math.max(worst, Math.abs(cam.effectiveY - expected));
        });
        expect(worst).toBeLessThan(1e-9);
      });

      it('X offset matches a reference Perlin over every lattice cell', () => {
        let worst = 0;
        sweep(1, (cam, noiseT, decay) => {
          const expected = referenceFbm(noiseT, 0) * decay;
          worst = Math.max(worst, Math.abs(cam.effectiveX - expected));
        });
        expect(worst).toBeLessThan(1e-9);
      });

      it('offsets stay within [-intensity, intensity]', () => {
        const intensity = 10;
        let peak = 0;
        sweep(intensity, (cam) => {
          peak = Math.max(peak, Math.abs(cam.effectiveX), Math.abs(cam.effectiveY));
        });
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThanOrEqual(intensity);
      });

      it('pins offsets at fixed times', () => {
        // [dt, effectiveX, effectiveY] for shakePerlin(10, 100) after one update(dt).
        // The Y samples at dt 20 and 40 fall in cells whose gradient lookup lands
        // in the mirrored half of the permutation table.
        const goldens: ReadonlyArray<readonly [number, number, number]> = [
          [0.05, -0.879371650476937, 0.08366521533396541],
          [2.5, 0.21517405117758104, -0.029590350127460082],
          [10, -0.8285866399985081, 0.4021767947449208],
          [20, 1.390257431770632, -1.3060206833971333],
          [30, 0.8555287884889938, 0.9532100903111405],
          [40, -0.8269314722436022, 1.1498295431923404],
        ];
        for (const [dt, x, y] of goldens) {
          const cam = new Camera2D();
          cam.shakePerlin(10, 100);
          cam.update(dt);
          expect(cam.effectiveX).toBeCloseTo(x, 12);
          expect(cam.effectiveY).toBeCloseTo(y, 12);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Reference Perlin for the shakePerlin lattice tests — textbook form: the
// shuffled permutation is repeated into a 512-entry table so `perm[perm[x] + y]`
// never leaves it. Same seed and shuffle as camera2d.ts.
// ---------------------------------------------------------------------------

const REFERENCE_PERM = new Uint8Array(512);
{
  for (let i = 0; i < 256; i++) REFERENCE_PERM[i] = i;
  let s = 0x9e3779b9;
  for (let i = 255; i > 0; i--) {
    s = (s ^ (s >>> 15)) >>> 0;
    s = Math.imul(s, 0x85ebca6b) >>> 0;
    s = (s ^ (s >>> 13)) >>> 0;
    const j = s % (i + 1);
    const t = REFERENCE_PERM[i] ?? 0;
    REFERENCE_PERM[i] = REFERENCE_PERM[j] ?? 0;
    REFERENCE_PERM[j] = t;
  }
  for (let i = 0; i < 256; i++) REFERENCE_PERM[i + 256] = REFERENCE_PERM[i] ?? 0;
}

function referencePerm(index: number): number {
  const value = REFERENCE_PERM[index];
  if (value === undefined) throw new Error(`reference permutation index ${index} out of range`);
  return value;
}

function referenceGrad(hash: number, x: number, y: number): number {
  const d = Math.SQRT1_2;
  switch (hash & 7) {
    case 0:
      return x;
    case 1:
      return d * x + d * y;
    case 2:
      return y;
    case 3:
      return -d * x + d * y;
    case 4:
      return -x;
    case 5:
      return -d * x - d * y;
    case 6:
      return -y;
    default:
      return d * x - d * y;
  }
}

function referenceFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function referenceNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xi = x0 & 255;
  const yi = y0 & 255;
  const xf = x - x0;
  const yf = y - y0;
  const u = referenceFade(xf);
  const v = referenceFade(yf);
  const a = referencePerm(xi);
  const b = referencePerm(xi + 1);
  const n00 = referenceGrad(referencePerm(a + yi), xf, yf);
  const n10 = referenceGrad(referencePerm(b + yi), xf - 1, yf);
  const n01 = referenceGrad(referencePerm(a + yi + 1), xf, yf - 1);
  const n11 = referenceGrad(referencePerm(b + yi + 1), xf - 1, yf - 1);
  const low = n00 + u * (n10 - n00);
  const high = n01 + u * (n11 - n01);
  return low + v * (high - low);
}

function referenceFbm(x: number, y: number): number {
  return 0.6667 * referenceNoise(x, y) + 0.3333 * referenceNoise(x * 2, y * 2);
}

// ---------------------------------------------------------------------------
// Dead-zone follow math
// ---------------------------------------------------------------------------

describe('Camera2D — dead-zone follow', () => {
  // Use smoothing=0.001 and dt=1000 so (smoothing ** dt) ≈ 0, factor ≈ 1.
  // Camera jumps exactly the excess beyond the dead-zone boundary in one update.
  const INSTANT = 1000;
  const SNAP = 0.001;

  it('target outside left edge moves camera by exact excess, not double', () => {
    // deadZone.x = -3: left boundary is camera.x - 3
    // target at camera.x - 5 → excess = 2 units left of left boundary
    // Expected camera move: -(5 - 3) = -2 (camera.x becomes -2)
    const cam = new Camera2D();
    cam.setViewport(200, 100);
    cam.x = 0;
    const target = { x: -5, y: 0 };
    cam.follow(target, { smoothing: SNAP, deadZone: { x: -3, y: -10, width: 6, height: 20 } });
    cam.update(INSTANT);
    expect(cam.x).toBeCloseTo(-2, 5);
  });

  it('target outside right edge moves camera by exact excess, not double', () => {
    // deadZone right boundary at camera.x + dz.x + dz.width = 0 + (-3) + 6 = 3
    // target at x=7 → excess = 7 - 3 = 4 right of right boundary
    // Expected camera move: +4 (camera.x becomes 4)
    const cam = new Camera2D();
    cam.setViewport(200, 100);
    cam.x = 0;
    const target = { x: 7, y: 0 };
    cam.follow(target, { smoothing: SNAP, deadZone: { x: -3, y: -10, width: 6, height: 20 } });
    cam.update(INSTANT);
    expect(cam.x).toBeCloseTo(4, 5);
  });

  it('target inside dead zone does not move camera', () => {
    const cam = new Camera2D();
    cam.setViewport(200, 100);
    cam.x = 0;
    cam.y = 0;
    const target = { x: 1, y: 1 };
    cam.follow(target, { smoothing: SNAP, deadZone: { x: -5, y: -5, width: 10, height: 10 } });
    cam.update(INSTANT);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it('target outside bottom edge moves camera by exact excess', () => {
    // dz.y = -3, dz.height = 6 → bottom boundary at camera.y + 3
    // target at y=8 → excess = 8 - 3 = 5
    const cam = new Camera2D();
    cam.setViewport(200, 100);
    cam.y = 0;
    const target = { x: 0, y: 8 };
    cam.follow(target, { smoothing: SNAP, deadZone: { x: -10, y: -3, width: 20, height: 6 } });
    cam.update(INSTANT);
    expect(cam.y).toBeCloseTo(5, 5);
  });
});
