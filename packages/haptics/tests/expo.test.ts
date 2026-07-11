import { describe, expect, test } from 'bun:test';
import { createExpoHapticsProvider, type ExpoHapticsModule } from '../src/expo.js';

interface Call {
  method: 'impact' | 'notification' | 'selection';
  arg: string | undefined;
}

function fakeExpo(): { expo: ExpoHapticsModule; calls: Call[] } {
  const calls: Call[] = [];
  const expo: ExpoHapticsModule = {
    async impactAsync(style?: string): Promise<void> {
      calls.push({ method: 'impact', arg: style });
    },
    async notificationAsync(type?: string): Promise<void> {
      calls.push({ method: 'notification', arg: type });
    },
    async selectionAsync(): Promise<void> {
      calls.push({ method: 'selection', arg: undefined });
    },
  };
  return { expo, calls };
}

describe('createExpoHapticsProvider', () => {
  test('starts enabled (there is a backend)', () => {
    const { expo } = fakeExpo();
    expect(createExpoHapticsProvider(expo).isEnabled()).toBe(true);
  });

  test('maps cue kinds onto expo calls, forwarding the kind string verbatim', async () => {
    const { expo, calls } = fakeExpo();
    const h = createExpoHapticsProvider(expo);
    await h.impact('heavy');
    await h.notification('error');
    await h.selection();
    expect(calls).toEqual([
      { method: 'impact', arg: 'heavy' },
      { method: 'notification', arg: 'error' },
      { method: 'selection', arg: undefined },
    ]);
  });

  test('forwards undefined when style / type omitted (expo applies its own default)', async () => {
    const { expo, calls } = fakeExpo();
    const h = createExpoHapticsProvider(expo);
    await h.impact();
    await h.notification();
    expect(calls).toEqual([
      { method: 'impact', arg: undefined },
      { method: 'notification', arg: undefined },
    ]);
  });

  test('every impact style forwards to expo unchanged', async () => {
    const { expo, calls } = fakeExpo();
    const h = createExpoHapticsProvider(expo);
    for (const style of ['light', 'medium', 'heavy', 'soft', 'rigid'] as const) {
      await h.impact(style);
    }
    expect(calls.map((c) => c.arg)).toEqual(['light', 'medium', 'heavy', 'soft', 'rigid']);
  });

  test('when disabled no cue reaches expo; re-enabling restores forwarding', async () => {
    const { expo, calls } = fakeExpo();
    const h = createExpoHapticsProvider(expo);
    h.setEnabled(false);
    expect(h.isEnabled()).toBe(false);
    await h.impact('light');
    await h.notification('success');
    await h.selection();
    expect(calls).toEqual([]);
    h.setEnabled(true);
    await h.impact('rigid');
    expect(calls).toEqual([{ method: 'impact', arg: 'rigid' }]);
  });

  test('awaits the backend call — a dropped await would resolve impact() early', async () => {
    const order: string[] = [];
    let release: (() => void) | undefined;
    const expo: ExpoHapticsModule = {
      impactAsync(): Promise<void> {
        return new Promise<void>((resolve) => {
          release = (): void => {
            order.push('backend');
            resolve();
          };
        });
      },
      async notificationAsync(): Promise<void> {
        // unused in this test
      },
      async selectionAsync(): Promise<void> {
        // unused in this test
      },
    };
    const h = createExpoHapticsProvider(expo);
    const pending = h.impact('medium').then(() => order.push('awaited'));
    // Flush microtasks while the backend promise is still pending: if the gate
    // dropped the await, impact() would already be resolved and 'awaited' pushed.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    release?.();
    await pending;
    expect(order).toEqual(['backend', 'awaited']);
  });

  test('two providers over the same module hold independent enabled state', () => {
    const { expo } = fakeExpo();
    const a = createExpoHapticsProvider(expo);
    const b = createExpoHapticsProvider(expo);
    a.setEnabled(false);
    expect(a.isEnabled()).toBe(false);
    expect(b.isEnabled()).toBe(true);
  });
});
