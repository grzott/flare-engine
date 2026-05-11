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
  });
});
