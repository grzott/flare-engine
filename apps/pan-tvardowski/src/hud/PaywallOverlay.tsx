import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { PaywallModal } from '@flare-engine/ui-shop';
import type { PaywallStrings } from '@flare-engine/ui-shop';
import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ENTITLEMENT_FULL_GAME, SKU_FULL_GAME } from '../iap/catalog';
import { rawStyles } from './PaywallOverlay.styles';

const styles = StyleSheet.create(rawStyles);

const PAYWALL_STRINGS: PaywallStrings = {
  headingKey: 'paywall.heading',
  bodyKey: 'paywall.body',
  ctaKey: 'paywall.cta',
  dismissKey: 'paywall.dismiss',
  loadingKey: 'paywall.loading',
  errorKey: 'paywall.error',
};

export interface PaywallOverlayProps {
  localization: LocalizationManager;
  entitlementStore: EntitlementStore;
  visible: boolean;
  onDismiss: () => void;
}

export function PaywallOverlay({
  localization,
  entitlementStore,
  visible,
  onDismiss,
}: PaywallOverlayProps): React.ReactNode {
  const t = useMemo(() => (key: string) => localization.t(key), [localization]);

  if (!visible) return null;

  return (
    <View style={styles.wrapper}>
      <PaywallModal
        visible={visible}
        productId={SKU_FULL_GAME}
        entitlementKey={ENTITLEMENT_FULL_GAME}
        entitlementStore={entitlementStore}
        strings={PAYWALL_STRINGS}
        localize={t}
        onDismiss={onDismiss}
      />
    </View>
  );
}
