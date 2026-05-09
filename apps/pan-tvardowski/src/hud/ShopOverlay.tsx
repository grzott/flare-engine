import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { Button, FocusProvider, Label, Panel, ThemeProvider, darkTheme } from '@flare-engine/ui';
import { ShopPanel } from '@flare-engine/ui-shop';
import type { ShopItemCopy, ShopPanelStrings } from '@flare-engine/ui-shop';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PT_CATALOG, SKU_FULL_GAME, SKU_SUPPORTER_PACK } from '../iap/catalog';
import { type GameState, gameState, stateChanged } from '../state';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { rawStyles } from './ShopOverlay.styles';

const styles = StyleSheet.create(rawStyles);

const placeholderStyles = StyleSheet.create({
  notice: {
    color: colors.ui.tint60,
    ...typography.smallcap,
    textAlign: 'center' as const,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.ui.primary,
    ...typography.label,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    color: colors.ui.neutralLight,
    ...typography.bodyM,
    marginBottom: spacing.sm,
  },
});

export interface ShopOverlayActions {
  goMenu(): void;
  goSaveSelect(): void;
}

export interface ShopOverlayProps {
  localization: LocalizationManager;
  entitlementStore: EntitlementStore;
  actions: ShopOverlayActions;
  isNoopProvider?: boolean;
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

interface PlaceholderCardProps {
  title: string;
  description: string;
  price: string;
}

function PlaceholderCard({ title, description, price }: PlaceholderCardProps): React.ReactElement {
  return (
    <View style={styles.productCard}>
      <Label variant="sm" tone="accent" style={placeholderStyles.cardTitle}>
        {title}
      </Label>
      <Label variant="xs" tone="muted" style={placeholderStyles.cardDesc}>
        {description}
      </Label>
      <Label variant="xs" tone="muted" style={styles.productCardPrice}>
        {price}
      </Label>
    </View>
  );
}

interface PlaceholderShopCardsProps {
  t: (key: string) => string;
}

function PlaceholderShopCards({ t }: PlaceholderShopCardsProps): React.ReactElement {
  return (
    <View>
      <Label variant="xs" tone="muted" style={placeholderStyles.notice}>
        {t('shop.noop_notice')}
      </Label>
      <PlaceholderCard
        title={t('shop.full_game.title')}
        description={t('shop.full_game.description')}
        price={t('shop.full_game.placeholder_price')}
      />
      <PlaceholderCard
        title={t('shop.supporter_pack.title')}
        description={t('shop.supporter_pack.description')}
        price={t('shop.supporter_pack.placeholder_price')}
      />
    </View>
  );
}

export function ShopOverlay({
  localization,
  entitlementStore,
  actions,
  isNoopProvider = false,
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
            {isNoopProvider ? (
              <Panel padding="lg" radius="lg" style={styles.panel}>
                <Label variant="xl" tone="accent" style={{ marginBottom: spacing.lg }}>
                  {t('shop.heading')}
                </Label>
                <PlaceholderShopCards t={t} />
              </Panel>
            ) : (
              <ShopPanel
                catalog={PT_CATALOG}
                entitlementStore={entitlementStore}
                copy={SHOP_COPY}
                strings={SHOP_STRINGS}
                localize={t}
              />
            )}
            <View style={styles.backRow}>
              <Button label={t('shop.back')} variant="ghost" onPress={actions.goMenu} />
            </View>
          </View>
        </FocusProvider>
      </ThemeProvider>
    </View>
  );
}
