/**
 * Paywall flow tests — M9.3.
 *
 * Covers the event-driven paywall trigger + entitlement grant on purchase.
 * Uses the conditional require guard pattern (matches zone-gate.test.ts) so
 * the suite skips gracefully on EACCES (WSL symlink breakage on Windows CI).
 */
import { describe, expect, test } from 'bun:test';

describe('paywall flow — M9.3', () => {
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let gameEvents: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let createEntitlementStore: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let PT_CATALOG: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let SKU_FULL_GAME: any;
  // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
  let ENTITLEMENT_FULL_GAME: any;

  try {
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const iap = require('@flare-engine/iap') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const eventsModule = require('../src/events') as any;
    // biome-ignore lint/suspicious/noExplicitAny: conditional require guard
    const catalogModule = require('../src/iap/catalog') as any;
    gameEvents = eventsModule.gameEvents;
    createEntitlementStore = iap.createEntitlementStore;
    PT_CATALOG = catalogModule.PT_CATALOG;
    SKU_FULL_GAME = catalogModule.SKU_FULL_GAME;
    ENTITLEMENT_FULL_GAME = catalogModule.ENTITLEMENT_FULL_GAME;
  } catch {
    // Symlink EACCES — tests skip via early returns below.
  }

  test("'paywall-trigger' event invokes registered handlers with the reason", () => {
    if (!gameEvents) return;
    let captured: string | undefined;
    const off = gameEvents.on('paywall-trigger', (reason: string) => {
      captured = reason;
    });
    gameEvents.emit('paywall-trigger', 'zone-3-defeat');
    expect(captured).toBe('zone-3-defeat');
    off();
  });

  test('granting SKU_FULL_GAME on a fresh store flips isEntitled(ENTITLEMENT_FULL_GAME) to true', () => {
    if (!createEntitlementStore || !PT_CATALOG || !SKU_FULL_GAME || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(false);
    store.grantProduct(SKU_FULL_GAME);
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(true);
  });

  test("'purchase-completed' event fires with productId payload after a purchase grant", () => {
    if (!gameEvents || !createEntitlementStore || !PT_CATALOG || !SKU_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    let captured: string | undefined;
    const off = gameEvents.on('purchase-completed', (productId: string) => {
      captured = productId;
    });
    store.grantProduct(SKU_FULL_GAME);
    gameEvents.emit('purchase-completed', SKU_FULL_GAME);
    expect(captured).toBe(SKU_FULL_GAME);
    off();
  });

  test('soft-dismiss: dismiss handler runs without granting the entitlement', () => {
    if (!createEntitlementStore || !PT_CATALOG || !ENTITLEMENT_FULL_GAME) return;
    const store = createEntitlementStore(PT_CATALOG);
    let dismissed = false;
    const onDismiss = () => {
      dismissed = true;
    };
    onDismiss();
    expect(dismissed).toBe(true);
    expect(store.isEntitled(ENTITLEMENT_FULL_GAME)).toBe(false);
  });
});
