import {
  Position,
  Sprite,
  TilemapRenderer,
  buildSolidGrid,
  createProceduralAtlas,
  extractColliders,
  moveAndSlideInto,
} from "@flare-engine/engine";
import type {
  GameContextValue,
  VirtualJoystickState,
} from "@flare-engine/engine";
import { GameView, VirtualJoystick, skiaAtlasModule } from "@flare-engine/react";
import type React from "react";
import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TILE_SIZE, loadMap } from "./map";

const SPEED = 96;
const PLAYER_HALF = 6;
const PLAYER_START = { x: 40, y: 88 };

// Frame order (grass/wall/water/sand at localId 0/1/2/3, x=0/16/32/48) must stay
// aligned with the tileset GID math in map.ts (TILE_GRASS=1 → localId=0, etc.).
// Reordering frames here without updating CHAR_TO_GID silently breaks tile rendering.
const ATLAS_FRAMES = [
  { name: "grass", w: TILE_SIZE, h: TILE_SIZE, color: 0xff3a7d44 },
  { name: "wall", w: TILE_SIZE, h: TILE_SIZE, color: 0xff5a5a66 },
  { name: "water", w: TILE_SIZE, h: TILE_SIZE, color: 0xff2a6db5 },
  { name: "sand", w: TILE_SIZE, h: TILE_SIZE, color: 0xffd9c27e },
  { name: "player", w: 12, h: 12, color: 0xfff2e9d8 },
] as const;

/**
 * Top-down starter proving the tilemap pipeline end to end:
 * ASCII art -> Tiled JSON -> parseTiled -> TilemapRenderer (culled draw)
 * -> extractColliders -> axis-separated collision. A virtual joystick
 * drives the player; the camera follows.
 */
export function App(): React.ReactElement {
  const dirRef = useRef({ x: 0, y: 0 });
  const tilemapRef = useRef<TilemapRenderer | null>(null);

  const config = useMemo(
    () => ({
      onRenderBackground: (ctx: GameContextValue) => {
        tilemapRef.current?.drawInto(ctx.camera, ctx.batch);
      },
    }),
    [],
  );

  const handleReady = (ctx: GameContextValue): void => {
    const atlas = createProceduralAtlas(skiaAtlasModule, ATLAS_FRAMES);
    const map = loadMap();

    const tilemap = new TilemapRenderer(map);
    tilemap.setTilesetImage("tiles", atlas.image);
    tilemapRef.current = tilemap;

    const grid = buildSolidGrid(
      map.width,
      map.height,
      TILE_SIZE,
      extractColliders(map),
    );

    const player = ctx.world.spawn();
    ctx.world.add(player, Position, { x: PLAYER_START.x, y: PLAYER_START.y });
    const playerFrame = atlas.sheet.frames.find((f) => f.name === "player");
    if (playerFrame) {
      ctx.world.add(player, Sprite, {
        image: atlas.image,
        frame: playerFrame,
        z: 1,
        width: playerFrame.w,
        height: playerFrame.h,
        anchor: { x: 0.5, y: 0.5 },
      });
    }

    ctx.camera.zoom = 2;
    const target = { x: PLAYER_START.x, y: PLAYER_START.y };
    ctx.camera.follow(target);

    ctx.loop.onUpdate.add((dt) => {
      const pos = ctx.world.get(player, Position);
      if (!pos) return;
      moveAndSlideInto(
        grid,
        pos.x,
        pos.y,
        dirRef.current.x * SPEED * dt,
        dirRef.current.y * SPEED * dt,
        PLAYER_HALF,
        PLAYER_HALF,
        pos,
      );
      target.x = pos.x;
      target.y = pos.y;
    });
  };

  const handleJoystick = (state: VirtualJoystickState): void => {
    dirRef.current.x = state.direction.x;
    dirRef.current.y = state.direction.y;
  };

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <GameView config={config} onReady={handleReady} style={styles.game}>
          <VirtualJoystick style={styles.joystick} onStateChange={handleJoystick} />
        </GameView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  game: { flex: 1 },
  joystick: { position: "absolute", left: 24, bottom: 24 },
});
