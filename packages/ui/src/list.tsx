import { Fragment, type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { useTheme } from './theme.js';

export interface ListProps {
  children?: ReactNode;
  /** Gap between items in pixels. Defaults to theme.spacing.sm. */
  gap?: number;
  direction?: 'column' | 'row';
  style?: StyleProp<ViewStyle>;
}

/**
 * Vertical (or horizontal) stack with consistent gap. Thin container; the
 * focus manager handles navigation between interactive children.
 */
export function List({ children, gap, direction = 'column', style }: ListProps): ReactNode {
  const theme = useTheme();
  const g = gap ?? theme.spacing.sm;

  const items: ReactNode[] = [];
  let i = 0;
  const flat = Array.isArray(children) ? children : [children];
  for (const child of flat) {
    if (child === null || child === undefined || child === false) continue;
    if (i > 0) {
      const spacerStyle: ViewStyle = direction === 'row' ? { width: g } : { height: g };
      items.push(<View key={`s-${i}`} style={spacerStyle} />);
    }
    items.push(<Fragment key={`i-${i}`}>{child}</Fragment>);
    i++;
  }

  return <View style={[{ flexDirection: direction }, style]}>{items}</View>;
}
