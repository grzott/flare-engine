import {
  GameView,
  Position,
  VirtualJoystick,
  type GameContextValue,
  type VirtualJoystickState,
} from "@flare-engine/engine";
import type React from "react";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";

/**
 * Top-down starter. A virtual joystick drives a Position entity and the
 * camera follows it. Add your own Sprite component + atlas to render.
 */
export function App(): React.ReactElement {
  const dirRef = useRef({ x: 0, y: 0 });

  const handleReady = (ctx: GameContextValue): void => {
    const player = ctx.world.spawn();
    ctx.world.add(player, Position, { x: 160, y: 240 });

    // Camera follows the player's Position component.
    const target = { x: 160, y: 240 };
    ctx.camera.follow(target);

    const SPEED = 120;
    ctx.loop.onUpdate.add((dt) => {
      const pos = ctx.world.get(player, Position);
      if (!pos) return;
      pos.x += dirRef.current.x * SPEED * dt;
      pos.y += dirRef.current.y * SPEED * dt;
      // Update follow target each frame.
      target.x = pos.x;
      target.y = pos.y;
    });

    ctx.loop.start();
  };

  const handleJoystick = (state: VirtualJoystickState): void => {
    dirRef.current.x = state.direction.x;
    dirRef.current.y = state.direction.y;
  };

  return (
    <View style={styles.root}>
      <GameView onReady={handleReady} style={styles.game}>
        <VirtualJoystick
          style={styles.joystick}
          onStateChange={handleJoystick}
        />
      </GameView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  game: { flex: 1 },
  joystick: { position: "absolute", left: 24, bottom: 24 },
});
