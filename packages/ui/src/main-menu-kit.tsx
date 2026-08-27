import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { Button, type ButtonVariant } from './button.js';
import { Label } from './label.js';
import { useTheme } from './theme.js';

export interface MainMenuItem {
  /** Stable id — used as focus id + React key. */
  readonly id: string;
  /** Localized label. */
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
}

export interface MainMenuKitProps {
  /** Localized title. */
  readonly title: string;
  /** Optional localized subtitle — tagline, version, locale flag, etc. */
  readonly subtitle?: string;
  /** Button list. Rendered top-to-bottom in order. */
  readonly items: readonly MainMenuItem[];
  /**
   * Optional footer slot — typically a row of ghost buttons (credits, links)
   * or a version/build string.
   */
  readonly footer?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Title-screen kit: headline, optional subtitle, vertical button list,
 * optional footer slot. All strings are caller-supplied (localized upstream).
 *
 * Save-slot / settings / credits panels are built on top of this kit by the
 * consumer; the kit itself is a pure title-menu primitive.
 */
export function MainMenuKit({
  title,
  subtitle,
  items,
  footer,
  style,
}: MainMenuKitProps): ReactNode {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      <Label variant="xl" tone="accent" style={{ marginBottom: theme.spacing.xs }}>
        {title}
      </Label>
      {subtitle !== undefined ? (
        <Label variant="sm" tone="muted" style={{ marginBottom: theme.spacing.lg }}>
          {subtitle}
        </Label>
      ) : (
        <View style={{ height: theme.spacing.lg }} />
      )}
      <View style={{ alignSelf: 'stretch', maxWidth: 320, width: '100%' }}>
        {items.map((item, i) => (
          <View key={item.id} style={{ marginTop: i === 0 ? 0 : theme.spacing.sm }}>
            <Button
              label={item.label}
              onPress={item.onPress}
              variant={item.variant ?? 'primary'}
              disabled={item.disabled}
              focusId={item.id}
              tabIndex={i}
            />
          </View>
        ))}
      </View>
      {footer !== undefined ? <View style={{ marginTop: theme.spacing.lg }}>{footer}</View> : null}
    </View>
  );
}
