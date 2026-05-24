import { expect, test } from 'bun:test';
import easJson from '../eas.json';

test('bench profile sets EXPO_PUBLIC_BENCH_MODE to "1"', () => {
  expect(easJson.build.bench.env.EXPO_PUBLIC_BENCH_MODE).toBe('1');
});

test('bench profile omits RevenueCat API keys (IAP tree-shaken)', () => {
  const env = easJson.build.bench.env as Record<string, string>;
  expect('EXPO_PUBLIC_REVENUECAT_API_KEY_IOS' in env).toBe(false);
  expect('EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID' in env).toBe(false);
});

test('production profile has no EXPO_PUBLIC_BENCH_MODE (bench guards off in prod cold-start)', () => {
  const prod = easJson.build.production as Record<string, unknown>;
  const env = prod.env as Record<string, string> | undefined;
  expect(env?.EXPO_PUBLIC_BENCH_MODE).toBeUndefined();
});
