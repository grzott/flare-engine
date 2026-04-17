import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from './theme.js';

export interface ProgressBarProps {
  /** Progress in [0, 1]. Values outside are clamped. */
  value: number;
  /** Height of the bar in pixels. */
  height?: number;
  /** Track color override. Defaults to theme.colors.surfaceAlt. */
  trackColor?: string;
  /** Fill color override. Defaults to theme.colors.accent. */
  fillColor?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  value,
  height = 8,
  trackColor,
  fillColor,
  style,
}: ProgressBarProps): ReactNode {
  const theme = useTheme();
  const clamped = Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
  const r = theme.radii.sm;

  return (
    <View
      style={[
        {
          height,
          borderRadius: r,
          backgroundColor: trackColor ?? theme.colors.surfaceAlt,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: fillColor ?? theme.colors.accent,
        }}
      />
    </View>
  );
}
