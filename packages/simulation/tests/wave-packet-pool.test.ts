import { describe, expect, test } from 'bun:test';
import { createRipplePool } from '../src/wave/wave-packet-pool.js';

describe('RipplePool', () => {
  test('emit then sample is nonzero near the ring, ~zero far ahead of it', () => {
    const rp = createRipplePool(8);
    rp.emit(0, 0, 0, 20, 100, 30, 2); // speed 100 px/s, wavelength 30
    // At t=1s the ring radius ≈ 100. Sample on the ring vs far beyond it.
    const onRing = Math.abs(rp.heightAt(100, 0, 1));
    const farAhead = Math.abs(rp.heightAt(400, 0, 1));
    expect(onRing).toBeGreaterThan(farAhead);
    expect(onRing).toBeGreaterThan(0.01);
  });

  test('the wavefront travels outward over time', () => {
    const rp = createRipplePool(8);
    rp.emit(0, 0, 0, 20, 100, 30, 5);
    // The disturbance at r=200 should arrive later (peak nearer t=2) than at r=100 (peak nearer t=1).
    const near = Math.abs(rp.heightAt(100, 0, 1));
    const nearLater = Math.abs(rp.heightAt(100, 0, 2)); // ring has moved past r=100
    const far = Math.abs(rp.heightAt(200, 0, 2)); // ring now near r=200
    expect(far).toBeGreaterThan(nearLater);
    expect(near).toBeGreaterThan(nearLater);
  });

  test('amplitude decays as the front ages', () => {
    const rp = createRipplePool(8);
    rp.emit(0, 0, 0, 20, 100, 30, 1); // short life → fast decay
    const young = Math.abs(rp.heightAt(100, 0, 1)); // age 1, on ring
    const old = Math.abs(rp.heightAt(300, 0, 3)); // age 3, on ring but much older/spread
    expect(young).toBeGreaterThan(old);
  });

  test('prune retires spent wavefronts', () => {
    const rp = createRipplePool(8);
    rp.emit(0, 0, 0, 20, 100, 30, 1);
    expect(rp.count).toBe(1);
    rp.prune(2); // age 2 < life·5 = 5 → still live
    expect(rp.count).toBe(1);
    rp.prune(10); // age 10 > 5 → retired
    expect(rp.count).toBe(0);
  });

  test('emitting past capacity reuses slots, never overflows', () => {
    const rp = createRipplePool(3);
    for (let i = 0; i < 10; i++) rp.emit(0, 0, i, 10, 100, 30, 5);
    expect(rp.count).toBeLessThanOrEqual(3);
    expect(rp.count).toBeGreaterThan(0);
  });

  test('clear drops everything', () => {
    const rp = createRipplePool(4);
    rp.emit(0, 0, 0, 10, 100, 30, 5);
    rp.clear();
    expect(rp.count).toBe(0);
    expect(rp.heightAt(100, 0, 1)).toBe(0);
  });
});
