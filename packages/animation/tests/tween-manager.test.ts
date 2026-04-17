import { describe, expect, it } from 'bun:test';
import { addTween, clearTweens, createTweenManager, updateTweens } from '../src/tween-manager.js';
import { chainTween, tween } from '../src/tween.js';

describe('TweenManager', () => {
  it('starts empty', () => {
    const mgr = createTweenManager();
    expect(mgr.tweens.length).toBe(0);
  });

  it('adds tweens', () => {
    const mgr = createTweenManager();
    addTween(mgr, tween(0, 100, 1));
    addTween(mgr, tween(0, 50, 2));
    expect(mgr.tweens.length).toBe(2);
  });

  it('updates all tweens', () => {
    const mgr = createTweenManager();
    const t1 = tween(0, 100, 1);
    const t2 = tween(0, 200, 2);
    addTween(mgr, t1);
    addTween(mgr, t2);
    updateTweens(mgr, 0.5);
    expect(t1.value).toBeCloseTo(50);
    expect(t2.value).toBeCloseTo(50);
  });

  it('removes completed tweens', () => {
    const mgr = createTweenManager();
    addTween(mgr, tween(0, 100, 1));
    addTween(mgr, tween(0, 200, 2));
    updateTweens(mgr, 1.5);
    // First tween should be done and removed
    expect(mgr.tweens.length).toBe(1);
    expect(mgr.tweens[0]!.value).toBeCloseTo(150);
  });

  it('replaces completed tween with chained tween', () => {
    const mgr = createTweenManager();
    const t1 = tween(0, 100, 1);
    const t2 = tween(100, 200, 1);
    chainTween(t1, t2);
    addTween(mgr, t1);
    // Complete the first tween
    updateTweens(mgr, 1.0);
    // t1 should be replaced by t2
    expect(mgr.tweens.length).toBe(1);
    expect(mgr.tweens[0]).toBe(t2);
  });

  it('clears all tweens', () => {
    const mgr = createTweenManager();
    addTween(mgr, tween(0, 100, 1));
    addTween(mgr, tween(0, 200, 2));
    clearTweens(mgr);
    expect(mgr.tweens.length).toBe(0);
  });

  it('handles all tweens completing at once', () => {
    const mgr = createTweenManager();
    addTween(mgr, tween(0, 100, 1));
    addTween(mgr, tween(0, 200, 1));
    updateTweens(mgr, 1.0);
    expect(mgr.tweens.length).toBe(0);
  });

  it('handles empty update gracefully', () => {
    const mgr = createTweenManager();
    updateTweens(mgr, 1.0);
    expect(mgr.tweens.length).toBe(0);
  });
});
