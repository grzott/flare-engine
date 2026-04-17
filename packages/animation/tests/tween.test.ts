import { describe, expect, it } from 'bun:test';
import { easeInQuad } from '@flare/math';
import { chainTween, resetTween, tween, updateTween } from '../src/tween.js';

describe('Tween', () => {
  it('creates a tween with defaults', () => {
    const tw = tween(0, 100, 1);
    expect(tw.from).toBe(0);
    expect(tw.to).toBe(100);
    expect(tw.duration).toBe(1);
    expect(tw.value).toBe(0);
    expect(tw.done).toBe(false);
  });

  it('interpolates linearly by default', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 0.5);
    expect(tw.value).toBeCloseTo(50, 5);
    expect(tw.done).toBe(false);
  });

  it('completes at end of duration', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 1.0);
    expect(tw.value).toBe(100);
    expect(tw.done).toBe(true);
  });

  it('clamps to final value when overshooting', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 2.0);
    expect(tw.value).toBe(100);
    expect(tw.done).toBe(true);
  });

  it('uses custom easing', () => {
    const tw = tween(0, 100, 1, easeInQuad);
    updateTween(tw, 0.5);
    // easeInQuad(0.5) = 0.25
    expect(tw.value).toBeCloseTo(25, 5);
  });

  it('accumulates multiple update calls', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 0.3);
    updateTween(tw, 0.3);
    expect(tw.value).toBeCloseTo(60, 5);
  });

  it('does not advance when already done', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 1.0);
    const val = updateTween(tw, 0.5);
    expect(val).toBe(100);
  });

  it('calls onComplete when done', () => {
    const tw = tween(0, 100, 1);
    let called = false;
    tw.onComplete = () => {
      called = true;
    };
    updateTween(tw, 1.0);
    expect(called).toBe(true);
  });

  it('onComplete is called only once', () => {
    const tw = tween(0, 100, 1);
    let count = 0;
    tw.onComplete = () => {
      count++;
    };
    updateTween(tw, 1.0);
    updateTween(tw, 0.5);
    expect(count).toBe(1);
  });

  it('chains tweens', () => {
    const tw1 = tween(0, 100, 1);
    const tw2 = tween(100, 200, 1);
    chainTween(tw1, tw2);
    expect(tw1.next).toBe(tw2);
  });

  it('resets a tween', () => {
    const tw = tween(0, 100, 1);
    updateTween(tw, 0.7);
    resetTween(tw);
    expect(tw.elapsed).toBe(0);
    expect(tw.value).toBe(0);
    expect(tw.done).toBe(false);
  });

  it('handles zero-duration tween', () => {
    const tw = tween(0, 100, 0);
    updateTween(tw, 0.001);
    expect(tw.value).toBe(100);
    expect(tw.done).toBe(true);
  });

  it('handles negative from/to values', () => {
    const tw = tween(-50, 50, 1);
    updateTween(tw, 0.5);
    expect(tw.value).toBeCloseTo(0, 5);
  });

  it('handles reverse tween (to < from)', () => {
    const tw = tween(100, 0, 1);
    updateTween(tw, 0.5);
    expect(tw.value).toBeCloseTo(50, 5);
  });
});
