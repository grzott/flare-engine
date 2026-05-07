import { beforeEach, describe, expect, test } from 'bun:test';
import { checkFpsWatchdog, getAvgFps, recordFrameTime, resetFpsRing } from '../src/fx/budget';
import type { PostFxController } from '../src/fx/postfx';

function makeMockPostFx(): PostFxController & { _enabledCalls: [string, boolean][] } {
  const enabledCalls: [string, boolean][] = [];
  const chainProxy = {
    setEnabled(id: string, enabled: boolean): void {
      enabledCalls.push([id, enabled]);
    },
    all() {
      return [];
    },
    get() {
      return null;
    },
    add() {},
    insert() {},
    remove() {
      return false;
    },
    setUniforms() {},
    move() {},
    clear() {},
    enabled: [][Symbol.iterator].bind([]),
    globalIntensity: 1,
    setGlobalIntensity() {},
    length: 0,
  };
  return {
    _enabledCalls: enabledCalls,
    chain: chainProxy as unknown as PostFxController['chain'],
    runtime: {} as PostFxController['runtime'],
    triggerHitFlash() {},
    update() {},
    buildPass() {
      return [];
    },
    setMotionScale() {},
  };
}

describe('fps watchdog', () => {
  beforeEach(() => {
    resetFpsRing();
  });

  test('getAvgFps returns 0 before ring is full', () => {
    for (let i = 0; i < 100; i++) recordFrameTime(1 / 60);
    expect(getAvgFps()).toBe(0);
  });

  test('getAvgFps returns ~60 after 180 frames at 60 fps', () => {
    for (let i = 0; i < 180; i++) recordFrameTime(1 / 60);
    expect(getAvgFps()).toBeCloseTo(60, 0);
  });

  test('checkFpsWatchdog returns false and does not drop when fps is above threshold', () => {
    const mock = makeMockPostFx();
    for (let i = 0; i < 180; i++) recordFrameTime(1 / 60);
    const dropped = checkFpsWatchdog(mock);
    expect(dropped).toBe(false);
    expect(mock._enabledCalls.length).toBe(0);
  });

  test('first trigger disables chromatic-aberration and crt', () => {
    const mock = makeMockPostFx();
    for (let i = 0; i < 180; i++) recordFrameTime(1 / 30);
    const dropped = checkFpsWatchdog(mock);
    expect(dropped).toBe(true);
    expect(mock._enabledCalls).toContainEqual(['chromatic-aberration', false]);
    expect(mock._enabledCalls).toContainEqual(['crt', false]);
    expect(mock._enabledCalls.length).toBe(2);
  });

  test('watchdog drop is sticky — second call is no-op', () => {
    const mock = makeMockPostFx();
    for (let i = 0; i < 180; i++) recordFrameTime(1 / 30);
    checkFpsWatchdog(mock);
    const secondDrop = checkFpsWatchdog(mock);
    expect(secondDrop).toBe(false);
    // Only the two disables from the first trigger; no additional calls.
    expect(mock._enabledCalls.length).toBe(2);
  });

  test('above-threshold path leaves effects untouched', () => {
    const mock = makeMockPostFx();
    for (let i = 0; i < 180; i++) recordFrameTime(1 / 60);
    checkFpsWatchdog(mock);
    checkFpsWatchdog(mock);
    expect(mock._enabledCalls.length).toBe(0);
  });
});
