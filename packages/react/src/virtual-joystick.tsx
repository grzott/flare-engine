import {
  createJoystickState,
  releaseJoystick,
  updateJoystick,
  type VirtualJoystickConfig,
  type VirtualJoystickState,
} from '@flare-engine/input';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

/** Props for the <VirtualJoystick> component. */
export interface VirtualJoystickProps {
  /** Joystick configuration (dead zone, max radius). */
  config?: VirtualJoystickConfig;
  /** Called on each state change. */
  onStateChange?: (state: VirtualJoystickState) => void;
  /** Style applied to the outer container. */
  style?: ViewStyle;
  /** Custom node rendered in place of the default base circle View. */
  base?: React.ReactNode;
  /** Custom node rendered in place of the default knob View. */
  thumb?: React.ReactNode;
}

type TouchPoint = GestureResponderEvent['nativeEvent'];

/** The finger that holds the stick, and the page position of the stick's top-left corner. */
interface Finger {
  id: TouchPoint['identifier'] | null;
  originX: number;
  originY: number;
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
  base,
  thumb,
}: VirtualJoystickProps): React.ReactElement {
  const stateRef = useRef<VirtualJoystickState>(createJoystickState());
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const fingerRef = useRef<Finger>({ id: null, originX: 0, originY: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      sizeRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    },
    [],
  );

  const moveTo = useCallback(
    (touchX: number, touchY: number) => {
      const { w, h } = sizeRef.current;
      updateJoystick(stateRef.current, w / 2, h / 2, touchX, touchY, config);
      onStateChange?.(stateRef.current);
      const { x, y } = stateRef.current.offset;
      setKnob((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    },
    [config, onStateChange],
  );

  // No child of the stick is a touch target, so at grant `locationX/Y` is measured
  // against the stick on every platform. Android measures later events against
  // whichever view is under the finger by then, so moves are read as page
  // coordinates from the origin taken here.
  const handleGrant = useCallback(
    (e: GestureResponderEvent) => {
      const touch = e.nativeEvent;
      const finger = fingerRef.current;
      finger.id = touch.identifier;
      finger.originX = touch.pageX - touch.locationX;
      finger.originY = touch.pageY - touch.locationY;
      moveTo(touch.locationX, touch.locationY);
    },
    [moveTo],
  );

  const handleMove = useCallback(
    (e: GestureResponderEvent) => {
      const finger = fingerRef.current;
      const touch = findTouch(e.nativeEvent, finger.id);
      if (touch === undefined) return;
      moveTo(touch.pageX - finger.originX, touch.pageY - finger.originY);
    },
    [moveTo],
  );

  const handleRelease = useCallback(() => {
    releaseJoystick(stateRef.current);
    onStateChange?.(stateRef.current);
    setKnob((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }, [onStateChange]);

  const maxRadius = config?.maxRadius ?? 50;

  return (
    <View
      style={[
        styles.center,
        ...(base ? [] : [styles.baseBg]),
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
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={handleRelease}
      onResponderTerminationRequest={returnFalse}
    >
      {base ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {base}
        </View>
      ) : null}
      {thumb ? (
        <View
          style={{ transform: [{ translateX: knob.x }, { translateY: knob.y }] }}
          pointerEvents="none"
        >
          {thumb}
        </View>
      ) : (
        <View
          style={[styles.knob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]}
        />
      )}
    </View>
  );
}

/**
 * The stick's own finger in a touch event. The event's own fields describe the
 * first changed touch, which can be another finger on the screen.
 */
function findTouch(event: TouchPoint, id: Finger['id']): TouchPoint | undefined {
  const touches = event.touches;
  if (touches !== undefined) {
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (touch !== undefined && touch.identifier === id) return touch;
    }
  }
  return event.identifier === id ? event : undefined;
}

function returnTrue(): boolean {
  return true;
}

function returnFalse(): boolean {
  return false;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseBg: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  knob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    pointerEvents: 'none',
  },
});
