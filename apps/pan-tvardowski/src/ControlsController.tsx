import type { VirtualButtonState, VirtualJoystickState } from '@flare-engine/engine';
import { VirtualButton, VirtualJoystick } from '@flare-engine/engine';
import type React from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { bombButtonState, gameState, joystickState } from './state';

// Kenney controls — Large (2×) standalone PNGs bundled for Metro.
// Placed in assets/kenney-controls/ (separate from kenney-src/ so the atlas
// packer never picks them up). Required at module level so Metro can statically
// analyse the paths and include them in the bundle.
const IMG_BUTTON_CIRCLE = require('../assets/kenney-controls/button_circle.png') as number;
const IMG_JOYSTICK_PAD = require('../assets/kenney-controls/joystick_circle_pad_a.png') as number;
const IMG_JOYSTICK_NUB = require('../assets/kenney-controls/joystick_circle_nub_a.png') as number;
const IMG_ICON_FIRE = require('../assets/kenney-controls/icon_fire.png') as number;

interface ControlsControllerProps {
  insets: EdgeInsets;
  controlsTick: number;
  currentScene: string;
}

export function ControlsController({
  insets,
  controlsTick,
  currentScene,
}: ControlsControllerProps): React.ReactElement | null {
  const onJoystick = (s: VirtualJoystickState): void => {
    joystickState.dx = s.direction.x;
    joystickState.dy = s.direction.y;
    joystickState.active = s.active;
  };
  const onBomb = (s: VirtualButtonState): void => {
    if (s.justPressed) bombButtonState.justPressed = true;
    bombButtonState.isPressed = s.isPressed;
  };

  // Joystick skin nodes — stable (no changing deps).
  const joystickBase = useMemo(
    () => <Image source={IMG_JOYSTICK_PAD} style={{ width: 128, height: 128 }} />,
    [],
  );
  const joystickThumb = useMemo(
    () => <Image source={IMG_JOYSTICK_NUB} style={{ width: 64, height: 64 }} />,
    [],
  );

  // Bomb button skin — button_circle bg + icon_fire overlay, both standalone PNGs.
  // Standalone path chosen for C: the button is a plain RN View; keeping both
  // layers as RN <Image> nodes avoids mixing a Skia Canvas into the button tree.
  const bombChildren = useMemo(
    () => (
      <>
        <Image source={IMG_BUTTON_CIRCLE} style={controlsStyles.bombBg} />
        <Image source={IMG_ICON_FIRE} style={controlsStyles.bombIcon} />
      </>
    ),
    [],
  );

  // `controlsTick` is a manual bump counter — `gameState` is a mutable
  // singleton, so reading `gameState.settings.controls.*` alone does not
  // trigger re-computation; bumping `controlsTick` in the settings-scene
  // completion callback forces these memos to re-evaluate.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mutable singleton read
  const joystickStyle = useMemo(() => {
    const side = gameState.settings.controls.joystickSide;
    const base = { ...controlsStyles.joystick, bottom: 48 + insets.bottom };
    return side === 'left'
      ? { ...base, left: 24 + insets.left }
      : { ...base, right: 24 + insets.right };
  }, [insets.left, insets.right, insets.bottom, controlsTick]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mutable singleton read
  const bombStyle = useMemo(() => {
    const side = gameState.settings.controls.fireButtonSide;
    const base = { ...controlsStyles.bombBtn, bottom: 48 + insets.bottom };
    return side === 'right'
      ? { ...base, right: 24 + insets.right }
      : { ...base, left: 24 + insets.left };
  }, [insets.left, insets.right, insets.bottom, controlsTick]);

  if (currentScene !== 'play') return null;

  return (
    <>
      <VirtualJoystick
        onStateChange={onJoystick}
        style={joystickStyle}
        config={{ maxRadius: 64 }}
        base={joystickBase}
        thumb={joystickThumb}
      />
      <VirtualButton onStateChange={onBomb} style={bombStyle}>
        {bombChildren}
      </VirtualButton>
    </>
  );
}

const controlsStyles = StyleSheet.create({
  joystick: {
    position: 'absolute',
    width: 128,
    height: 128,
  },
  bombBtn: {
    position: 'absolute',
    width: 64,
    height: 64,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bombBg: {
    position: 'absolute',
    width: 64,
    height: 64,
  },
  bombIcon: {
    width: 32,
    height: 32,
  },
});
