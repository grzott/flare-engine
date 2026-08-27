import {
  createButtonState,
  pressButton,
  releaseButton,
  resetButtonFrame,
  type VirtualButtonState,
} from '@flare-engine/input';
import type React from 'react';
import { useCallback, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

/** Props for the <VirtualButton> component. */
export interface VirtualButtonProps {
  /** Called on each state change. */
  onStateChange?: (state: VirtualButtonState) => void;
  /** Style applied to the button. */
  style?: ViewStyle;
  /** Button label / overlay content. */
  children?: React.ReactNode;
}

/**
 * VirtualButton — an on-screen button overlay component.
 *
 * Uses raw `onTouchStart`/`onTouchEnd` so press and release fire regardless
 * of which ancestor holds the RN responder — enabling simultaneous use with
 * `<VirtualJoystick>` without responder conflicts.
 */
export function VirtualButton({
  onStateChange,
  style,
  children,
}: VirtualButtonProps): React.ReactElement {
  const stateRef = useRef<VirtualButtonState>(createButtonState());

  const handlePress = useCallback(() => {
    resetButtonFrame(stateRef.current);
    pressButton(stateRef.current);
    onStateChange?.(stateRef.current);
  }, [onStateChange]);

  const handleRelease = useCallback(() => {
    resetButtonFrame(stateRef.current);
    releaseButton(stateRef.current);
    onStateChange?.(stateRef.current);
  }, [onStateChange]);

  return (
    <View
      style={[styles.button, style]}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      onTouchCancel={handleRelease}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
