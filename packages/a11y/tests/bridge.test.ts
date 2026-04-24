import { describe, expect, test } from 'bun:test';
import { A11yManager, createA11yBridge } from '../src/index.js';

function makeTarget() {
  const calls: number[] = [];
  return {
    calls,
    setMotionScale(k: number) {
      calls.push(k);
    },
  };
}

describe('createA11yBridge', () => {
  test('constructs its own manager when one is not provided', () => {
    const b = createA11yBridge({ initial: { reducedMotion: true } });
    expect(b.manager).toBeInstanceOf(A11yManager);
    expect(b.manager.reducedMotion).toBe(true);
  });

  test('uses the provided manager', () => {
    const m = new A11yManager({ initial: { reducedMotion: false } });
    const b = createA11yBridge({ manager: m });
    expect(b.manager).toBe(m);
  });

  test('attach applies current motion scale immediately', () => {
    const b = createA11yBridge({ initial: { reducedMotion: false } });
    const target = makeTarget();
    b.attach(target);
    expect(target.calls).toEqual([1]);
  });

  test('attach receives updates when manager changes', () => {
    const b = createA11yBridge();
    const target = makeTarget();
    b.attach(target);

    b.manager.setReducedMotion(true);
    b.manager.setReducedMotion(false);

    expect(target.calls).toEqual([1, 0, 1]);
  });

  test('unsubscribe stops further updates', () => {
    const b = createA11yBridge();
    const target = makeTarget();
    const unsub = b.attach(target);
    unsub();

    b.manager.setReducedMotion(true);
    expect(target.calls).toEqual([1]);
  });

  test('attachCamera + attachPostfx wire independent targets', () => {
    const b = createA11yBridge({ initial: { reducedMotion: true } });
    const cam = makeTarget();
    const pfx = makeTarget();
    b.attachCamera(cam);
    b.attachPostfx(pfx);
    b.manager.setReducedMotion(false);

    expect(cam.calls).toEqual([0, 1]);
    expect(pfx.calls).toEqual([0, 1]);
  });
});
