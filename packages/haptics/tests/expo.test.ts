import { describe, expect, test } from 'bun:test';
import { createExpoHapticsProvider, type ExpoHapticsModule } from '../src/expo.js';
import type { HapticsProvider } from '../src/provider.js';

interface Call {
  method: 'impact' | 'notification' | 'selection' | 'android';
  arg: string | undefined;
}

interface FakeExpoOptions {
  /** Omit `performAndroidHapticsAsync`, like a module that does not have it. */
  withoutAndroid?: boolean;
  /** Android types whose `performAndroidHapticsAsync` call rejects (recorded first). */
  rejectAndroid?: readonly string[];
}

function fakeExpo(options: FakeExpoOptions = {}): { expo: ExpoHapticsModule; calls: Call[] } {
  const calls: Call[] = [];
  const rejectAndroid = options.rejectAndroid ?? [];
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
  if (!options.withoutAndroid) {
    expo.performAndroidHapticsAsync = async (type: string): Promise<void> => {
      calls.push({ method: 'android', arg: type });
      if (rejectAndroid.includes(type)) throw new Error(`haptic type not supported: ${type}`);
    };
  }
  return { expo, calls };
}

/** Every cue and style once, in a fixed order. */
async function fireEveryCue(h: HapticsProvider): Promise<void> {
  await h.selection();
  for (const style of ['light', 'soft', 'medium', 'heavy', 'rigid'] as const) await h.impact(style);
  await h.impact();
  for (const type of ['success', 'warning', 'error'] as const) await h.notification(type);
  await h.notification();
}

/** What `fireEveryCue` records when cues forward to expo's original calls. */
const ORIGINAL_CALLS: Call[] = [
  { method: 'selection', arg: undefined },
  { method: 'impact', arg: 'light' },
  { method: 'impact', arg: 'soft' },
  { method: 'impact', arg: 'medium' },
  { method: 'impact', arg: 'heavy' },
  { method: 'impact', arg: 'rigid' },
  { method: 'impact', arg: undefined },
  { method: 'notification', arg: 'success' },
  { method: 'notification', arg: 'warning' },
  { method: 'notification', arg: 'error' },
  { method: 'notification', arg: undefined },
];

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

describe('createExpoHapticsProvider: Android system effects', () => {
  test('android: every cue and style maps to its system effect, original calls unused', async () => {
    const { expo, calls } = fakeExpo();
    await fireEveryCue(createExpoHapticsProvider(expo, { platform: 'android' }));
    expect(calls).toEqual([
      { method: 'android', arg: 'clock-tick' },
      { method: 'android', arg: 'keyboard-tap' },
      { method: 'android', arg: 'keyboard-tap' },
      { method: 'android', arg: 'virtual-key' },
      { method: 'android', arg: 'long-press' },
      { method: 'android', arg: 'long-press' },
      { method: 'android', arg: 'virtual-key' },
      { method: 'android', arg: 'confirm' },
      { method: 'android', arg: 'long-press' },
      { method: 'android', arg: 'reject' },
      { method: 'android', arg: 'confirm' },
    ]);
  });

  test('no options: original calls only, performAndroidHapticsAsync never called', async () => {
    const { expo, calls } = fakeExpo();
    await fireEveryCue(createExpoHapticsProvider(expo));
    expect(calls).toEqual(ORIGINAL_CALLS);
  });

  test('options without a platform hint: original calls only', async () => {
    const { expo, calls } = fakeExpo();
    await fireEveryCue(createExpoHapticsProvider(expo, {}));
    expect(calls).toEqual(ORIGINAL_CALLS);
  });

  test('platform ios: original calls only', async () => {
    const { expo, calls } = fakeExpo();
    await fireEveryCue(createExpoHapticsProvider(expo, { platform: 'ios' }));
    expect(calls).toEqual(ORIGINAL_CALLS);
  });

  test('platform web: original calls only', async () => {
    const { expo, calls } = fakeExpo();
    await fireEveryCue(createExpoHapticsProvider(expo, { platform: 'web' }));
    expect(calls).toEqual(ORIGINAL_CALLS);
  });

  test('android with a module lacking performAndroidHapticsAsync: original calls only', async () => {
    const { expo, calls } = fakeExpo({ withoutAndroid: true });
    await fireEveryCue(createExpoHapticsProvider(expo, { platform: 'android' }));
    expect(calls).toEqual(ORIGINAL_CALLS);
  });

  test('android, confirm rejecting: falls back to notificationAsync, then skips confirm', async () => {
    const { expo, calls } = fakeExpo({ rejectAndroid: ['confirm'] });
    const h = createExpoHapticsProvider(expo, { platform: 'android' });

    await expect(h.notification('success')).resolves.toBeUndefined();
    expect(calls).toEqual([
      { method: 'android', arg: 'confirm' },
      { method: 'notification', arg: 'success' },
    ]);

    calls.length = 0;
    await h.notification('success');
    expect(calls).toEqual([{ method: 'notification', arg: 'success' }]);

    calls.length = 0;
    await h.impact('heavy');
    await h.notification('error');
    expect(calls).toEqual([
      { method: 'android', arg: 'long-press' },
      { method: 'android', arg: 'reject' },
    ]);
  });

  test('android fallback forwards the original argument, including an omitted one', async () => {
    const { expo, calls } = fakeExpo({
      rejectAndroid: ['confirm', 'reject', 'virtual-key', 'clock-tick'],
    });
    const h = createExpoHapticsProvider(expo, { platform: 'android' });
    await h.notification();
    await h.notification('error');
    await h.impact();
    await h.selection();
    expect(calls).toEqual([
      { method: 'android', arg: 'confirm' },
      { method: 'notification', arg: undefined },
      { method: 'android', arg: 'reject' },
      { method: 'notification', arg: 'error' },
      { method: 'android', arg: 'virtual-key' },
      { method: 'impact', arg: undefined },
      { method: 'android', arg: 'clock-tick' },
      { method: 'selection', arg: undefined },
    ]);
  });

  test('android: the unsupported-type memory is per provider instance', async () => {
    const { expo, calls } = fakeExpo({ rejectAndroid: ['confirm'] });
    await createExpoHapticsProvider(expo, { platform: 'android' }).notification('success');
    calls.length = 0;
    await createExpoHapticsProvider(expo, { platform: 'android' }).notification('success');
    expect(calls).toEqual([
      { method: 'android', arg: 'confirm' },
      { method: 'notification', arg: 'success' },
    ]);
  });

  test('android, disabled: nothing is called; re-enabling restores system effects', async () => {
    const { expo, calls } = fakeExpo();
    const h = createExpoHapticsProvider(expo, { platform: 'android' });
    h.setEnabled(false);
    await fireEveryCue(h);
    expect(calls).toEqual([]);
    h.setEnabled(true);
    await h.selection();
    expect(calls).toEqual([{ method: 'android', arg: 'clock-tick' }]);
  });
});
