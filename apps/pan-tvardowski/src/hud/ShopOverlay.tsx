import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import { Button, Label, Panel } from '@flare-engine/ui';
import { ShopPanel } from '@flare-engine/ui-shop';
import type { ShopItemCopy, ShopPanelStrings } from '@flare-engine/ui-shop';
import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { PT_CATALOG, SKU_FULL_GAME, SKU_SUPPORTER_PACK } from '../iap/catalog';
import { THEME_SPEC, TYPOGRAPHY, UI_COLORS } from '../visual-spec/theme';
import { HudPanelScaffold } from './HudPanelScaffold';
import { rawStyles } from './ShopOverlay.styles';
import { cloneGameState, useHudState } from './useHudState';

const styles = StyleSheet.create(rawStyles);

const placeholderStyles = StyleSheet.create({
  notice: {
    color: UI_COLORS.tint60,
    ...TYPOGRAPHY.smallcap,
    textAlign: 'center' as const,
    marginBottom: THEME_SPEC.spacing.lg,
  },
  cardTitle: {
    color: UI_COLORS.primary,
    ...TYPOGRAPHY.label,
    marginBottom: THEME_SPEC.spacing.xs,
  },
  cardDesc: {
    color: UI_COLORS.neutralLight,
    ...TYPOGRAPHY.bodyM,
    marginBottom: THEME_SPEC.spacing.sm,
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
  const s = useHudState(cloneGameState);

  const t = useMemo(() => (key: string) => localization.t(key), [localization]);

  if (s.currentScene !== 'shop') return null;

  return (
    <View style={styles.root}>
      <HudPanelScaffold>
        <View style={styles.content}>
          {isNoopProvider ? (
            <Panel padding="lg" radius="lg" style={styles.panel}>
              <Label variant="xl" tone="accent" style={{ marginBottom: THEME_SPEC.spacing.lg }}>
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
      </HudPanelScaffold>
    </View>
  );
}
