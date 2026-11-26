import type { AssetLoader } from '@flare-engine/assets';
import { AssetManager } from '@flare-engine/assets';
import { AudioManager } from '@flare-engine/audio';
import { GameLoop } from '@flare-engine/core';
import { Position, World } from '@flare-engine/ecs';
import { InputManager } from '@flare-engine/input';
import {
  Camera2D,
  createRenderSystem,
  type FrameRendererCompiledPass,
  Renderer,
  Sprite,
  SpriteBatch,
} from '@flare-engine/render';
import { SceneManager } from '@flare-engine/scene';
import type { CanvasRef, SkImage, SkPicture, SkSurface } from '@shopify/react-native-skia';
import {
  Canvas,
  FilterMode,
  Image,
  ImageShader,
  MipmapMode,
  Rect,
  RuntimeShader,
  Shader,
  Skia,
  useCanvasRef,
} from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import { Dimensions, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { scheduleOnUI } from 'react-native-worklets';
import { createContextLossWatch, findContextLossTarget } from './context-loss.js';
import { GameContext, type GameContextValue } from './game-context.js';
import { type SafeArea, SafeAreaContext } from './safe-area.js';
import { createSceneCapture, type SceneCapture } from './scene-texture.js';
import { createSkiaFrameRenderer, type PostFxPassDescriptor } from './skia-bridge.js';
import { createWebPostFxCompositor } from './web-postfx.js';

/**
 * Capture the frame's picture into an offscreen surface **on the UI thread**.
 *
 * The thread is the entire point, and getting it wrong is invisible to every
 * test in this repo. RN-Skia's own `usePictureAsTexture` does exactly this work
 * inside `runOnUI` (`external/reanimated/textures.ts`), and it must: a surface
 * built on the JS thread belongs to a different GL context than the on-screen
 * `<Canvas>`, so the `<Image>` samples nothing and the app renders a black
 * frame while the game loop runs happily. Building the surface here — same
 * thread, same context as the canvas that samples it — is what makes the
 * snapshot drawable without a `makeNonTextureImage()` GPU→CPU readback.
 *
 * Verified on device (Pixel 7 / Android 17): JS-thread capture → black canvas;
 * this path → renders. See external-review-2026-08.md §11.4b.
 *
 * The surface is cached across frames in a shared value rather than rebuilt per
 * frame (RN-Skia rebuilds it every call; that is NEW-2). `surfaceKey` packs the
 * pixel size so a viewport change reallocates exactly once.
 */
const captureSceneOnUI = (
  target: SharedValue<SkImage | null>,
  surfaceSV: SharedValue<SkSurface | null>,
  surfaceKey: SharedValue<number>,
  picture: SkPicture,
  w: number,
  h: number,
): void => {
  'worklet';
  const key = w * 65536 + h;
  if (surfaceSV.value === null || surfaceKey.value !== key) {
    surfaceSV.value = Skia.Surface.MakeOffscreen(w, h);
    surfaceKey.value = key;
  }
  const surface = surfaceSV.value;
  if (surface === null) return;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  target.value = surface.makeImageSnapshot();
};

/** Render hook invoked during the frame — receives the game context and
 *  the active Skia canvas for direct draw calls. Hooks run between
 *  `renderer.applyCamera()` and `renderer.end()`, so the camera transform
 *  is already applied. */
export type RenderHook = (ctx: GameContextValue, canvas: unknown) => void;

/** Render hook for post-processing passes. Receives the game context, the
 *  active Skia canvas, and the `SkiaFrameRenderer` bridge so the hook can
 *  call `bridge.setPostFxBinding(runtime, chain)` to register the runtime
 *  and chain for the current frame. The bound chain renders on native through
 *  RN-Skia shader nodes and on web through the imperative composite inside the
 *  scene capture (see `createWebPostFxCompositor`).
 *  `bridge` is `null` only on platforms where no Skia renderer was created. */
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
   *  and chain for the current frame, on native and on web alike. */
  onRenderPostFx?: PostFxRenderHook;
  /**
   * Promote the underlying Skia surface from a TextureView (default) to a
   * SurfaceView on Android. The SurfaceView paints in its own compositing
   * layer below the RN view tree, so full-screen RN overlays (HUDs, menus)
   * render on top without elevation/zIndex tricks; RN-Skia's TextureView can
   * clip them on some Android devices/Fabric configurations.
   *
   * Implies opaque content: the clearColor's alpha must be 0xFF, as the
   * default `0xff000000` is. Defaults to `false`.
   *
   * **Leave it `false` on Android unless overlays are clipped.** The
   * SurfaceView's buffer queue stays full, so the loop gets every other vsync:
   * on a Pixel 7 an empty scene looped at 45 Hz on a 90 Hz display and 30 Hz
   * at 60 Hz, frames reaching the screen 40 ms after queueing, against the
   * display rate and 22-33 ms by default (#545). The default's cost is log
   * noise, not rendering or memory: RN-Skia logs `LegacySurfaceTexture is not
   * attached!` and `updateAndRelease() failed` on every render. Filter them:
   * `adb logcat | grep -vE "LegacySurfaceTexture|updateAndRelease"`.
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
  /** Explicit safe-area insets. If omitted, resolved via `useContext(SafeAreaInsetsContext)`
   *  from react-native-safe-area-context; falls back to `{ top: 0, right: 0, bottom: 0,
   *  left: 0 }` when no `<SafeAreaProvider>` ancestor is mounted. */
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
  // useContext must run unconditionally (hook rules), even when `safeArea` makes its
  // value unused below — it never throws, unlike useSafeAreaInsets() without a provider.
  const contextInsets = useContext(SafeAreaInsetsContext);
  const resolvedSafeArea: SafeArea = safeArea ?? contextInsets ?? ZERO_INSETS;
  const canvasRef = useCanvasRef();
  const [passes, setPasses] = useState<readonly PostFxPassDescriptor[]>(EMPTY_PASSES);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  // The frame loop lives in a mount-only effect, so it reads the ratio through
  // this ref: refreshed on every render and on a Dimensions change, which is
  // how a scale change (another monitor, browser zoom) arrives without a layout.
  const pdRef = useRef(1);
  pdRef.current = PixelRatio.get();
  const isWeb = Platform.OS === 'web';
  // Both platforms write captured frames into a Reanimated shared value so
  // rn-skia's <Image> reads the latest frame on the UI thread without a React
  // re-render. createSceneCapture reuses one offscreen surface per viewport
  // size (fixing per-frame MakeOffscreen on native, NEW-2) and gates the
  // GPU→CPU makeNonTextureImage() copy to web only, where cross-context
  // sampling requires it (web: nonTextureImage true, native: false).
  const sceneImage = useSharedValue<SkImage | null>(null);
  const captureRef = useRef<SceneCapture<SkImage> | null>(null);
  // Native only: the offscreen surface lives on the UI thread, so it is held in
  // shared values rather than a ref — a ref would put it back on the JS thread
  // and reintroduce the black-frame regression captureSceneOnUI exists to fix.
  const uiSurface = useSharedValue<SkSurface | null>(null);
  const uiSurfaceKey = useSharedValue(0);
  // Web only: a lost WebGL context leaves the on-screen canvas black for good,
  // so a loss rebuilds both surfaces. Bumping the epoch changes <Canvas>'s key,
  // which remounts it onto a new <canvas> element and context; the capture is
  // dropped with it because a GPU reset or a sleep loses every context, and the
  // capture's own canvas is out of reach to listen on. The shared value is
  // cleared because dispose() releases the image it holds.
  const containerRef = useRef<View>(null);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const lossWatch = useMemo(
    () =>
      createContextLossWatch(() => {
        captureRef.current?.dispose();
        captureRef.current = null;
        sceneImage.value = null;
        setCanvasEpoch(nextEpoch);
      }),
    [sceneImage],
  );

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

    // Last passes signature pushed to state; gates setPasses so an unchanged
    // (or empty) chain does not churn a fresh array + RuntimeShader tree every
    // frame. Seeded to the same EMPTY_PASSES the state holds, so an empty chain
    // never triggers a re-render from passes.
    let prevBuilt: readonly PostFxPassDescriptor[] = EMPTY_PASSES;

    const unsubscribeLate = ctx.loop.onLateUpdate.add((dt) => {
      ctx.camera.update(dt);
      ctx.input.update();
    });

    const pdSubscription = Dimensions.addEventListener('change', () => {
      pdRef.current = PixelRatio.get();
    });

    const unsubscribePre = ctx.loop.onPreRender.add(() => {
      // A loss whose restore has not arrived by this frame is recovered here,
      // before the capture below, so this frame already draws into new surfaces.
      if (isWeb) lossWatch.flush();
      const w = ctx.camera.viewportWidth;
      const h = ctx.camera.viewportHeight;
      const pd = pdRef.current;
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
      const pic = bridge.endFrame();
      if (pic !== null) {
        if (isWeb) {
          // Web has one thread, so the JS-thread capture is same-context by
          // construction; this is the path WEB-1..WEB-7 verified in Chrome,
          // including the surface cache that keeps Chrome from evicting the
          // on-screen canvas (web-target-2026-08.md §12). The postfx chain runs
          // inside the capture, in place on that same surface (#60), so the
          // image the plain <Image> below samples is already filtered.
          if (captureRef.current === null) {
            captureRef.current = createSceneCapture(Skia, {
              nonTextureImage: true,
              retentionDepth: 3,
              postfx: createWebPostFxCompositor<SkImage>(Skia),
            });
          }
          // Physical pixels: the surface is w*pd × h*pd and every SkSL
          // `resolution` uniform must match the space the pass is drawn in.
          const fx = bridge.hasPostFxBinding()
            ? bridge.compilePostFxPasses(null, null, w * pd, h * pd)
            : EMPTY_COMPILED;
          const img = captureRef.current.capture(pic, w * pd, h * pd, fx);
          if (img !== null) sceneImage.value = img;
        } else {
          // Native must build the surface on the UI thread — see captureSceneOnUI.
          // `scheduleOnUI` and not Reanimated's `runOnUI`: the latter is curried,
          // so `runOnUI(fn)` allocated a fresh wrapper on every frame in this
          // hook. Passing the args directly allocates nothing (ADR-0002).
          scheduleOnUI(
            captureSceneOnUI,
            sceneImage,
            uiSurface,
            uiSurfaceKey,
            pic as SkPicture,
            w * pd,
            h * pd,
          );
        }
      }
      // Web never pushes passes: its chain was composited into the scene image
      // above, so `passes` stays EMPTY_PASSES and the tree is the plain <Image>.
      if (!isWeb) {
        if (bridge.hasPostFxBinding()) {
          const built = bridge.buildPostFxPasses(
            null,
            null,
            w,
            h,
          ) as readonly PostFxPassDescriptor[];
          if (!samePasses(prevBuilt, built)) {
            prevBuilt = built.length === 0 ? EMPTY_PASSES : built;
            setPasses(prevBuilt);
          }
        } else if (prevBuilt !== EMPTY_PASSES) {
          prevBuilt = EMPTY_PASSES;
          setPasses(EMPTY_PASSES);
        }
      }
      canvasRef.current?.redraw();
    });

    onReady?.(ctx);
    ctx.loop.start();
    return () => {
      unsubscribeLate();
      unsubscribePre();
      pdSubscription.remove();
      renderSystem.dispose();
      captureRef.current?.dispose();
      captureRef.current = null;
      ctx.loop.stop();
    };
  }, []);

  // Runs after each commit that mounted a <Canvas>: RN-Skia's web view renders
  // its <canvas> in that same commit, and <Canvas> is the container's first
  // child, so the first match is the on-screen canvas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: canvasEpoch re-runs this for the remounted canvas
  useEffect(() => {
    if (!isWeb) return undefined;
    lossWatch.attach(findContextLossTarget(containerRef.current));
    return lossWatch.detach;
  }, [canvasEpoch, isWeb, lossWatch]);

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
  // RN-Skia's <RuntimeShader> image filter binds the implicit source only
  // (MakeRuntimeShader(rtb, null, null)) and never consumes child shaders, so a
  // pass with extra sampler children (color-grading-lut) would be dropped by
  // it. Such a pass, and every pass before it, runs as one paint shader on a
  // <Rect> instead: nested <Shader>s bind their children positionally (src,
  // then each entry of pass.children), the convention render-web uses. Passes
  // after the last child-bearing one stay <RuntimeShader> image filters — a
  // nested <Shader> re-evaluates src per tap, which would multiply reads for
  // multi-tap effects. A chain with no children keeps the plain <Image> tree.
  const canvasContent = useMemo(() => {
    if (viewportSize.w === 0) return null;
    const w = viewportSize.w;
    const h = viewportSize.h;
    const last = lastPassWithChildren(passes);
    if (last < 0) {
      return (
        <Image image={sceneImage} x={0} y={0} width={w} height={h} fit="cover">
          {passes.map((p) => (
            <RuntimeShader key={p.id} source={p.source} uniforms={p.uniforms} />
          ))}
        </Image>
      );
    }
    let shader: React.ReactElement = (
      <ImageShader
        image={sceneImage}
        fit="cover"
        rect={{ x: 0, y: 0, width: w, height: h }}
        tx="clamp"
        ty="clamp"
        sampling={LINEAR_SAMPLING}
      />
    );
    for (let i = 0; i <= last; i++) {
      const p = passes[i];
      if (p === undefined) continue;
      const samplers: React.ReactElement[] = [];
      for (let c = 0; c < p.children.length; c++) {
        samplers.push(
          <ImageShader
            key={c}
            image={p.children[c] ?? null}
            tx="clamp"
            ty="clamp"
            sampling={LINEAR_SAMPLING}
          />,
        );
      }
      shader = (
        <Shader source={p.source} uniforms={p.uniforms}>
          {shader}
          {samplers}
        </Shader>
      );
    }
    const filters: React.ReactElement[] = [];
    for (let i = last + 1; i < passes.length; i++) {
      const p = passes[i];
      if (p === undefined) continue;
      filters.push(<RuntimeShader key={p.id} source={p.source} uniforms={p.uniforms} />);
    }
    return (
      <Rect x={0} y={0} width={w} height={h}>
        {shader}
        {filters}
      </Rect>
    );
  }, [passes, viewportSize, sceneImage]);

  return (
    <SafeAreaContext.Provider value={resolvedSafeArea}>
      <GameContext.Provider value={ctx}>
        <View
          ref={containerRef}
          style={containerStyle}
          onLayout={handleLayout}
          onStartShouldSetResponder={returnTrue}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onRelease}
          onResponderTerminate={onRelease}
        >
          <Canvas
            key={canvasEpoch}
            ref={canvasRef as React.Ref<CanvasRef>}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            opaque={config?.opaque ?? false}
          >
            {canvasContent}
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

