# @flare-engine/iap

In-app purchase interface + product catalog + entitlement store + content gates. Adapter-agnostic — wire a concrete `IAPProvider` (e.g. [`@flare-engine/iap-revenuecat`](../iap-revenuecat)) at the app boundary. `ProductCatalog` binds product ids to entitlement keys; `EntitlementStore` reactively tracks granted entitlements; `canAccessContent(spec, store)` is a pure boolean gate for paywalled zones / DLC.

## Install

```sh
bun add @flare-engine/iap
```

Peer dep: `react` (for the context).

## Usage

```tsx
import {
  IAPContext,
  NoopIAPProvider,
  createProductCatalog,
  createEntitlementStore,
  canAccessContent,
} from '@flare-engine/iap';

const catalog = createProductCatalog([
  { productId: 'game.full', grants: ['full_game'], type: 'non-consumable' },
]);
const store = createEntitlementStore(catalog);

function App() {
  return (
    <IAPContext.Provider value={NoopIAPProvider}>
      {/* …app… */}
    </IAPContext.Provider>
  );
}

function isZone4Unlocked(): boolean {
  return canAccessContent({ requiresEntitlement: 'full_game' }, store);
}
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineiap--1kb-raw-interface-only).

## License

Apache-2.0
