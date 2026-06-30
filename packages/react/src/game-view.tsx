import { AssetManager } from '@flare-engine/assets';
import type { AssetLoader } from '@flare-engine/assets';
import { AudioManager } from '@flare-engine/audio';
import { GameLoop } from '@flare-engine/core';
import { Position, World } from '@flare-engine/ecs';
import { InputManager } from '@flare-engine/input';
import { Camera2D, Renderer, Sprite, SpriteBatch, createRenderSystem } from '@flare-engine/render';
import { SceneManager } from '@flare-engine/scene';
import type { CanvasRef, SkPicture } from '@shopify/react-native-skia';
import {
  Canvas,
  Image,
  RuntimeShader,
  Skia,
  useCanvasRef,
  usePictureAsTexture,
} from '@shopify/react-native-skia';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameContext, type GameContextValue } from './game-context.js';
import { type SafeArea, SafeAreaContext } from './safe-area.js';
import { type PostFxPassDescriptor, createSkiaFrameRenderer } from './skia-bridge.js';

/** Render hook invoked during the frame — receives the game context and
 *  the active Skia canvas for direct draw calls. Hooks run between
 *  `renderer.applyCamera()` and `renderer.end()`, so the camera transform
 *  is already applied. */
export type RenderHook = (ctx: GameContextValue, canvas: unknown) => void;

/** Render hook for post-processing passes. Receives the game context, the
 *  active Skia canvas, and the `SkiaFrameRenderer` bridge so the hook can
 *  call `bridge.setPostFxBinding(runtime, chain)` to register the runtime
 *  and chain for the current frame.
 *  `bridge` is `null` only on platforms where no Skia renderer was created
 *  (future web fallback). */
export type PostFxRenderHook = (
  ctx: GameContextValue,
  canvas: unknown,
  bridge: import('./skia-bridge.js').SkiaFrameRenderer | null,
) => void;

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
   *  Receives the bridge as 3rd arg so the hook can call
   *  `bridge.setPostFxBinding(runtime, chain)` to register the postfx runtime
   *  and chain for the current frame. */
  onRenderPostFx?: PostFxRenderHook;
  /**
   * Promote the underlying Skia surface from a TextureView (default) to a
   * SurfaceView on Android. With `opaque: true`, SurfaceView paints in a
   * separate compositing layer below the regular RN view tree, which lets
   * full-screen RN overlays (HUDs, menus) render on top without needing
   * elevation/zIndex tricks.
   *
   * Without this, RN-Skia's TextureView can clip overlapping full-screen
   * RN siblings on certain Android devices/Fabric configurations.
   *
   * Implies the canvas content is opaque — the clearColor's alpha must be
   * fully opaque (0xFF). Defaults to `false` to preserve the current
   * iOS-equivalent behavior.
   */
  opaque?: boolean;
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
  /** Explicit safe-area insets. If omitted, resolved from react-native-safe-area-context
   *  via `useSafeAreaInsets()` (requires a `<SafeAreaProvider>` ancestor; falls back to
   *  zero insets when no provider is mounted). */
  safeArea?: SafeArea;
}

/**
 * GameView — root component that sets up the Skia canvas, game loop,
 * and all core game systems. Provides GameContext to descendants.
 *
 * Overlay controls (VirtualJoystick, VirtualButton) should be placed
 * as children; they render on top of the Skia canvas.
 */
export function GameView({
  config,
  onReady,
  style,
  children,
  safeArea,
}: GameViewProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const resolvedSafeArea: SafeArea = safeArea ?? insets;
  const canvasRef = useCanvasRef();
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [passes, setPasses] = useState<readonly PostFxPassDescriptor[]>([]);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const pd = PixelRatio.get();
  const sceneSize = useMemo(
    () => ({ width: viewportSize.w * pd, height: viewportSize.h * pd }),
    [viewportSize.w, viewportSize.h, pd],
  );
  const sceneTexture = usePictureAsTexture(picture, sceneSize);

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
      const w = ctx.camera.viewportWidth;
      const h = ctx.camera.viewportHeight;
      bridge.beginFrame(w, h, 0, pd);
      ctx.renderer.begin(clearColor);
      ctx.renderer.applyCamera(
        ctx.camera.effectiveX,
        ctx.camera.effectiveY,
        ctx.camera.zoom,
        ctx.camera.rotation,
        w,
        h,
      );
      if (onRenderBackground) onRenderBackground(ctx, ctx.renderer.canvas);
      renderSystem();
      ctx.batch.flush(bridge.drawAtlas, ctx.renderer);
      if (onRenderPostFx) onRenderPostFx(ctx, ctx.renderer.canvas, bridge);
      ctx.renderer.end();
      const pic = bridge.endFrame() as SkPicture | null;
      if (pic !== null) setPicture(pic);
      const built = bridge.buildPostFxPasses(null, null, w, h) as readonly PostFxPassDescriptor[];
      setPasses(built);
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
    setViewportSize({ w: width, h: height });
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
    <SafeAreaContext.Provider value={resolvedSafeArea}>
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
            opaque={config?.opaque ?? false}
          >
            {viewportSize.w === 0 || sceneTexture == null ? null : (
              <Image
                image={sceneTexture}
                x={0}
                y={0}
                width={viewportSize.w}
                height={viewportSize.h}
                fit="cover"
              >
                {passes.map((p) => (
                  <RuntimeShader key={p.id} source={p.source} uniforms={p.uniforms} />
                ))}
              </Image>
            )}
          </Canvas>
          {children}
        </View>
      </GameContext.Provider>
    </SafeAreaContext.Provider>
  );
}

function returnTrue(): boolean {
  return true;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
