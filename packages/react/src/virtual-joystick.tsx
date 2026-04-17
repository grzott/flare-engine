import {
  type VirtualJoystickConfig,
  type VirtualJoystickState,
  createJoystickState,
  releaseJoystick,
  updateJoystick,
} from '@flare-engine/input';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';

/** Props for the <VirtualJoystick> component. */
export interface VirtualJoystickProps {
  /** Joystick configuration (dead zone, max radius). */
  config?: VirtualJoystickConfig;
  /** Called on each state change. */
  onStateChange?: (state: VirtualJoystickState) => void;
  /** Style applied to the outer container. */
  style?: ViewStyle;
}

/**
 * VirtualJoystick — an on-screen joystick overlay component.
 *
 * Renders a base circle and a knob that follows the user's touch.
 * Claims the React Native touch responder so children of a parent that
 * also claims the responder (e.g. <GameView>) still receive move/end events.
 */
export function VirtualJoystick({
  config,
  onStateChange,
  style,
}: VirtualJoystickProps): React.ReactElement {
  const stateRef = useRef<VirtualJoystickState>(createJoystickState());
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      sizeRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    },
    [],
  );

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const { w, h } = sizeRef.current;
      updateJoystick(stateRef.current, w / 2, h / 2, locationX, locationY, config);
      onStateChange?.(stateRef.current);
    },
    [config, onStateChange],
  );

  const handleRelease = useCallback(() => {
    releaseJoystick(stateRef.current);
    onStateChange?.(stateRef.current);
  }, [onStateChange]);

  const maxRadius = config?.maxRadius ?? 50;
  const knobX = stateRef.current.offset.x;
  const knobY = stateRef.current.offset.y;

  return (
    <View
      style={[
        styles.base,
        {
          width: maxRadius * 2,
          height: maxRadius * 2,
          borderRadius: maxRadius,
        },
        style,
      ]}
      onLayout={handleLayout}
      onStartShouldSetResponder={returnTrue}
      onMoveShouldSetResponder={returnTrue}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={handleRelease}
      onResponderTerminate={handleRelease}
    >
      <View style={[styles.knob, { transform: [{ translateX: knobX }, { translateY: knobY }] }]} />
    </View>
  );
}

function returnTrue(): boolean {
  return true;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
