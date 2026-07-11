import { describe, expect, test } from 'bun:test';
import { createWebVibrationProvider, type WebVibrate } from '../src/web.js';

function fakeVibrate(): { vibrate: WebVibrate; patterns: (number | number[])[] } {
  const patterns: (number | number[])[] = [];
  const vibrate: WebVibrate = (pattern) => {
    patterns.push(pattern);
    return true;
  };
  return { vibrate, patterns };
}

describe('createWebVibrationProvider', () => {
  test('starts enabled when vibrate is present', () => {
    const { vibrate } = fakeVibrate();
    expect(createWebVibrationProvider(vibrate).isEnabled()).toBe(true);
  });

  test('impact scales buzz duration with intensity', async () => {
    const { vibrate, patterns } = fakeVibrate();
    const h = createWebVibrationProvider(vibrate);
    await h.impact('light');
    await h.impact('soft');
    await h.impact('medium');
    await h.impact('rigid');
    await h.impact('heavy');
    // light < soft < medium < rigid < heavy — strictly increasing intensity
    expect(patterns).toEqual([10, 15, 20, 30, 40]);
  });

  test('impact / notification fall back to a default kind when omitted', async () => {
    const { vibrate, patterns } = fakeVibrate();
    const h = createWebVibrationProvider(vibrate);
    await h.impact();
    await h.notification();
    // medium impact, success notification
    expect(patterns).toEqual([20, [10, 40, 20]]);
  });

  test('notification uses a distinct pattern per category', async () => {
    const { vibrate, patterns } = fakeVibrate();
    const h = createWebVibrationProvider(vibrate);
    await h.notification('success');
    await h.notification('warning');
    await h.notification('error');
    expect(patterns).toEqual([
      [10, 40, 20],
      [20, 60, 20],
      [30, 40, 30, 40, 30],
    ]);
  });

  test('selection is a single short tick', async () => {
    const { vibrate, patterns } = fakeVibrate();
    const h = createWebVibrationProvider(vibrate);
    await h.selection();
    expect(patterns).toEqual([5]);
  });

  test('when disabled, nothing vibrates; re-enabling restores it', async () => {
    const { vibrate, patterns } = fakeVibrate();
    const h = createWebVibrationProvider(vibrate);
    h.setEnabled(false);
    await h.impact('heavy');
    await h.notification('error');
    await h.selection();
    expect(patterns).toEqual([]);
    h.setEnabled(true);
    await h.selection();
    expect(patterns).toEqual([5]);
  });

  test('gates on vibrate presence: absent → permanently disabled no-op that never throws', async () => {
    const h = createWebVibrationProvider(undefined);
    expect(h.isEnabled()).toBe(false);
    // cues must resolve silently and never touch a missing API
    expect(await h.impact('heavy')).toBeUndefined();
    expect(await h.notification()).toBeUndefined();
    expect(await h.selection()).toBeUndefined();
    // no backend → the provider never claims to be enabled, even after setEnabled(true)
    h.setEnabled(true);
    expect(h.isEnabled()).toBe(false);
  });
});
