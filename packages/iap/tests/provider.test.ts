import { describe, expect, test } from 'bun:test';
import { NoopIAPProvider } from '../src/provider.js';

describe('NoopIAPProvider', () => {
  test('getProducts returns empty array regardless of ids', async () => {
    expect(await NoopIAPProvider.getProducts([])).toEqual([]);
    expect(await NoopIAPProvider.getProducts(['a', 'b'])).toEqual([]);
  });

  test('purchase resolves as cancelled', async () => {
    const r = await NoopIAPProvider.purchase('any');
    expect(r.status).toBe('cancelled');
    expect(r.transaction).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  test('restore returns empty array', async () => {
    expect(await NoopIAPProvider.restore()).toEqual([]);
  });

  test('onTransaction returns a no-op unsubscribe', () => {
    const unsub = NoopIAPProvider.onTransaction(() => {});
    expect(typeof unsub).toBe('function');
    // should not throw when called
    unsub();
    unsub();
  });

  test('onTransaction never invokes callback', async () => {
    let called = 0;
    NoopIAPProvider.onTransaction(() => {
      called++;
    });
    // Give any (non-existent) microtasks a chance
    await Promise.resolve();
    expect(called).toBe(0);
  });
});
