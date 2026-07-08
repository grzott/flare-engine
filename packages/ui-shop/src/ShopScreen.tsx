import type {
  EntitlementStore,
  Product,
  ProductCatalog,
  ProductId,
  PurchaseResult,
} from '@flare-engine/iap';
import { useIAP } from '@flare-engine/iap';
import { Button, Label, Panel } from '@flare-engine/ui';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { LocalizeFn, ShopItemCopy, ShopPanelStrings } from './types.js';

export interface ShopScreenProps {
  /**
   * Product catalog. Its identity (and the ambient IAP provider's) keys the
   * product fetch: a change refetches and resets to the loading state — that is
   * how a Noop→concrete provider swap picks up real products. Pass a stable
   * reference (a memoized/singleton catalog), not a value rebuilt every render,
   * or the fetch will re-run on each parent render.
   */
  readonly catalog: ProductCatalog;
  readonly entitlementStore: EntitlementStore;
  readonly copy: Record<ProductId, ShopItemCopy>;
  readonly strings: ShopPanelStrings;
  readonly localize: LocalizeFn;
  readonly onPurchase?: (productId: ProductId, result: PurchaseResult) => void;
  readonly onError?: (error: Error) => void;
}

export function ShopScreen({
  catalog,
  entitlementStore,
  copy,
  strings,
  localize,
  onPurchase,
  onError,
}: ShopScreenProps): React.ReactNode {
  const provider = useIAP();
  const [products, setProducts] = useState<readonly Product[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [inFlight, setInFlight] = useState<ProductId | null>(null);
  // Bumped on every EntitlementStore change to trigger re-render.
  const [entitlementTick, setEntitlementTick] = useState(0);
  // Latest-ref for onError so a fresh inline callback identity cannot re-trigger
  // the fetch effect (which is keyed to catalog/provider identity only).
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Refetch whenever the catalog or the IAP provider identity changes (e.g. a
  // Noop→concrete provider swap), resetting to the loading state; a cancelled
  // flag drops a stale in-flight response from the previous provider.
  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    setLoadError(null);
    const ids = catalog.entries.map((e) => e.productId);
    provider
      .getProducts(ids)
      .then((p) => {
        if (!cancelled) setProducts(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setLoadError(e);
        onErrorRef.current?.(e);
      });
    return () => {
      cancelled = true;
    };
  }, [catalog, provider]);

  useEffect(() => {
    return entitlementStore.onChange.add(() => {
      setEntitlementTick((n) => n + 1);
    });
  }, [entitlementStore]);

  // entitlementTick read in render to keep the lint rule happy.
  void entitlementTick;

  async function handlePurchase(id: ProductId): Promise<void> {
    setInFlight(id);
    try {
      const result = await provider.purchase(id);
      if (result.status === 'purchased') {
        entitlementStore.grantProduct(id);
      }
      onPurchase?.(id, result);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      onError?.(e);
    } finally {
      setInFlight(null);
    }
  }

  if (loadError !== null) {
    return (
      <Panel>
        <Label tone="danger">{localize(strings.errorKey)}</Label>
      </Panel>
    );
  }

  if (products === null) {
    return (
      <Panel>
        <Label tone="muted">{localize(strings.loadingKey)}</Label>
      </Panel>
    );
  }

  if (products.length === 0) {
    return (
      <Panel>
        <Label tone="muted">{localize(strings.emptyKey)}</Label>
      </Panel>
    );
  }

  const owned: readonly Product[] = products.filter((p) => {
    const entry = catalog.entries.find((e) => e.productId === p.id);
    return entry?.grants.some((k) => entitlementStore.isEntitled(k)) ?? false;
  });
  const available: readonly Product[] = products.filter((p) => !owned.includes(p));

  return (
    <Panel variant="elevated" padding="md">
      <Label variant="lg">{localize(strings.headingKey)}</Label>
      {owned.length > 0 ? (
        <View>
          <Label variant="sm" tone="muted">
            {localize(strings.ownedSectionKey)}
          </Label>
          {owned.map((p) => {
            const itemCopy = copy[p.id];
            return (
              <View key={p.id}>
                <Label variant="md">{itemCopy ? localize(itemCopy.titleKey) : p.title}</Label>
                {itemCopy ? (
                  <Label variant="sm" tone="muted">
                    {localize(itemCopy.descriptionKey)}
                  </Label>
                ) : null}
                <Button
                  label={
                    itemCopy ? localize(itemCopy.ownedLabelKey) : localize(strings.ownedSectionKey)
                  }
                  variant="ghost"
                  disabled
                />
              </View>
            );
          })}
        </View>
      ) : null}
      {available.length > 0 ? (
        <View>
          <Label variant="sm" tone="muted">
            {localize(strings.availableSectionKey)}
          </Label>
          {available.map((p) => {
            const itemCopy = copy[p.id];
            const purchasing = inFlight === p.id;
            return (
              <View key={p.id}>
                <Label variant="md">{itemCopy ? localize(itemCopy.titleKey) : p.title}</Label>
                {itemCopy ? (
                  <Label variant="sm" tone="muted">
                    {localize(itemCopy.descriptionKey)}
                  </Label>
                ) : null}
                <Button
                  label={
                    purchasing
                      ? localize(strings.loadingKey)
                      : itemCopy
                        ? localize(itemCopy.ctaKey)
                        : p.priceDisplay
                  }
                  variant="primary"
                  disabled={purchasing}
                  onPress={() => {
                    void handlePurchase(p.id);
                  }}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </Panel>
  );
}
