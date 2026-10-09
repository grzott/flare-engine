/**
 * Shmup starter template — thin React Native shell.
 *
 * The heavy logic lives in ./logic.ts (headless, no Skia dependency) so it
 * can be unit-tested without mocks.  This file owns only:
 *   - Atlas build (needs Skia surface)
 *   - ECS entity spawn (player)
 *   - Joystick → player movement
 *   - Score HUD
 *   - Wiring the frame loop
 *
 * Key conventions:
 *   DO NOT call ctx.loop.start() — GameView calls it after onReady returns.
 *   DO call ctx.world.step(dt) in onUpdate — GameLoop does NOT auto-step the world.
 *   Create all ECS queries in onReady (World.query() registers a permanent query).
 */
import { Position, Sprite, createProceduralAtlas } from "@flare-engine/engine";
import type { GameContextValue, VirtualJoystickState } from "@flare-engine/engine";
import { GameView, VirtualJoystick, skiaAtlasModule } from "@flare-engine/react";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  createShmupState,
  setupShmup,
  stepShmup,
} from "./logic";

// ─── Colour palette ───────────────────────────────────────────────────────────
// ARGB hex constants.  Change these to re-skin the whole game in seconds.
const COLOR_PLAYER  = 0xff6bcfff; // cyan-ish ship
const COLOR_BULLET  = 0xffffe566; // bright yellow
const COLOR_ENEMY   = 0xffff5454; // hostile red

// ─── Atlas frames ─────────────────────────────────────────────────────────────
const ATLAS_FRAMES = [
  { name: "player", w: 16, h: 20, color: COLOR_PLAYER },
  { name: "bullet", w:  6, h: 12, color: COLOR_BULLET },
  { name: "enemy",  w: 24, h: 24, color: COLOR_ENEMY  },
] as const;

const PLAYER_START_X = 160;
const PLAYER_START_Y = 600;
const PLAYER_HALF_W  = 8;
const PLAYER_HALF_H  = 10;
const PLAYER_SPEED   = 200; // px/s

export function App(): React.ReactElement {
  const dirRef = useRef({ x: 0, y: 0 });
  const [score, setScore] = useState(0);

  // GameView's onRenderBackground hook is optional; kept empty here — we rely
  // on the built-in (Position, Sprite) render system.
  const config = useMemo(() => ({}), []);

  const handleReady = useCallback((ctx: GameContextValue): void => {
    // ── Build atlas ───────────────────────────────────────────────────────────
    // createProceduralAtlas draws solid-colour rects onto a Skia surface.
    // Must be called inside onReady (Skia context is live by this point).
    // skiaAtlasModule centralises the Skia → SkiaAtlasModuleLike adaptation.
    const atlas = createProceduralAtlas(skiaAtlasModule, ATLAS_FRAMES);

    const playerFrame = atlas.sheet.frames.find((f) => f.name === "player")!;
    const bulletFrame = atlas.sheet.frames.find((f) => f.name === "bullet")!;
    const enemyFrame  = atlas.sheet.frames.find((f) => f.name === "enemy")!;

    // ── Register engine systems + get the mutable bounds handle ──────────────
    // setupShmup registers createMovementSystem (priority 0) and
    // createBoundsCullSystem (priority 2).  bounds is updated every frame in
    // onUpdate from the live camera viewport so wide screens never misfire.
    const { bounds, stateRef } = setupShmup(ctx.world);

    // ── Spawn player ──────────────────────────────────────────────────────────
    const player = ctx.world.spawn();
    ctx.world.add(player, Position, { x: PLAYER_START_X, y: PLAYER_START_Y });
    ctx.world.add(player, Sprite, {
      image: atlas.image,
      frame: playerFrame,
      z: 1,
      width: playerFrame.w,
      height: playerFrame.h,
      anchor: { x: 0.5, y: 0.5 },
    });

    // ── Build shared sprite data for bullets and enemies ──────────────────────
    // These objects are passed to every bullet/enemy entity by reference —
    // no per-entity copy, satisfying the zero-alloc constraint.
    const bulletSprite = {
      image: atlas.image,
      frame: bulletFrame,
      z: 2,
      width: bulletFrame.w,
      height: bulletFrame.h,
      anchor: { x: 0.5, y: 0.5 },
    };
    const enemySprite = {
      image: atlas.image,
      frame: enemyFrame,
      z: 0,
      width: enemyFrame.w,
      height: enemyFrame.h,
      anchor: { x: 0.5, y: 0.5 },
    };

    // ── Create game state (queries registered inside, never per-frame) ─────────
    const state = createShmupState(ctx.world, bulletSprite, enemySprite);

    // Wire stateRef so the cull callback (registered in setupShmup) can access
    // the pools.  MUST happen before the first world.step call.
    stateRef.current = state;

    // ── Per-frame update ──────────────────────────────────────────────────────
    ctx.loop.onUpdate.add((dt) => {
      // Keep bounds in sync with the live viewport every frame.
      // camera.viewportWidth is 0 at onReady (layout not measured yet), so we
      // update here — pure number writes, no allocation.
      const vw = ctx.camera.viewportWidth  > 0 ? ctx.camera.viewportWidth  : 400;
      const vh = ctx.camera.viewportHeight > 0 ? ctx.camera.viewportHeight : 750;
      bounds.minX = -32;
      bounds.minY = -64;
      bounds.maxX = vw + 32;
      bounds.maxY = vh + 64;

      // 1. Move player in-place from joystick, clamped to the live viewport.
      const pos = ctx.world.get(player, Position);
      if (pos !== undefined) {
        pos.x = Math.max(PLAYER_HALF_W, Math.min(vw - PLAYER_HALF_W, pos.x + dirRef.current.x * PLAYER_SPEED * dt));
        pos.y = Math.max(PLAYER_HALF_H, Math.min(vh - PLAYER_HALF_H, pos.y + dirRef.current.y * PLAYER_SPEED * dt));
      }

      // 2. Step world systems: movement integrates velocities, cull removes
      //    entities that crossed the screen boundary.
      //    Note: player has no Velocity component, so the movement system
      //    skips it — the manual move above is the only player integration.
      ctx.world.step(dt);

      // 3. Game logic: fire bullets, spawn enemies, detect collisions.
      const kills = stepShmup(ctx.world, state, dt, pos?.x ?? PLAYER_START_X, pos?.y ?? PLAYER_START_Y);

      // Update score only on kills — not every frame — to keep React renders minimal.
      if (kills > 0) setScore((s) => s + kills);
    });

    // NOTE: Do NOT call ctx.loop.start() — GameView calls it after onReady returns.
  }, []); // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only

  const handleJoystick = useCallback((state: VirtualJoystickState): void => {
    dirRef.current.x = state.direction.x;
    dirRef.current.y = state.direction.y;
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <GameView config={config} onReady={handleReady} style={styles.game}>
          {/* Score overlay — updated only on kills, not per-frame */}
          <Text style={styles.score}>Score: {score}</Text>
          <VirtualJoystick style={styles.joystick} onStateChange={handleJoystick} />
        </GameView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#000" },
  game:    { flex: 1 },
  score:   { position: "absolute", top: 24, right: 24, color: "#fff", fontSize: 18 },
  joystick:{ position: "absolute", left: 24, bottom: 24 },
});
