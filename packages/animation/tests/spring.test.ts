import { describe, expect, it } from 'bun:test';
import { resetSpring, setSpringTarget, spring, updateSpring } from '../src/spring.js';

describe('Spring', () => {
  it('creates a spring with defaults', () => {
    const s = spring(0, 100);
    expect(s.value).toBe(0);
    expect(s.target).toBe(100);
    expect(s.velocity).toBe(0);
    expect(s.atRest).toBe(false);
    expect(s.config.stiffness).toBe(100);
    expect(s.config.damping).toBe(10);
    expect(s.config.mass).toBe(1);
  });

  it('is at rest when value equals target', () => {
    const s = spring(50, 50);
    expect(s.atRest).toBe(true);
  });

  it('moves toward target over time', () => {
    const s = spring(0, 100);
    for (let i = 0; i < 100; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.value).toBeCloseTo(100, 0);
  });

  it('settles at target (atRest becomes true)', () => {
    const s = spring(0, 100, { stiffness: 200, damping: 30 });
    for (let i = 0; i < 600; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.atRest).toBe(true);
    expect(s.value).toBe(100);
  });

  it('does not move when at rest', () => {
    const s = spring(50, 50);
    const before = s.value;
    updateSpring(s, 1 / 60);
    expect(s.value).toBe(before);
  });

  it('oscillates with low damping', () => {
    const s = spring(0, 100, { stiffness: 200, damping: 2 });
    // Simulate a bit
    let maxValue = 0;
    for (let i = 0; i < 60; i++) {
      updateSpring(s, 1 / 60);
      if (s.value > maxValue) maxValue = s.value;
    }
    // With low damping, should overshoot past 100
    expect(maxValue).toBeGreaterThan(100);
  });

  it('setSpringTarget wakes a resting spring', () => {
    const s = spring(50, 50);
    expect(s.atRest).toBe(true);
    setSpringTarget(s, 100);
    expect(s.atRest).toBe(false);
    expect(s.target).toBe(100);
  });

  it('resetSpring zeroes velocity and sets both value and target', () => {
    const s = spring(0, 100);
    for (let i = 0; i < 10; i++) updateSpring(s, 1 / 60);
    resetSpring(s, 42);
    expect(s.value).toBe(42);
    expect(s.target).toBe(42);
    expect(s.velocity).toBe(0);
    expect(s.atRest).toBe(true);
  });

  it('handles custom config', () => {
    const s = spring(0, 100, { stiffness: 300, damping: 20, mass: 2 });
    expect(s.config.stiffness).toBe(300);
    expect(s.config.damping).toBe(20);
    expect(s.config.mass).toBe(2);
  });

  it('converges from both directions', () => {
    const s = spring(200, 100, { stiffness: 200, damping: 30 });
    for (let i = 0; i < 600; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.value).toBeCloseTo(100, 0);
    expect(s.atRest).toBe(true);
  });
});
