import { type ReactNode, useEffect, useId } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useFocusManager, useFocusedId } from './focus-context.js';
import { useTheme } from './theme.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Focus-navigation tab order. Lower is earlier. Defaults to 0. */
  tabIndex?: number;
  /** Stable focus id. If omitted, a generated id is used. */
  focusId?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  tabIndex = 0,
  focusId,
  style,
}: ButtonProps): ReactNode {
  const theme = useTheme();
  const manager = useFocusManager();
  const focusedId = useFocusedId();
  const generated = useId();
  const id = focusId ?? generated;

  useEffect(() => {
    if (!manager) return;
    return manager.register({
      id,
      tabIndex,
      disabled,
      onActivate: () => {
        if (!disabled) onPress?.();
      },
    });
  }, [manager, id, tabIndex, disabled, onPress]);

  const focused = focusedId === id;

  let bg = theme.colors.surface;
  let fg = theme.colors.text;
  let border = theme.colors.border;
  switch (variant) {
    case 'primary':
      bg = theme.colors.accent;
      fg = theme.colors.accentText;
      border = theme.colors.accent;
      break;
    case 'secondary':
      bg = theme.colors.surfaceAlt;
      fg = theme.colors.text;
      border = theme.colors.border;
      break;
    case 'ghost':
      bg = 'transparent';
      fg = theme.colors.text;
      border = 'transparent';
      break;
    case 'danger':
      bg = theme.colors.danger;
      fg = theme.colors.accentText;
      border = theme.colors.danger;
      break;
  }

  const container: ViewStyle = {
    backgroundColor: bg,
    borderColor: focused ? theme.colors.focus : border,
    borderWidth: focused ? 2 : 1,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        manager?.focus(id);
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: focused }}
      style={[styles.wrap, container, style]}
    >
      <View>
        <Text style={{ color: fg, fontSize: theme.typography.sizeMd, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