/** State updater for the `<Canvas>` key — module-level so a recovery allocates no closure. */
function nextEpoch(epoch: number): number {
  return epoch + 1;
}

/** Stable empty-chain reference — an empty `buildPostFxPasses` result collapses
 *  to this so the `passes` state never changes for a postfx-free GameView. */
const EMPTY_PASSES: readonly PostFxPassDescriptor[] = [];

/** Stable empty compiled-pass list handed to the web capture when no chain is bound. */
const EMPTY_COMPILED: readonly FrameRendererCompiledPass[] = Object.freeze([]);

/** Linear, mipmap-free sampling for every ImageShader in the pass chain — the
 *  options render-web hands makeShaderOptions, so both backends sample alike. */
const LINEAR_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

/** Index of the last pass carrying extra sampler children, or -1 when none does. */
function lastPassWithChildren(passes: readonly PostFxPassDescriptor[]): number {
  for (let i = passes.length - 1; i >= 0; i--) {
    const p = passes[i];
    if (p !== undefined && p.children.length > 0) return i;
  }
  return -1;
}

/** Fallback insets when no `<SafeAreaProvider>` ancestor supplies a context value. */
const ZERO_INSETS: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

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

/**
 * Value equality of two uniform maps. Walks the keys with `for…in` rather than
 * `Object.keys` so a per-frame comparison builds no key arrays.
 *
 * @internal Exported for tests only — not re-exported from the package index.
 */
export function sameUniforms(
  a: PostFxPassDescriptor['uniforms'],
  b: PostFxPassDescriptor['uniforms'],
): boolean {
  // Every key of `a` must hold an equal value in `b`; the count then rules out
  // keys only `b` has.
  let extra = 0;
  for (const _ in b) extra++;
  for (const key in a) {
    extra--;
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
  return extra === 0;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
