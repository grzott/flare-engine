import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { useTheme } from './theme.js';

export type LabelVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LabelTone = 'default' | 'muted' | 'accent' | 'danger' | 'success' | 'warning';

export interface LabelProps {
  children?: ReactNode;
  variant?: LabelVariant;
  tone?: LabelTone;
  mono?: boolean;
  style?: TextStyle;
}

export function Label({
  children,
  variant = 'md',
  tone = 'default',
  mono = false,
  style,
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

  return <Text style={[base, style]}>{children}</Text>;
}
