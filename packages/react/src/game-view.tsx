import { AssetManager } from '@flare-engine/assets';
import type { AssetLoader } from '@flare-engine/assets';
import { AudioManager } from '@flare-engine/audio';
import { GameLoop } from '@flare-engine/core';
import { Position, World } from '@flare-engine/ecs';
import { InputManager } from '@flare-engine/input';
import { Camera2D, Renderer, Sprite, SpriteBatch, createRenderSystem } from '@flare-engine/render';
import { SceneManager } from '@flare-engine/scene';
import type { CanvasRef, SkPicture } from '@shopify/react-native-skia';
import { Canvas, Picture, Skia, useCanvasRef } from '@shopify/react-native-skia';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import { GameContext, type GameContextValue } from './game-context.js';
import { createSkiaFrameRenderer } from './skia-bridge.js';

/** Render hook invoked during the frame — receives the game context and
 *  the active Skia canvas for direct draw calls. Hooks run between
 *  `renderer.applyCamera()` and `renderer.end()`, so the camera transform
 *  is already applied. */
export type RenderHook = (ctx: GameContextValue, canvas: unknown) => void;

/** Configuration passed to <GameView>. */
export interface GameConfig {
  /** Fixed timestep in seconds (default 1/60). */
  fixedDt?: number;
  /** Maximum dt cap in seconds (default 0.25). */
  maxDt?: number;
  /** Background clear color as 32-bit ARGB int (default 0xFF000000). */
  clearColor?: number;
  /** Asset loader function — injected into AssetManager at construction. */
  assetLoader?: AssetLoader;
  /** Called after camera transform and before the sprite render system.
   *  Intended for tilemap / background layer rendering. */
  onRenderBackground?: RenderHook;
  /** Called after the sprite batch has been flushed, before `renderer.end()`.
   *  Intended for post-processing / full-screen effects (postfx). */
  onRenderPostFx?: RenderHook;
}

/** Props for the <GameView> component. */
export interface GameViewProps {
  /** Game configuration. */
  config?: GameConfig;
  /** Called once the game context is ready (loop not yet started). */
  onReady?: (ctx: GameContextValue) => void;
  /** Style applied to the outer View container. */
  style?: ViewStyle;
  /** Optional overlay children (e.g. VirtualJoystick, VirtualButton). */
  children?: React.ReactNode;
}

/**
 * GameView — root component that sets up the Skia canvas, game loop,
 * and all core game systems. Provides GameContext to descendants.
 *
 * Overlay controls (VirtualJoystick, VirtualButton) should be placed
 * as children; they render on top of the Skia canvas.
 */
export function GameView({ config, onReady, style, children }: GameViewProps): React.ReactElement {
  const canvasRef = useCanvasRef();
  const [picture, setPicture] = useState<SkPicture | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only
  const ctx = useMemo<GameContextValue>(() => {
    const loop = new GameLoop({
      fixedDt: config?.fixedDt,
      maxDt: config?.maxDt,
    });
    const world = new World();
    const camera = new Camera2D();
    const input = new InputManager();
    const audio = new AudioManager();
    const noop: AssetLoader = () => Promise.resolve(null);
    const assets = new AssetManager(config?.assetLoader ?? noop);
    const scenes = new SceneManager();
    const renderer = new Renderer();
    const batch = new SpriteBatch();
    return { world, camera, input, audio, assets, scenes, loop, renderer, batch };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only
  useEffect(() => {
    const bridge = createSkiaFrameRenderer(Skia);
    ctx.renderer.setCanvas(bridge.canvas);

    const clearColor = config?.clearColor ?? 0xff000000;
    const onRenderBackground = config?.onRenderBackground;
    const onRenderPostFx = config?.onRenderPostFx;

    const spriteQuery = ctx.world.query(Position, Sprite);
    const renderSystem = createRenderSystem(ctx.world, spriteQuery, Position, Sprite, ctx.batch);

    const unsubscribeLate = ctx.loop.onLateUpdate.add((dt) => {
      ctx.camera.update(dt);
      ctx.input.update();
    });

    const unsubscribePre = ctx.loop.onPreRender.add(() => {
      bridge.beginFrame(ctx.camera.viewportWidth, ctx.camera.viewportHeight);
      ctx.renderer.begin(clearColor);
      ctx.renderer.applyCamera(
        ctx.camera.effectiveX,
        ctx.camera.effectiveY,
        ctx.camera.zoom,
        ctx.camera.rotation,
        ctx.camera.viewportWidth,
        ctx.camera.viewportHeight,
      );
      if (onRenderBackground) onRenderBackground(ctx, ctx.renderer.canvas);
      renderSystem();
      ctx.batch.flush(bridge.drawAtlas, ctx.renderer);
      if (onRenderPostFx) onRenderPostFx(ctx, ctx.renderer.canvas);
      ctx.renderer.end();
      const pic = bridge.endFrame();
      if (pic !== null) setPicture(pic);
      canvasRef.current?.redraw();
    });

    onReady?.(ctx);
    ctx.loop.start();
    return () => {
      unsubscribeLate();
      unsubscribePre();
      ctx.loop.stop();
    };
  }, []);

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    ctx.camera.setViewport(width, height);
  };

  const onGrant = (e: GestureResponderEvent): void => {
    ctx.input.onPointerDown(0, e.nativeEvent.locationX, e.nativeEvent.locationY);
  };
  const onMove = (e: GestureResponderEvent): void => {
    ctx.input.onPointerMove(0, e.nativeEvent.locationX, e.nativeEvent.locationY);
  };
  const onRelease = (e: GestureResponderEvent): void => {
    ctx.input.onPointerUp(0, e.nativeEvent.locationX, e.nativeEvent.locationY);
  };

  return (
    <GameContext.Provider value={ctx}>
      <View
        style={[styles.container, style]}
        onLayout={handleLayout}
        onStartShouldSetResponder={returnTrue}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
      >
        <Canvas
          ref={canvasRef as React.Ref<CanvasRef>}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {picture !== null ? <Picture picture={picture} /> : null}
        </Canvas>
        {children}
      </View>
    </GameContext.Provider>
  );
}

function returnTrue(): boolean {
  return true;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
