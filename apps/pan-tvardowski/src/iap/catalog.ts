import { type ProductCatalog, createProductCatalog } from '@flare-engine/iap';

/**
 * Pan Tvardowski IAP product catalog.
 *
 * Store product IDs use the `pan_tvardowski.<sku>` namespace (App Store /
 * Play Store identifiers — used verbatim by the storefront).
 *
 * - `pan_tvardowski.full_game`      — unlocks zones 4–8 (the paid campaign)
 * - `pan_tvardowski.supporter_pack` — cosmetic supporter badge (no gameplay
 *   impact this milestone; reserved for credits-screen badge / future cosmetics)
 *
 * NOTE: `pt.shards_small` (consumable, 500 bonus shards) was removed in M9.3.
 * Any saved entitlement values containing that key are benign — the
 * EntitlementStore ignores unknown keys on hydration.
 */

export const SKU_FULL_GAME = 'pan_tvardowski.full_game' as const;
export const SKU_SUPPORTER_PACK = 'pan_tvardowski.supporter_pack' as const;

export const ENTITLEMENT_FULL_GAME = 'pt.full_game' as const;
export const ENTITLEMENT_SUPPORTER = 'pt.supporter' as const;

/** @deprecated Use {@link ENTITLEMENT_FULL_GAME} directly. Kept for legacy save compatibility. */
export const PT_ENTITLEMENT = {
  FULL_GAME: ENTITLEMENT_FULL_GAME,
} satisfies Record<string, string>;

export const PT_CATALOG: ProductCatalog = createProductCatalog([
  {
    productId: SKU_FULL_GAME,
    grants: [ENTITLEMENT_FULL_GAME],
    type: 'non-consumable',
    label: 'shop.full_game.title',
  },
  {
    productId: SKU_SUPPORTER_PACK,
    grants: [ENTITLEMENT_SUPPORTER],
    type: 'non-consumable',
    label: 'shop.supporter_pack.title',
  },
]);
