import { describe, expect, test } from 'bun:test';
import { NoopAnalyticsProvider } from '../src/provider.js';

describe('NoopAnalyticsProvider', () => {
  test('track resolves silently', async () => {
    expect(await NoopAnalyticsProvider.track('level_start')).toBeUndefined();
  });

  test('track accepts props payload', async () => {
    await NoopAnalyticsProvider.track('level_start', { level: 1, seed: 42 });
  });

  test('identify resolves silently', async () => {
    await NoopAnalyticsProvider.identify('user-1', { plan: 'pro' });
  });

  test('screen resolves silently', async () => {
    await NoopAnalyticsProvider.screen('menu');
  });

  test('flush resolves silently', async () => {
    expect(await NoopAnalyticsProvider.flush()).toBeUndefined();
  });
});
