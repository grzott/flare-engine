import { type ProductCatalog, createProductCatalog } from '@flare-engine/iap';

/**
 * Pan Tvardowski IAP product catalog.
 *
 * - `pt.full_game`    — unlocks zones 4–8 (the paid half of the campaign)
 * - `pt.shards_small` — consumable: 500 bonus shards (future upgrade currency)
 *
 * Store product IDs follow `<bundle>.<sku>` convention. The catalog is
 * the single source of truth; `EntitlementStore.grantProduct` reads it.
 */

export const PT_ENTITLEMENT = {
  FULL_GAME: 'pt.full_game' as const,
} satisfies Record<string, string>;

export const PT_CATALOG: ProductCatalog = createProductCatalog([
  {
    productId: 'pt.full_game',
    grants: [PT_ENTITLEMENT.FULL_GAME],
    type: 'non-consumable',
    label: 'shop.full_game.title',
  },
  {
    productId: 'pt.shards_small',
    grants: [],
    type: 'consumable',
    label: 'shop.shards_small.title',
  },
]);
