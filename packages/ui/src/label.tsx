import type { ReactNode } from 'react';
import { type StyleProp, Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from './theme.js';

export type LabelVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LabelTone = 'default' | 'muted' | 'accent' | 'danger' | 'success' | 'warning';

export interface LabelProps {
  children?: ReactNode;
  variant?: LabelVariant;
  tone?: LabelTone;
  mono?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: TextProps['ellipsizeMode'];
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}

export function Label({
  children,
  variant = 'md',
  tone = 'default',
  mono = false,
  style,
  numberOfLines,
  ellipsizeMode,
  adjustsFontSizeToFit,
  minimumFontScale,
}: LabelProps): ReactNode {
  const theme = useTheme();
  const sizeMap = {
    xs: theme.typography.sizeXs,
    sm: theme.typography.sizeSm,
    md: theme.typography.sizeMd,
    lg: theme.typography.sizeLg,
    xl: theme.typography.sizeXl,
  };
  const toneMap = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
    success: theme.colors.success,
    warning: theme.colors.warning,
  };

  const base: TextStyle = {
    color: toneMap[tone],
    fontSize: sizeMap[variant],
    fontFamily: mono ? theme.typography.fontFamilyMono : theme.typography.fontFamily,
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      style={[base, style]}
    >
      {children}
    </Text>
  );
}
