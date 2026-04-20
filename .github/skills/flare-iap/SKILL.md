---
name: flare-iap
description: Deep knowledge of the @flare-engine/iap package — typed in-app-purchase provider interface, purchase/restore/listProducts, NoopProvider, IAPContext, useIAP. Use when wiring an IAP provider (RevenueCat / StoreKit / Play Billing) to a Flare game. Concrete adapters ship in 0.2.0.
---

# `@flare-engine/iap`

Tier-2 stub. Interface-only at 0.1.0.

```ts
import {
  type IAPProvider,
  createNoopProvider,
  IAPContext,
  useIAP,
} from "@flare-engine/iap";
```

## Interface

```ts
interface IAPProvider {
  listProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult[]>;
}
```

Wire a real adapter by replacing `createNoopProvider()` in `IAPContext.Provider`. Adapters ship 0.2.0. See [flare-tier2-stubs](../flare-tier2-stubs/SKILL.md).
