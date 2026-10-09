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
import { DOOR_COL, DOOR_ROW, TILE_SIZE, isTouchingDoor, loadMap, openDoor } from "./map";

const SPEED = 96;
const PLAYER_HALF = 6;
const PLAYER_START = { x: 24, y: 152 };

// Frame order (grass/wall/rock/door-closed/door-open at localId 0-4, x=0/16/32/48/64)
// must stay aligned with the tileset GID math in map.ts (TILE_GRASS=1 → localId=0, etc.).
// Reordering frames here without updating CHAR_TO_GID silently breaks tile rendering.
const ATLAS_FRAMES = [
  { name: "grass", w: TILE_SIZE, h: TILE_SIZE, color: 0xff3a7d44 },
  { name: "wall", w: TILE_SIZE, h: TILE_SIZE, color: 0xff5a5a66 },
  { name: "rock", w: TILE_SIZE, h: TILE_SIZE, color: 0xff8c8c8c },
  { name: "doorClosed", w: TILE_SIZE, h: TILE_SIZE, color: 0xff8b5a2b },
  { name: "doorOpen", w: TILE_SIZE, h: TILE_SIZE, color: 0xffd9b273 },
  { name: "player", w: 12, h: 12, color: 0xfff2e9d8 },
] as const;

/**
 * Top-down starter: a 4x8 house on an open field, with rocks and an openable
 * door. Walking into the closed door opens it — a `SolidGrid` cell flip plus
 * a tile-GID swap for the render, both zero-alloc (see `openDoor` in
 * ./map.ts). Walls, rocks, and the door while closed all block movement the
 * same way; the door stops blocking once opened. A virtual joystick drives
 * the player; the camera follows.
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

    // Narrow to the single tile layer once, up front — openDoor needs a
    // mutable reference to its `tiles` array every time the door opens.
    const groundLayer = map.layers[0];
    if (groundLayer === undefined || groundLayer.type !== "tile") return;

    const tilemap = new TilemapRenderer(map);
    tilemap.setTilesetImage("tiles", atlas.image);
    tilemapRef.current = tilemap;

    const grid = buildSolidGrid(
      map.width,
      map.height,
      TILE_SIZE,
      extractColliders(map),
    );
    const doorIndex = DOOR_ROW * grid.width + DOOR_COL;

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

      const dx = dirRef.current.x * SPEED * dt;
      const dy = dirRef.current.y * SPEED * dt;

      // Bump-to-open: the joystick is the only input this template wires up,
      // so walking into the closed door is the open action — no extra button.
      // Checked against the intended (pre-collision) position so the door
      // opens the same frame the player walks into it, not one frame late.
      if (grid.solid[doorIndex] !== 0 && isTouchingDoor(pos.x + dx, pos.y + dy, PLAYER_HALF, PLAYER_HALF)) {
        openDoor(groundLayer, grid);
      }

      moveAndSlideInto(grid, pos.x, pos.y, dx, dy, PLAYER_HALF, PLAYER_HALF, pos);
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
