import { Position, Sprite, createProceduralAtlas } from "@flare-engine/engine";
import type { GameContextValue } from "@flare-engine/engine";
import { GameView, skiaAtlasModule } from "@flare-engine/react";
import type React from "react";
import { StyleSheet, View } from "react-native";

// One cyan square rendered at world origin.
// Camera default is also (0, 0), so worldToScreen(0, 0) = screen center.
const ATLAS_FRAMES = [{ name: "sprite", w: 64, h: 64, color: 0xff6bcfff }] as const;

function onReady(ctx: GameContextValue): void {
  // createProceduralAtlas draws colored rects onto a Skia surface.
  // Must be called inside onReady — Skia context is live by this point.
  const atlas = createProceduralAtlas(skiaAtlasModule, ATLAS_FRAMES);
  const frame = atlas.sheet.frames.find((f) => f.name === "sprite");
  if (!frame) return;

  const entity = ctx.world.spawn();
  ctx.world.add(entity, Position, { x: 0, y: 0 });
  ctx.world.add(entity, Sprite, {
    image: atlas.image,
    frame,
    z: 0,
    width: frame.w,
    height: frame.h,
    anchor: { x: 0.5, y: 0.5 },
  });
  // GameView starts the loop after onReady returns — do NOT call ctx.loop.start().
}

export function App(): React.ReactElement {
  return (
    <View style={styles.root}>
      <GameView onReady={onReady} style={styles.game} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  game: { flex: 1 },
});
