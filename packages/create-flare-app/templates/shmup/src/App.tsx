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
 * Shoot-em-up starter. Joystick moves a Position entity and a fire timer
 * spawns bullet entities on a fixed cadence. Add sprites + collision from
 * the render + physics packages to complete the slice.
 */
export function App(): React.ReactElement {
  const dirRef = useRef({ x: 0, y: 0 });

  const handleReady = (ctx: GameContextValue): void => {
    const player = ctx.world.spawn();
    ctx.world.add(player, Position, { x: 160, y: 420 });

    const SPEED = 180;
    const FIRE_INTERVAL = 0.12;
    let fireTimer = 0;

    ctx.loop.onUpdate.add((dt) => {
      const pos = ctx.world.get(player, Position);
      if (!pos) return;
      pos.x += dirRef.current.x * SPEED * dt;
      pos.y += dirRef.current.y * SPEED * dt;

      fireTimer += dt;
      while (fireTimer >= FIRE_INTERVAL) {
        fireTimer -= FIRE_INTERVAL;
        const bullet = ctx.world.spawn();
        ctx.world.add(bullet, Position, { x: pos.x, y: pos.y - 16 });
      }
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
