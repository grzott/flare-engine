import type { EntitlementStore, ProductId, PurchaseResult } from '@flare-engine/iap';
import { useIAP } from '@flare-engine/iap';
import { Button, Label, Modal } from '@flare-engine/ui';
import { useState } from 'react';
import { View } from 'react-native';
import type { LocalizeFn, PaywallStrings } from './types.js';

export interface PaywallModalProps {
  readonly visible: boolean;
  readonly productId: ProductId;
  readonly entitlementStore: EntitlementStore;
  readonly strings: PaywallStrings;
  readonly localize: LocalizeFn;
  readonly onDismiss: () => void;
  readonly onPurchased?: (result: PurchaseResult) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Parent owns visibility — the paywall never hides itself except on successful
 * purchase. This keeps routing logic in the caller and avoids double-close races.
 */
export function PaywallModal({
  visible,
  productId,
  entitlementStore,
  strings,
  localize,
  onDismiss,
  onPurchased,
  onError,
}: PaywallModalProps): React.ReactNode {
  const provider = useIAP();
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<Error | null>(null);

  if (!visible) return null;

  async function handlePurchase(): Promise<void> {
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await provider.purchase(productId);
      if (result.status === 'purchased') {
        entitlementStore.grantProduct(productId);
        onPurchased?.(result);
        onDismiss();
      } else if (result.status === 'failed') {
        const e = result.error ?? new Error('Purchase failed');
        setPurchaseError(e);
        onError?.(e);
      }
      // 'cancelled' — stay open, no error shown
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setPurchaseError(e);
      onError?.(e);
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <Modal visible={visible} onBackdropPress={purchasing ? undefined : onDismiss}>
      <Label variant="lg">{localize(strings.headingKey)}</Label>
      <Label variant="sm" tone="muted">
        {localize(strings.bodyKey)}
      </Label>
      {purchaseError !== null ? <Label tone="danger">{localize(strings.errorKey)}</Label> : null}
      <View>
        <Button
          label={purchasing ? localize(strings.loadingKey) : localize(strings.ctaKey)}
          variant="primary"
          disabled={purchasing}
          onPress={() => {
            void handlePurchase();
          }}
        />
        <Button
          label={localize(strings.dismissKey)}
          variant="ghost"
          disabled={purchasing}
          onPress={onDismiss}
        />
      </View>
    </Modal>
  );
}
