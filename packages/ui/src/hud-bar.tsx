import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Label } from './label.js';
import { ProgressBar } from './progress-bar.js';
import { useTheme } from './theme.js';

export type HUDBarKind = 'hp' | 'mp' | 'xp' | 'custom';

export interface HUDBarProps {
  label: string;
  value: number;
  max: number;
  kind?: HUDBarKind;
  /** When true, shows "value / max" next to the label. */
  showNumbers?: boolean;
  /** Override bar fill color. */
  fillColor?: string;
}

export function HUDBar({
  label,
  value,
  max,
  kind = 'custom',
  showNumbers = true,
  fillColor,
}: HUDBarProps): ReactNode {
  const theme = useTheme();
  const ratio = max <= 0 ? 0 : value / max;

  let color = fillColor;
  if (!color) {
    switch (kind) {
      case 'hp':
        color = theme.colors.danger;
        break;
      case 'mp':
        color = theme.colors.accent;
        break;
      case 'xp':
        color = theme.colors.success;
        break;
      default:
        color = theme.colors.accent;
    }
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.xs,
        }}
      >
        <Label variant="sm" tone="muted">
          {label}
        </Label>
        {showNumbers && (
          <Label variant="sm" tone="muted" mono>
            {`${Math.max(0, Math.floor(value))} / ${Math.max(0, Math.floor(max))}`}
          </Label>
        )}
      </View>
      <ProgressBar value={ratio} fillColor={color} />
    </View>
  );
}
