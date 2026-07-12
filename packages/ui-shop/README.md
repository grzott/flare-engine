# @flare-engine/ui-shop

Reusable React Native UI primitives for in-app-purchase flows. Consumes
`@flare-engine/iap` (`IAPContext` + `EntitlementStore` + `ProductCatalog`)
and `@flare-engine/ui` (Panel / Button / Label / Modal) for rendering.

## Install

```sh
bun add @flare-engine/ui-shop @flare-engine/iap @flare-engine/ui
```

## Usage

```tsx
import { useState } from 'react';
import {
  IAPContext,
  NoopIAPProvider,
  createEntitlementStore,
  createProductCatalog,
} from '@flare-engine/iap';
import { ShopScreen, PaywallModal, RestorePurchasesButton } from '@flare-engine/ui-shop';
import type { PaywallStrings, RestoreStrings, ShopPanelStrings } from '@flare-engine/ui-shop';

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game'], type: 'non-consumable' },
]);
const store = createEntitlementStore(catalog);

const shopStrings: ShopPanelStrings = {
  headingKey: 'shop.heading', emptyKey: 'shop.empty',
  loadingKey: 'shop.loading', errorKey: 'shop.error',
  ownedSectionKey: 'shop.owned', availableSectionKey: 'shop.available',
};
const paywallStrings: PaywallStrings = {
  headingKey: 'pw.heading', bodyKey: 'pw.body', ctaKey: 'pw.cta',
  dismissKey: 'pw.dismiss', loadingKey: 'pw.loading', errorKey: 'pw.error',
};
const restoreStrings: RestoreStrings = {
  ctaKey: 'restore.cta', loadingKey: 'restore.loading',
  successKey: 'restore.success', emptyKey: 'restore.empty', errorKey: 'restore.error',
};

function t(key: string): string { return key; }

// Swap NoopIAPProvider for a concrete adapter (e.g. createRevenueCatProvider)
function ShopExample() {
  const [paywallOpen, setPaywallOpen] = useState(false);

  return (
    <IAPContext.Provider value={NoopIAPProvider}>
      <ShopScreen
        catalog={catalog}
        entitlementStore={store}
        copy={{ 'game.full': { titleKey: 'p.full.title', descriptionKey: 'p.full.desc', ctaKey: 'p.full.cta', ownedLabelKey: 'p.full.owned' } }}
        strings={shopStrings}
        localize={t}
        onPurchase={(id, result) => console.log(id, result.status)}
      />

      <PaywallModal
        visible={paywallOpen}
        productId="game.full"
        entitlementKey="full_game"
        entitlementStore={store}
        strings={paywallStrings}
        localize={t}
        onDismiss={() => setPaywallOpen(false)}
        onPurchased={(result) => console.log('purchased', result)}
      />

      <RestorePurchasesButton
        entitlementStore={store}
        strings={restoreStrings}
        localize={t}
        onComplete={(results) => console.log('restored', results.length)}
      />
    </IAPContext.Provider>
  );
}
```
