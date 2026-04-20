import { GameView, type GameContextValue } from "@flare-engine/engine";
import type React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Blank starter. Mounts a GameView and starts the fixed-timestep loop.
 * Add entities (sprites, inputs, systems) from `handleReady`.
 */
function handleReady(ctx: GameContextValue): void {
  ctx.loop.start();
}

export function App(): React.ReactElement {
  return (
    <View style={styles.root}>
      <GameView onReady={handleReady} style={styles.game} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  game: { flex: 1 },
});
