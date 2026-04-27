import type { EntitlementStore, PurchaseResult } from '@flare-engine/iap';
import { useIAP } from '@flare-engine/iap';
import { Button, Label } from '@flare-engine/ui';
import { useState } from 'react';
import { View } from 'react-native';
import type { LocalizeFn, RestoreStrings } from './types.js';

type BannerKind = 'success' | 'empty' | 'error';

export interface RestorePurchasesButtonProps {
  readonly entitlementStore: EntitlementStore;
  readonly strings: RestoreStrings;
  readonly localize: LocalizeFn;
  readonly onComplete?: (results: readonly PurchaseResult[]) => void;
  readonly onError?: (error: Error) => void;
}

export function RestorePurchasesButton({
  entitlementStore,
  strings,
  localize,
  onComplete,
  onError,
}: RestorePurchasesButtonProps): React.ReactNode {
  const provider = useIAP();
  const [restoring, setRestoring] = useState(false);
  const [banner, setBanner] = useState<BannerKind | null>(null);
  const [bannerError, setBannerError] = useState<Error | null>(null);

  async function handleRestore(): Promise<void> {
    setRestoring(true);
    setBanner(null);
    setBannerError(null);
    try {
      const results = await provider.restore();
      let granted = 0;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r && r.status === 'purchased' && r.transaction) {
          entitlementStore.grantProduct(r.transaction.productId);
          granted++;
        }
      }
      setBanner(granted > 0 ? 'success' : 'empty');
      onComplete?.(results);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setBanner('error');
      setBannerError(e);
      onError?.(e);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <View>
      <Button
        label={restoring ? localize(strings.loadingKey) : localize(strings.ctaKey)}
        variant="secondary"
        disabled={restoring}
        onPress={() => {
          void handleRestore();
        }}
      />
      {banner === 'success' ? (
        <Label tone="success">{localize(strings.successKey)}</Label>
      ) : banner === 'empty' ? (
        <Label tone="muted">{localize(strings.emptyKey)}</Label>
      ) : banner === 'error' ? (
        <Label tone="danger">
          {localize(strings.errorKey)}
          {bannerError !== null ? `: ${bannerError.message}` : ''}
        </Label>
      ) : null}
    </View>
  );
}
