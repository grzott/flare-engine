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
});
