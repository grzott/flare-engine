import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from './theme.js';

export interface PanelProps {
  children?: ReactNode;
  /** Visual style: surface (default) or elevated (surfaceAlt + border). */
  variant?: 'surface' | 'elevated';
  /** Padding size token. Defaults to 'md'. */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Corner radius token. Defaults to 'md'. */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'pill';
  style?: ViewStyle;
}

export function Panel({
  children,
  variant = 'surface',
  padding = 'md',
  radius = 'md',
  style,
}: PanelProps): ReactNode {
  const theme = useTheme();
  const bg = variant === 'elevated' ? theme.colors.surfaceAlt : theme.colors.surface;
  const pad = padding === 'none' ? 0 : theme.spacing[padding];
  const r = theme.radii[radius];

  const base: ViewStyle = {
    backgroundColor: bg,
    padding: pad,
    borderRadius: r,
    borderWidth: variant === 'elevated' ? 1 : 0,
    borderColor: theme.colors.border,
  };

  return <View style={[base, style]}>{children}</View>;
}
