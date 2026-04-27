import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, ThemeProvider, darkTheme } from '@flare-engine/ui';
import { ShopPanel } from '@flare-engine/ui-shop';
import type { ShopItemCopy, ShopPanelStrings } from '@flare-engine/ui-shop';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PT_CATALOG, SKU_FULL_GAME, SKU_SUPPORTER_PACK } from '../iap/catalog';
import { type GameState, gameState, stateChanged } from '../state';

export interface ShopOverlayActions {
  goMenu(): void;
  goSaveSelect(): void;
}

export interface ShopOverlayProps {
  localization: LocalizationManager;
  entitlementStore: EntitlementStore;
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

const SHOP_COPY: Record<string, ShopItemCopy> = {
  [SKU_FULL_GAME]: {
    titleKey: 'shop.full_game.title',
    descriptionKey: 'shop.full_game.description',
    ctaKey: 'shop.full_game.cta',
    ownedLabelKey: 'shop.full_game.owned',
  },
  [SKU_SUPPORTER_PACK]: {
    titleKey: 'shop.supporter_pack.title',
    descriptionKey: 'shop.supporter_pack.description',
    ctaKey: 'shop.supporter_pack.cta',
    ownedLabelKey: 'shop.supporter_pack.owned',
  },
};

const SHOP_STRINGS: ShopPanelStrings = {
  headingKey: 'shop.heading',
  emptyKey: 'shop.empty',
  loadingKey: 'shop.loading',
  errorKey: 'shop.error',
  ownedSectionKey: 'shop.owned_section',
  availableSectionKey: 'shop.available_section',
};

export function ShopOverlay({
  localization,
  entitlementStore,
  actions,
}: ShopOverlayProps): React.ReactElement | null {
  const [s, setS] = useState<GameState>(() => cloneState());

  useEffect(() => {
    const off = stateChanged.add(() => setS(cloneState()));
    return () => off();
  }, []);

  const t = useMemo(() => (key: string) => localization.t(key), [localization]);

  if (s.currentScene !== 'shop') return null;

  return (
    <View style={styles.root}>
      <ThemeProvider theme={darkTheme}>
        <FocusProvider>
          <View style={styles.content}>
            <ShopPanel
              catalog={PT_CATALOG}
              entitlementStore={entitlementStore}
              copy={SHOP_COPY}
              strings={SHOP_STRINGS}
              localize={t}
            />
            <View style={styles.backRow}>
              <Button label={t('shop.back')} variant="ghost" onPress={actions.goMenu} />
            </View>
          </View>
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 16, 0.92)',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backRow: { marginTop: 8 },
});
