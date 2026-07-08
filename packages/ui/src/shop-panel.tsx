import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Button } from './button.js';
import { Label } from './label.js';
import { Panel } from './panel.js';
import { useTheme } from './theme.js';

export interface ShopItem {
  /** Store product id — forwarded verbatim to `onPurchase`. */
  readonly productId: string;
  /** Localized display title. */
  readonly title: string;
  /** Localized price string (from `Product.priceDisplay`). */
  readonly priceDisplay: string;
  /** Optional localized description. */
  readonly description?: string;
  /**
   * Entitlement key(s) that mark this product as already owned. When the
   * store reports any of these as entitled, the purchase button is replaced
   * with an "owned" label.
   */
  readonly ownedKeys?: readonly string[];
  readonly disabled?: boolean;
}

export interface ShopPanelProps {
  readonly items: readonly ShopItem[];
  /** Returns `true` when the given entitlement key is already owned. */
  readonly isEntitled: (key: string) => boolean;
  /** Called when a not-owned item's purchase button is pressed. */
  readonly onPurchase: (productId: string) => void;
  /** Localized label for already-owned items. Defaults to "Owned". */
  readonly ownedLabel?: string;
  /** Localized label for the purchase action. Defaults to the item's price. */
  readonly purchaseLabelFor?: (item: ShopItem) => string;
  readonly style?: ViewStyle;
}

/**
 * List-style shop panel. Caller builds the `items` array by joining a
 * `ProductCatalog` with the `Product[]` returned by `IAPProvider.getProducts`.
 *
 * Price strings and ownership copy are caller-provided so the UI kit stays
 * localization-free.
 */
export function ShopPanel({
  items,
  isEntitled,
  onPurchase,
  ownedLabel = 'Owned',
  purchaseLabelFor,
  style,
}: ShopPanelProps): ReactNode {
  const theme = useTheme();
  return (
    <Panel variant="elevated" padding="md" style={style}>
      {items.map((item, i) => {
        const owned = item.ownedKeys?.some((k) => isEntitled(k)) ?? false;
        return (
          <View
            key={item.productId}
            style={{
              marginTop: i === 0 ? 0 : theme.spacing.md,
              paddingTop: i === 0 ? 0 : theme.spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <Label variant="md">{item.title}</Label>
            {item.description !== undefined ? (
              <Label variant="sm" tone="muted" style={{ marginTop: theme.spacing.xs }}>
                {item.description}
              </Label>
            ) : null}
            <View style={{ marginTop: theme.spacing.sm }}>
              {owned ? (
                <Button label={ownedLabel} variant="ghost" disabled />
              ) : (
                <Button
                  label={purchaseLabelFor ? purchaseLabelFor(item) : item.priceDisplay}
                  variant="primary"
                  disabled={item.disabled}
                  onPress={() => onPurchase(item.productId)}
                />
              )}
            </View>
          </View>
        );
      })}
    </Panel>
  );
}
