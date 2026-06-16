import { describe, expect, test } from 'bun:test';
import { NoopHapticsProvider } from '../src/provider.js';

describe('NoopHapticsProvider', () => {
  test('impact resolves silently', async () => {
    expect(await NoopHapticsProvider.impact()).toBeUndefined();
  });

  test('impact accepts a style argument', async () => {
    await NoopHapticsProvider.impact('heavy');
  });

  test('notification resolves silently', async () => {
    expect(await NoopHapticsProvider.notification('success')).toBeUndefined();
  });

  test('selection resolves silently', async () => {
    expect(await NoopHapticsProvider.selection()).toBeUndefined();
  });

  test('reports disabled with no backend, and setEnabled stays inert', () => {
    expect(NoopHapticsProvider.isEnabled()).toBe(false);
    NoopHapticsProvider.setEnabled(true);
    expect(NoopHapticsProvider.isEnabled()).toBe(false);
  });
});
