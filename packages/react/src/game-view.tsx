import type { AssetLoader } from '@flare-engine/assets';
import { AssetManager } from '@flare-engine/assets';
import { AudioManager } from '@flare-engine/audio';
import { GameLoop } from '@flare-engine/core';
import { Position, World } from '@flare-engine/ecs';
import { InputManager } from '@flare-engine/input';
import { Camera2D, createRenderSystem, Renderer, Sprite, SpriteBatch } from '@flare-engine/render';
import { SceneManager } from '@flare-engine/scene';
import type { CanvasRef, SkImage, SkPicture } from '@shopify/react-native-skia';
import {
  Canvas,
  Image,
  RuntimeShader,
  Skia,
  useCanvasRef,
  usePictureAsTexture,
} from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameContext, type GameContextValue } from './game-context.js';
import { type SafeArea, SafeAreaContext } from './safe-area.js';
import { useWebSceneTexture } from './scene-texture.js';
import { createSkiaFrameRenderer, type PostFxPassDescriptor } from './skia-bridge.js';

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
  const [passes, setPasses] = useState<readonly PostFxPassDescriptor[]>(EMPTY_PASSES);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const pd = PixelRatio.get();
  const sceneSize = useMemo(
    () => ({ width: viewportSize.w * pd, height: viewportSize.h * pd }),
    [viewportSize.w, viewportSize.h, pd],
  );
  // Web and native capture the scene differently, but BOTH hooks run on both
  // platforms so hook order never varies.
  //
  // Native: usePictureAsTexture converts the SkPicture → texture each frame.
  // Web: useWebSceneTexture is now imperative — GameView's onPreRender frame
  // callback calls its capture(picture, width, height) directly instead of
  // pushing the picture through React state. The old reactive approach
  // (setState-in-a-passive-effect) tripped React's NESTED_PASSIVE_UPDATE_LIMIT
  // (50) and logged "Maximum update depth exceeded" on every web load. It also
  // cost two React renders per frame and added one hop of image latency. The
  // web hook is inert on native because nothing calls capture there.
  //
  // usePictureAsTexture calls MakeOffscreen per picture on web, allocating an
  // unreleased WebGL context every frame and evicting the on-screen canvas at
  // Chrome's 16-context cap; the web path reuses one surface instead.
  // See docs/plans/web-target-2026-08.md §12.
  const isWeb = Platform.OS === 'web';
  const nativeTexture = usePictureAsTexture(isWeb ? null : picture, sceneSize);
  const { image: webTexture, capture: captureWebScene } = useWebSceneTexture<SkImage>(Skia);
  const sceneTexture = isWeb ? webTexture : nativeTexture;

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

  // Warn once per <GameView> instance (not per page load) so each independently
  // mounted instance with a postfx binding gets its own one-time notice.
  const webPostFxWarnedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only
  useEffect(() => {
    const bridge = createSkiaFrameRenderer(Skia);
    ctx.renderer.setCanvas(bridge.canvas);

    const clearColor = config?.clearColor ?? 0xff000000;
    const onRenderBackground = config?.onRenderBackground;
    const onRenderPostFx = config?.onRenderPostFx;

    const spriteQuery = ctx.world.query(Position, Sprite);
    const renderSystem = createRenderSystem(ctx.world, spriteQuery, Position, Sprite, ctx.batch);

    // Last passes signature pushed to state; gates setPasses so an unchanged
    // (or empty) chain does not churn a fresh array + RuntimeShader tree every
    // frame. Seeded to the same EMPTY_PASSES the state holds, so an empty chain
    // never triggers a re-render from passes.
    let prevBuilt: readonly PostFxPassDescriptor[] = EMPTY_PASSES;

    const unsubscribeLate = ctx.loop.onLateUpdate.add((dt) => {
      ctx.camera.update(dt);
      ctx.input.update();
    });

    const unsubscribePre = ctx.loop.onPreRender.add(() => {
      const w = ctx.camera.viewportWidth;
      const h = ctx.camera.viewportHeight;
      bridge.beginFrame(w, h, ctx.loop.clock.elapsed, pd);
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
      if (pic !== null) {
        if (isWeb) captureWebScene(pic, w * pd, h * pd);
        else setPicture(pic);
      }
      if (!isWeb) {
        const built = bridge.buildPostFxPasses(null, null, w, h) as readonly PostFxPassDescriptor[];
        if (!samePasses(prevBuilt, built)) {
          prevBuilt = built.length === 0 ? EMPTY_PASSES : built;
          setPasses(prevBuilt);
        }
      } else if (bridge.hasPostFxBinding() && !webPostFxWarnedRef.current) {
        console.warn(
          'postfx chain skipped: Skia.RuntimeShaderBuilder and' +
            ' ImageFilter.MakeRuntimeShaderWithChildren both throw' +
            ' "Not implemented on React Native Web".',
        );
        webPostFxWarnedRef.current = true;
      }
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

  const handleLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      const { width, height } = event.nativeEvent.layout;
      ctx.camera.setViewport(width, height);
      setViewportSize({ w: width, h: height });
    },
    [ctx],
  );

  const onGrant = useCallback(
    (e: GestureResponderEvent): void => {
      const { changedTouches, identifier, locationX, locationY } = e.nativeEvent;
      if (changedTouches.length === 0) {
        ctx.input.onPointerDown(Number(identifier), locationX, locationY);
        return;
      }
      for (let i = 0; i < changedTouches.length; i++) {
        const t = changedTouches[i];
        if (t === undefined) continue;
        ctx.input.onPointerDown(Number(t.identifier), t.locationX, t.locationY);
      }
    },
    [ctx],
  );
  const onMove = useCallback(
    (e: GestureResponderEvent): void => {
      const { changedTouches, identifier, locationX, locationY } = e.nativeEvent;
      if (changedTouches.length === 0) {
        ctx.input.onPointerMove(Number(identifier), locationX, locationY);
        return;
      }
      for (let i = 0; i < changedTouches.length; i++) {
        const t = changedTouches[i];
        if (t === undefined) continue;
        ctx.input.onPointerMove(Number(t.identifier), t.locationX, t.locationY);
      }
    },
    [ctx],
  );
  const onRelease = useCallback(
    (e: GestureResponderEvent): void => {
      const { changedTouches, identifier, locationX, locationY } = e.nativeEvent;
      if (changedTouches.length === 0) {
        ctx.input.onPointerUp(Number(identifier), locationX, locationY);
        return;
      }
      for (let i = 0; i < changedTouches.length; i++) {
        const t = changedTouches[i];
        if (t === undefined) continue;
        ctx.input.onPointerUp(Number(t.identifier), t.locationX, t.locationY);
      }
    },
    [ctx],
  );

  const containerStyle = useMemo(() => [styles.container, style], [style]);
  const passElements = useMemo(
    () => passes.map((p) => <RuntimeShader key={p.id} source={p.source} uniforms={p.uniforms} />),
    [passes],
  );

  return (
    <SafeAreaContext.Provider value={resolvedSafeArea}>
      <GameContext.Provider value={ctx}>
        <View
          style={containerStyle}
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
                {passElements}
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

/** Stable empty-chain reference — an empty `buildPostFxPasses` result collapses
 *  to this so the `passes` state never changes for a postfx-free GameView. */
const EMPTY_PASSES: readonly PostFxPassDescriptor[] = [];

/**
 * Shallow structural equality of two pass lists. The signature is length +
 * per-pass `id` + shader ref + child-image refs + uniform values. Uniforms are
 * compared (not just `id`/`source`) because animating effects — the hit-flash
 * decay and timed triggers — keep a constant `id`/`source` while only their
 * uniform values change frame to frame; excluding them would freeze those
 * animations. Cost is trivial: postfx chains hold a handful of scalar/short-vec
 * uniforms.
 */
function samePasses(
  a: readonly PostFxPassDescriptor[],
  b: readonly PostFxPassDescriptor[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (pa === undefined || pb === undefined) return false;
    if (pa.id !== pb.id || pa.source !== pb.source) return false;
    if (!sameChildren(pa.children, pb.children)) return false;
    if (!sameUniforms(pa.uniforms, pb.uniforms)) return false;
  }
  return true;
}

function sameChildren(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameUniforms(
  a: PostFxPassDescriptor['uniforms'],
  b: PostFxPassDescriptor['uniforms'],
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined || vb === undefined) return false;
    if (typeof va === 'number') {
      if (va !== vb) return false;
    } else {
      if (typeof vb === 'number' || va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) {
        if (va[i] !== vb[i]) return false;
      }
    }
  }
  return true;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
