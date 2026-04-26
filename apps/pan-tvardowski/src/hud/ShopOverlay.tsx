import type { EntitlementStore, IAPProvider } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import {
  Button,
  FocusProvider,
  Label,
  Panel,
  ShopPanel,
  ThemeProvider,
  darkTheme,
} from '@flare-engine/ui';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SaveStore } from '../save/store';
import { type GameState, gameState, stateChanged } from '../state';

export interface ShopOverlayActions {
  goMenu(): void;
  goSaveSelect(): void;
}

export interface ShopOverlayProps {
  localization: LocalizationManager;
  save: SaveStore;
  entitlementStore: EntitlementStore;
  iapProvider: IAPProvider;
  actions: ShopOverlayActions;
}

function cloneState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}

export function ShopOverlay(props: ShopOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  if (s.currentScene !== 'shop') return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          <ShopView {...props} />
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

function ShopView({
  localization: l,
  entitlementStore,
  iapProvider,
  actions,
  save,
}: ShopOverlayProps): React.ReactElement {
  const t = useMemo(() => (k: string, p?: Record<string, string | number>) => l.t(k, p), [l]);

  const items = useMemo(
    () => [
      {
        productId: 'pt.full_game',
        title: t('shop.full_game.title'),
        priceDisplay: t('shop.full_game.price'),
        description: t('shop.full_game.desc'),
        ownedKeys: ['pt.full_game'],
      },
      {
        productId: 'pt.shards_small',
        title: t('shop.shards_small.title'),
        priceDisplay: t('shop.shards_small.price'),
        description: t('shop.shards_small.desc'),
      },
    ],
    [t],
  );

  const handlePurchase = (productId: string): void => {
    void (async () => {
      const result = await iapProvider.purchase(productId);
      if (result.status === 'purchased') {
        entitlementStore.grantProduct(productId);
        const keys = entitlementStore.snapshot();
        for (const key of keys) {
          await save.grantEntitlement(key);
        }
        if (productId === 'pt.full_game') {
          actions.goSaveSelect();
        }
      }
    })();
  };

  return (
    <View style={styles.panelContainer}>
      <Panel padding="lg" radius="lg" style={styles.panel}>
        <Label variant="xl" tone="accent" style={styles.title}>
          {t('shop.title')}
        </Label>
        <Label variant="sm" tone="muted" style={styles.subtitle}>
          {t('shop.subtitle')}
        </Label>

        <ShopPanel
          items={items}
          isEntitled={(key) => entitlementStore.isEntitled(key)}
          onPurchase={handlePurchase}
          ownedLabel={t('shop.owned')}
          style={styles.shopPanel}
        />

        <View style={styles.restoreRow}>
          <Button
            label={t('shop.restore')}
            variant="ghost"
            onPress={() => {
              void entitlementStore.restoreOnBoot(iapProvider).then(async () => {
                const keys = entitlementStore.snapshot();
                for (const key of keys) {
                  await save.grantEntitlement(key);
                }
              });
            }}
          />
        </View>

        <View style={styles.backRow}>
          <Button label={t('shop.back')} variant="ghost" onPress={actions.goMenu} />
        </View>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 16, 0.92)',
    justifyContent: 'center',
  },
  panelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: { alignSelf: 'stretch', maxWidth: 420, width: '100%' },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 16 },
  shopPanel: { marginBottom: 4 },
  restoreRow: { marginTop: 12 },
  backRow: { marginTop: 4 },
});
