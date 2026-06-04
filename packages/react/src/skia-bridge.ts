import type { SkImageLike } from '@flare-engine/assets';
import {
  type AnySpriteEffect,
  CAVE_INTERIOR_SKSL,
  type CanvasLike,
  type CaveInteriorEffect,
  type CustomShaderEffect,
  FIRE_SKSL,
  FOG_SKSL,
  FOREST_CANOPY_SKSL,
  type FireEffect,
  type FlashEffect,
  type FogEffect,
  type ForestCanopyEffect,
  type GrayscaleEffect,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  type MoonCraterEffect,
  type MountainHillsEffect,
  type OutlineEffect,
  RIVER_WAVE_SKSL,
  ROOFS_CITY_SKSL,
  type RiverWaveEffect,
  type RoofsCityEffect,
  type SpriteColor,
  type SpriteDrawCommand,
  type TintEffect,
  WATER_SKSL,
  type WaterEffect,
  flashIntensity,
} from '@flare-engine/render';
import type {
  SkCanvas,
  SkColor,
  SkHostRect,
  SkImage,
  SkPaint,
  SkPicture,
  SkPictureRecorder,
  SkRSXform,
  SkRuntimeEffect,
  Skia,
} from '@shopify/react-native-skia';

/** Structural canvas — minimal subset needed for offscreen rendering. */
export interface SkOffscreenCanvasLike {
  drawPicture(picture: unknown): void;
  drawImageRect(image: unknown, src: unknown, dst: unknown, paint: unknown): void;
  drawRect(rect: unknown, paint: unknown): void;
  clear(color: unknown): void;
}

/** Structural canvas surface — minimal subset needed for offscreen capture. */
export interface SkSurfaceLike {
  getCanvas(): SkOffscreenCanvasLike;
  makeImageSnapshot(): SkImageLike;
  /** Force queued draws to execute. Required for GPU-backed surfaces before
   *  makeImageSnapshot is called, otherwise the snapshot may capture
   *  uninitialized texture content. See Skia's SkSurface.flush docs. */
  flush(): void;
}

/**
 * A single post-processing pass descriptor built by `buildPostFxPasses`.
 * GameView maps each descriptor to a `<RuntimeShader>` child of `<Image>`.
 */
export interface PostFxPassDescriptor {
  /** Stable id, used as React key. */
  readonly id: string;
  /** The compiled SkRuntimeEffect passed as `<RuntimeShader source={…}/>`. */
  readonly source: SkRuntimeEffect;
  /**
   * Uniform map keyed by SkSL uniform name. Vector uniforms are `number[]`
   * whose length equals `columns * rows`; scalar uniforms are `number`.
   * Built by zipping `shader.getUniformName(i)` → sliced Float32Array values.
   */
  readonly uniforms: Record<string, number | readonly number[]>;
  /**
   * Extra child shader slots beyond the implicit scene sampler. Empty for every
   * built-in PT effect; only color-grading-lut would populate it. Each entry
   * is an SkImage that GameView wraps in `<ImageShader>`.
   */
  readonly children: readonly SkImage[];
}

/**
 * Take a snapshot of `surface` and detach it from the GPU context so it can
 * be safely sampled from a different GrDirectContext (e.g. the on-screen
 * Canvas).  RN-Skia's MakeOffscreen allocates a private Gr context per
 * surface; without this step Skia silently renders black when the texture is
 * read from any other context.
 *
 * Calls `makeNonTextureImage()` when available (RN-Skia ≥ 0.1 on device).
 * Falls back to the raw snapshot when the method is absent (CPU surfaces,
 * test mocks) — no behavioural change in those paths.
 */
function detachSnapshot(surface: SkSurfaceLike): SkImageLike {
  const snap = surface.makeImageSnapshot();
  if (typeof snap.makeNonTextureImage === 'function') {
    return snap.makeNonTextureImage();
  }
  return snap;
}

/** A single axis-aligned rectangle shape to draw into an offscreen surface. */
export interface ShapeRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** ARGB packed integer: 0xAARRGGBB */
  readonly color: number;
}

/** Options for `renderShapesToImage`. */
export interface RenderShapesOpts {
  readonly width: number;
  readonly height: number;
  /** ARGB packed integer: 0xAARRGGBB */
  readonly clearColor: number;
  readonly shapes: readonly ShapeRect[];
}

/**
 * Narrow view of the Skia module — only the factories the bridge needs.
 * Declared as its own type so tests can pass a plain mock without pulling
 * in the full `@shopify/react-native-skia` surface.
 */
export type SkiaModuleLike = Pick<
  typeof Skia,
  'XYWHRect' | 'RSXform' | 'Paint' | 'PictureRecorder' | 'ColorFilter'
> & {
  RuntimeEffect?: { Make(sksl: string): SkRuntimeEffect | null };
  Surface?: {
    Make(width: number, height: number): SkSurfaceLike | null;
    MakeOffscreen?(width: number, height: number): SkSurfaceLike | null;
  };
};

/**
 * A single compiled postfx pass descriptor produced by the runtime.
 * The bridge owns the actual rendering; the runtime just produces these.
 */
export interface CompiledPassLike {
  readonly id: string;
  readonly shader: {
    makeShaderWithChildren(uniforms: number[], children: unknown[]): unknown | null;
    /** Required for buildPostFxPasses uniform-name mapping. */
    getUniformCount?(): number;
    getUniformName?(index: number): string;
    getUniform?(index: number): { columns: number; rows: number; slot: number };
  };
  readonly uniforms: Float32Array;
  readonly children: readonly unknown[];
}

/**
 * Minimal structural view of a PostFxRuntime that the bridge needs.
 * Declared locally so `@flare-engine/react` does not take a hard dep on
 * `@flare-engine/postfx`; interfaces are compatible structurally.
 *
 * Runtimes that expose `buildPass` are fully managed by the bridge via the
 * JSX `<Image><RuntimeShader/></Image>` chain in GameView.
 */
export interface PostFxRuntimeLike {
  readonly supported: boolean;
  buildPass?(chain: PostFxChainLike, width: number, height: number): readonly CompiledPassLike[];
}

/** Minimal structural view of an EffectChain the bridge needs. */
export interface PostFxChainLike {
  enabled(): Iterable<unknown>;
}

/**
 * Frame renderer that bridges a `SpriteBatch` to a Skia `<Picture>`.
 *
 * Each frame:
 *   1. Call `beginFrame(viewportWidth, viewportHeight)` — opens a fresh
 *      picture recording bounded to the viewport. If either dimension is 0
 *      (layout not yet resolved) the call is a no-op and `endFrame` returns
 *      null for that frame.
 *   2. Call `drawAtlas(image, commands)` one or more times (typically via
 *      `batch.flush(bridge.drawAtlas, renderer)`).
 *   3. Call `endFrame()` — returns the recorded `SkPicture` to hand to a
 *      `<Picture>` component inside a `<Canvas>`.
 *
 * The `canvas` field is a `CanvasLike` adapter the frame owner installs on
 * the `Renderer` via `renderer.setCanvas(bridge.canvas)`. It forwards to
 * the live recording canvas between `beginFrame` and `endFrame`, and is a
 * no-op otherwise.
 */
export interface SkiaFrameRenderer {
  readonly canvas: CanvasLike;
  /**
   * Open a fresh picture recording for this frame.
   * @param viewportWidth  Logical viewport width (CSS pixels).
   * @param viewportHeight Logical viewport height (CSS pixels).
   * @param time           Frame timestamp in seconds (default 0).
   * @param pixelDensity   Logical→physical recording scale (default 1). When
   *                       > 1 the recording bounds are expanded to physical
   *                       resolution and a matching scale() is baked in so
   *                       `usePictureAsTexture` fills a physical-size backing.
   */
  beginFrame(
    viewportWidth: number,
    viewportHeight: number,
    time?: number,
    pixelDensity?: number,
  ): void;
  /**
   * drawAtlas callback compatible with `SpriteBatch.flush`. Accepts
   * `SkImageLike` (the narrow `@flare-engine/assets` type used by the batch) and
   * upcasts to a full Skia `SkImage` at the boundary — in practice callers
   * always supply a real `SkImage`.
   */
  drawAtlas(image: SkImageLike, commands: SpriteDrawCommand[]): void;

  /**
   * Build the list of postfx pass descriptors for this frame. Called by
   * GameView AFTER endFrame() (picture is final) and BEFORE Canvas commits.
   * Returns an empty array when runtime is null, unsupported, has no buildPass,
   * or the chain has no enabled effects.
   *
   * Uniforms are keyed by SkSL uniform NAME via shader.getUniformName(i).
   * Vector uniforms (columns*rows > 1) become readonly number[].
   */
  buildPostFxPasses(
    runtime: PostFxRuntimeLike | null,
    chain: PostFxChainLike | null,
    width: number,
    height: number,
  ): readonly PostFxPassDescriptor[];

  /**
   * Publish a (runtime, chain) pair for this frame. Called by the
   * onRenderPostFx hook so GameView can drive buildPostFxPasses after
   * endFrame without changing the PostFxRenderHook signature.
   */
  setPostFxBinding(runtime: PostFxRuntimeLike | null, chain: PostFxChainLike | null): void;

  endFrame(): SkPicture | null;
}

// Skia BlendMode enum values inlined to avoid a runtime dependency on the
// Skia module for a few numeric constants. Stable ABI — see
// @shopify/react-native-skia/.../Paint/BlendMode.ts.
const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;

// 8-direction outline offsets (cardinal + diagonal). Diagonal offsets are
// scaled by 1/√2 so all 8 passes lie on a circle of radius `width`.
const OUTLINE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

/**
 * Create a `SkiaFrameRenderer`.
 *
 * `Skia` is passed in (rather than imported) so unit tests can supply a
 * mock. Production code constructs this once inside `<GameView>` using the
 * real `Skia` import from `@shopify/react-native-skia`.
 */
export function createSkiaFrameRenderer(Skia: SkiaModuleLike): SkiaFrameRenderer {
  // Default paint used when a batch has no effect. All effect paints are
  // allocated lazily on first use and then mutated in place — the pool is
  // grow-only and reaches a stable max size after the first frame that
  // uses each effect type.
  const defaultPaint: SkPaint = Skia.Paint();

  let tintPaint: SkPaint | null = null;
  let flashPaint: SkPaint | null = null;
  let grayscalePaint: SkPaint | null = null;
  let outlinePaint: SkPaint | null = null;
  let customPaint: SkPaint | null = null;
  let waterPaint: SkPaint | null = null;
  let waterRuntimeEffect: SkRuntimeEffect | null = null;
  let fogPaint: SkPaint | null = null;
  let fogRuntimeEffect: SkRuntimeEffect | null = null;
  let firePaint: SkPaint | null = null;
  let fireRuntimeEffect: SkRuntimeEffect | null = null;

  // Zone-background shader state — one runtime effect + paint per effect type.
  // Compiled lazily on first use; reused every frame thereafter.
  let roofsCityPaint: SkPaint | null = null;
  let roofsCityEffect: SkRuntimeEffect | null = null;
  let forestCanopyPaint: SkPaint | null = null;
  let forestCanopyEffect: SkRuntimeEffect | null = null;
  let riverWavePaint: SkPaint | null = null;
  let riverWaveEffect: SkRuntimeEffect | null = null;
  let moonCraterPaint: SkPaint | null = null;
  let moonCraterEffect: SkRuntimeEffect | null = null;
  let caveInteriorPaint: SkPaint | null = null;
  let caveInteriorEffect: SkRuntimeEffect | null = null;
  let mountainHillsPaint: SkPaint | null = null;
  let mountainHillsEffect: SkRuntimeEffect | null = null;

  // Pre-allocated uniform buffers for zone-bg shaders.
  // ROOFS_CITY:    [resW, resH, skyR, skyG, skyB, roofR, roofG, roofB, scrollOffsetY, density]
  const roofsCityUniforms: number[] = new Array(10).fill(0);
  // FOREST_CANOPY: [resW, resH, skyR, skyG, skyB, leafR, leafG, leafB, scrollOffsetY, density]
  const forestCanopyUniforms: number[] = new Array(10).fill(0);
  // RIVER_WAVE:    [resW, resH, waterR, waterG, waterB, foamR, foamG, foamB, scrollOffsetY, waveScale]
  const riverWaveUniforms: number[] = new Array(10).fill(0);
  // MOON_CRATER:   [resW, resH, moonR, moonG, moonB, craterR, craterG, craterB, scrollOffsetY, craterCount]
  const moonCraterUniforms: number[] = new Array(10).fill(0);
  // CAVE_INTERIOR: [resW, resH, caveR, caveG, caveB, glowR, glowG, glowB, scrollOffsetY, stalactiteCount]
  const caveInteriorUniforms: number[] = new Array(10).fill(0);
  // MOUNTAIN_HILLS:[resW, resH, skyR, skyG, skyB, hillR, hillG, hillB, scrollOffsetY, ridgeScale]
  const mountainHillsUniforms: number[] = new Array(10).fill(0);

  // Reused across frames via beginRecording / finishRecording cycles.
  const recorder: SkPictureRecorder = Skia.PictureRecorder();

  // Pre-allocated bounds rect — mutated in place each frame so beginFrame
  // adds zero heap allocation on the hot path.
  const recordingBounds: SkHostRect = Skia.XYWHRect(0, 0, 0, 0);

  // Pools grow only — match createRenderSystem's entries policy
  // (packages/render/src/render-system.ts). SkHostRect / SkRSXform expose
  // setXYWH / set mutators so steady state is truly zero-alloc once the
  // pools reach max-seen sprite count.
  const srcRects: SkHostRect[] = [];
  const xforms: SkRSXform[] = [];

  // Separate rect pools for the stretch (drawImageRect) path.
  // Grow-only, reach steady state after the first frame with N stretch sprites.
  const stretchSrcRects: SkHostRect[] = [];
  const stretchDstRects: SkHostRect[] = [];

  // Pre-allocated paint for stretch draws. Allocated once on first stretch call.
  let stretchPaint: SkPaint | null = null;

  // Reused SkColor (Float32Array) buffer for clear() — ARGB int is unpacked
  // into this slot once per frame, not per call-site.
  const clearColor: SkColor = new Float32Array(4);

  // Scratch color buffers used to build SkColor arguments for
  // ColorFilter.MakeBlend without allocating a fresh Float32Array each call.
  const tintColor: SkColor = new Float32Array(4);
  const flashColor: SkColor = new Float32Array(4);
  const outlineColor: SkColor = new Float32Array(4);

  // Grayscale color matrix (4x5 row-major, length 20). The constant entries
  // are written once here; `writeGrayscaleMatrix` only mutates the rgb
  // weights each call.
  const grayMatrix: number[] = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

  // Flat uniform buffer for custom shaders. Grown on demand to match the
  // current shader's `getUniformFloatCount()`.
  const customUniforms: number[] = [];

  // Pre-allocated 11-float uniform buffer for the water effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     foamColor.r, foamColor.g, foamColor.b,
  //                     waveSpeed, waveAmplitude, time]
  const waterUniforms: number[] = new Array(11).fill(0);

  // Pre-allocated 9-float uniform buffer for the fog effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     density, speed, scale, time]
  const fogUniforms: number[] = new Array(9).fill(0);

  // Pre-allocated 11-float uniform buffer for the fire effect.
  // Declaration order: [resW, resH, color.r, color.g, color.b,
  //                     tipColor.r, tipColor.g, tipColor.b,
  //                     speed, intensity, time]
  const fireUniforms: number[] = new Array(11).fill(0);

  let currentFrameTime = 0;
  let current: SkCanvas | null = null;

  // PostFx binding published by setPostFxBinding each frame.
  // GameView reads these after endFrame to drive buildPostFxPasses.
  let _boundRuntime: PostFxRuntimeLike | null = null;
  let _boundChain: PostFxChainLike | null = null;

  // Diagnostic log dedup — each unique message logged at most once per renderer lifetime.
  const _loggedOnce = new Set<string>();
  function logOnce(msg: string): void {
    if (_loggedOnce.has(msg)) return;
    _loggedOnce.add(msg);
    console.warn(`[postfx] ${msg}`);
  }

  const canvas: CanvasLike = {
    save: () => current?.save() ?? 0,
    restore: () => {
      current?.restore();
    },
    translate: (x, y) => {
      current?.translate(x, y);
    },
    scale: (sx, sy) => {
      current?.scale(sx, sy);
    },
    rotate: (radians, cx, cy) => {
      current?.rotate(radians, cx, cy);
    },
    clear: (argb) => {
      if (current === null) return;
      clearColor[0] = ((argb >>> 16) & 0xff) / 255;
      clearColor[1] = ((argb >>> 8) & 0xff) / 255;
      clearColor[2] = (argb & 0xff) / 255;
      clearColor[3] = ((argb >>> 24) & 0xff) / 255;
      current.clear(clearColor);
    },
  };

  function ensurePoolCapacity(n: number): void {
    while (srcRects.length < n) {
      srcRects.push(Skia.XYWHRect(0, 0, 0, 0));
      xforms.push(Skia.RSXform(1, 0, 0, 0));
    }
  }

  function ensureStretchPoolCapacity(n: number): void {
    while (stretchSrcRects.length < n) {
      stretchSrcRects.push(Skia.XYWHRect(0, 0, 0, 0));
      stretchDstRects.push(Skia.XYWHRect(0, 0, 0, 0));
    }
  }

  function fillSrcRects(commands: SpriteDrawCommand[], n: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      srcRects[i]?.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
    }
  }

  function fillXforms(commands: SpriteDrawCommand[], n: number, dx: number, dy: number): void {
    for (let i = 0; i < n; i++) {
      const cmd = commands[i] as SpriteDrawCommand;
      const scale = cmd.srcW === 0 ? 1 : cmd.dstW / cmd.srcW;
      if (cmd.rotation === 0) {
        // Fast path — no trig. At θ=0: scos=scale, ssin=0, tx=dstX+dx, ty=dstY+dy.
        xforms[i]?.set(scale, 0, cmd.dstX + dx, cmd.dstY + dy);
      } else {
        // Rotation about the anchor point in world space.
        // Algebraic check at θ=0: tx = px - scale·anchorX·srcW
        //   = (dstX + anchorX·dstW) - anchorX·(scale·srcW)
        //   = dstX + anchorX·dstW - anchorX·dstW = dstX. ✓
        const c = Math.cos(cmd.rotation);
        const s = Math.sin(cmd.rotation);
        const scos = scale * c;
        const ssin = scale * s;
        const px = cmd.dstX + cmd.anchorX * cmd.dstW + dx;
        const py = cmd.dstY + cmd.anchorY * cmd.dstH + dy;
        const axSrc = cmd.anchorX * cmd.srcW;
        const aySrc = cmd.anchorY * cmd.srcH;
        xforms[i]?.set(
          scos,
          ssin,
          px - scos * axSrc + ssin * aySrc,
          py - ssin * axSrc - scos * aySrc,
        );
      }
    }
  }

  function applyTint(effect: TintEffect): SkPaint {
    if (tintPaint === null) tintPaint = Skia.Paint();
    writeColor(tintColor, effect.color, effect.amount);
    tintPaint.setColorFilter(Skia.ColorFilter.MakeBlend(tintColor, BLEND_SRC_OVER));
    return tintPaint;
  }

  function applyFlash(effect: FlashEffect): SkPaint {
    if (flashPaint === null) flashPaint = Skia.Paint();
    writeColor(flashColor, effect.color, flashIntensity(effect));
    flashPaint.setColorFilter(Skia.ColorFilter.MakeBlend(flashColor, BLEND_SRC_OVER));
    return flashPaint;
  }

  function applyGrayscale(effect: GrayscaleEffect): SkPaint {
    if (grayscalePaint === null) grayscalePaint = Skia.Paint();
    writeGrayscaleMatrix(grayMatrix, effect.amount);
    grayscalePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(grayMatrix));
    return grayscalePaint;
  }

  function applyOutlinePaint(effect: OutlineEffect): SkPaint {
    if (outlinePaint === null) outlinePaint = Skia.Paint();
    writeColor(outlineColor, effect.color, 1);
    outlinePaint.setColorFilter(Skia.ColorFilter.MakeBlend(outlineColor, BLEND_SRC_IN));
    return outlinePaint;
  }

  function applyCustom(effect: CustomShaderEffect): SkPaint {
    if (customPaint === null) customPaint = Skia.Paint();
    const shader = effect.shader as SkRuntimeEffect;
    const floatCount = shader.getUniformFloatCount();
    while (customUniforms.length < floatCount) customUniforms.push(0);
    customUniforms.length = floatCount;
    fillCustomUniforms(effect, shader, customUniforms);
    customPaint.setShader(shader.makeShader(customUniforms));
    return customPaint;
  }

  function applyWater(effect: WaterEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (waterRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(WATER_SKSL);
      if (compiled === null) return defaultPaint;
      waterRuntimeEffect = compiled;
    }
    if (waterPaint === null) waterPaint = Skia.Paint();
    waterUniforms[0] = 0; // resW — caller fills via drawAtlas; width is not available here,
    waterUniforms[1] = 0; // resH   so resolution slots are zeroed; SkSL can guard divide-by-zero
    waterUniforms[2] = effect.color.r;
    waterUniforms[3] = effect.color.g;
    waterUniforms[4] = effect.color.b;
    waterUniforms[5] = effect.foamColor.r;
    waterUniforms[6] = effect.foamColor.g;
    waterUniforms[7] = effect.foamColor.b;
    waterUniforms[8] = effect.waveSpeed;
    waterUniforms[9] = effect.waveAmplitude;
    waterUniforms[10] = time;
    waterPaint.setShader(waterRuntimeEffect.makeShader(waterUniforms));
    return waterPaint;
  }

  function applyFog(effect: FogEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fogRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOG_SKSL);
      if (compiled === null) return defaultPaint;
      fogRuntimeEffect = compiled;
    }
    if (fogPaint === null) fogPaint = Skia.Paint();
    fogUniforms[0] = 0;
    fogUniforms[1] = 0;
    fogUniforms[2] = effect.color.r;
    fogUniforms[3] = effect.color.g;
    fogUniforms[4] = effect.color.b;
    fogUniforms[5] = effect.density;
    fogUniforms[6] = effect.speed;
    fogUniforms[7] = effect.scale;
    fogUniforms[8] = time;
    fogPaint.setShader(fogRuntimeEffect.makeShader(fogUniforms));
    return fogPaint;
  }

  function applyFire(effect: FireEffect, time: number): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fireRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FIRE_SKSL);
      if (compiled === null) return defaultPaint;
      fireRuntimeEffect = compiled;
    }
    if (firePaint === null) firePaint = Skia.Paint();
    // Layout: [resW, resH, color.r, color.g, color.b,
    //          tipColor.r, tipColor.g, tipColor.b, speed, intensity, time]
    fireUniforms[0] = 0;
    fireUniforms[1] = 0;
    fireUniforms[2] = effect.color.r;
    fireUniforms[3] = effect.color.g;
    fireUniforms[4] = effect.color.b;
    fireUniforms[5] = effect.tipColor.r;
    fireUniforms[6] = effect.tipColor.g;
    fireUniforms[7] = effect.tipColor.b;
    fireUniforms[8] = effect.speed;
    fireUniforms[9] = effect.intensity;
    fireUniforms[10] = time;
    firePaint.setShader(fireRuntimeEffect.makeShader(fireUniforms));
    return firePaint;
  }

  function applyRoofsCity(effect: RoofsCityEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (roofsCityEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(ROOFS_CITY_SKSL);
      if (compiled === null) return defaultPaint;
      roofsCityEffect = compiled;
    }
    if (roofsCityPaint === null) roofsCityPaint = Skia.Paint();
    roofsCityUniforms[0] = effect.resolutionW;
    roofsCityUniforms[1] = effect.resolutionH;
    roofsCityUniforms[2] = effect.skyColor.r;
    roofsCityUniforms[3] = effect.skyColor.g;
    roofsCityUniforms[4] = effect.skyColor.b;
    roofsCityUniforms[5] = effect.roofColor.r;
    roofsCityUniforms[6] = effect.roofColor.g;
    roofsCityUniforms[7] = effect.roofColor.b;
    roofsCityUniforms[8] = effect.scrollOffsetY;
    roofsCityUniforms[9] = effect.density;
    roofsCityPaint.setShader(roofsCityEffect.makeShader(roofsCityUniforms));
    return roofsCityPaint;
  }

  function applyForestCanopy(effect: ForestCanopyEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (forestCanopyEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOREST_CANOPY_SKSL);
      if (compiled === null) return defaultPaint;
      forestCanopyEffect = compiled;
    }
    if (forestCanopyPaint === null) forestCanopyPaint = Skia.Paint();
    forestCanopyUniforms[0] = effect.resolutionW;
    forestCanopyUniforms[1] = effect.resolutionH;
    forestCanopyUniforms[2] = effect.skyColor.r;
    forestCanopyUniforms[3] = effect.skyColor.g;
    forestCanopyUniforms[4] = effect.skyColor.b;
    forestCanopyUniforms[5] = effect.leafColor.r;
    forestCanopyUniforms[6] = effect.leafColor.g;
    forestCanopyUniforms[7] = effect.leafColor.b;
    forestCanopyUniforms[8] = effect.scrollOffsetY;
    forestCanopyUniforms[9] = effect.density;
    forestCanopyPaint.setShader(forestCanopyEffect.makeShader(forestCanopyUniforms));
    return forestCanopyPaint;
  }

  function applyRiverWave(effect: RiverWaveEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (riverWaveEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(RIVER_WAVE_SKSL);
      if (compiled === null) return defaultPaint;
      riverWaveEffect = compiled;
    }
    if (riverWavePaint === null) riverWavePaint = Skia.Paint();
    riverWaveUniforms[0] = effect.resolutionW;
    riverWaveUniforms[1] = effect.resolutionH;
    riverWaveUniforms[2] = effect.waterColor.r;
    riverWaveUniforms[3] = effect.waterColor.g;
    riverWaveUniforms[4] = effect.waterColor.b;
    riverWaveUniforms[5] = effect.foamColor.r;
    riverWaveUniforms[6] = effect.foamColor.g;
    riverWaveUniforms[7] = effect.foamColor.b;
    riverWaveUniforms[8] = effect.scrollOffsetY;
    riverWaveUniforms[9] = effect.waveScale;
    riverWavePaint.setShader(riverWaveEffect.makeShader(riverWaveUniforms));
    return riverWavePaint;
  }

  function applyMoonCrater(effect: MoonCraterEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (moonCraterEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(MOON_CRATER_SKSL);
      if (compiled === null) return defaultPaint;
      moonCraterEffect = compiled;
    }
    if (moonCraterPaint === null) moonCraterPaint = Skia.Paint();
    moonCraterUniforms[0] = effect.resolutionW;
    moonCraterUniforms[1] = effect.resolutionH;
    moonCraterUniforms[2] = effect.moonColor.r;
    moonCraterUniforms[3] = effect.moonColor.g;
    moonCraterUniforms[4] = effect.moonColor.b;
    moonCraterUniforms[5] = effect.craterColor.r;
    moonCraterUniforms[6] = effect.craterColor.g;
    moonCraterUniforms[7] = effect.craterColor.b;
    moonCraterUniforms[8] = effect.scrollOffsetY;
    moonCraterUniforms[9] = effect.craterCount;
    moonCraterPaint.setShader(moonCraterEffect.makeShader(moonCraterUniforms));
    return moonCraterPaint;
  }

  function applyCaveInterior(effect: CaveInteriorEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (caveInteriorEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(CAVE_INTERIOR_SKSL);
      if (compiled === null) return defaultPaint;
      caveInteriorEffect = compiled;
    }
    if (caveInteriorPaint === null) caveInteriorPaint = Skia.Paint();
    caveInteriorUniforms[0] = effect.resolutionW;
    caveInteriorUniforms[1] = effect.resolutionH;
    caveInteriorUniforms[2] = effect.caveColor.r;
    caveInteriorUniforms[3] = effect.caveColor.g;
    caveInteriorUniforms[4] = effect.caveColor.b;
    caveInteriorUniforms[5] = effect.glowColor.r;
    caveInteriorUniforms[6] = effect.glowColor.g;
    caveInteriorUniforms[7] = effect.glowColor.b;
    caveInteriorUniforms[8] = effect.scrollOffsetY;
    caveInteriorUniforms[9] = effect.stalactiteCount;
    caveInteriorPaint.setShader(caveInteriorEffect.makeShader(caveInteriorUniforms));
    return caveInteriorPaint;
  }

  function applyMountainHills(effect: MountainHillsEffect): SkPaint {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (mountainHillsEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(MOUNTAIN_HILLS_SKSL);
      if (compiled === null) return defaultPaint;
      mountainHillsEffect = compiled;
    }
    if (mountainHillsPaint === null) mountainHillsPaint = Skia.Paint();
    mountainHillsUniforms[0] = effect.resolutionW;
    mountainHillsUniforms[1] = effect.resolutionH;
    mountainHillsUniforms[2] = effect.skyColor.r;
    mountainHillsUniforms[3] = effect.skyColor.g;
    mountainHillsUniforms[4] = effect.skyColor.b;
    mountainHillsUniforms[5] = effect.hillColor.r;
    mountainHillsUniforms[6] = effect.hillColor.g;
    mountainHillsUniforms[7] = effect.hillColor.b;
    mountainHillsUniforms[8] = effect.scrollOffsetY;
    mountainHillsUniforms[9] = effect.ridgeScale;
    mountainHillsPaint.setShader(mountainHillsEffect.makeShader(mountainHillsUniforms));
    return mountainHillsPaint;
  }

  function drawOutlined(
    canvas: SkCanvas,
    image: SkImage,
    commands: SpriteDrawCommand[],
    n: number,
    effect: OutlineEffect,
    alpha: number,
  ): void {
    const paint = applyOutlinePaint(effect);
    paint.setAlphaf(alpha);
    const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
    for (let k = 0; k < OUTLINE_OFFSETS.length; k++) {
      const offset = OUTLINE_OFFSETS[k] as readonly [number, number];
      fillXforms(commands, n, offset[0] * effect.width, offset[1] * effect.width);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      canvas.drawAtlas(image, srcs, dsts, paint);
    }
    paint.setAlphaf(1);
    // Main pass with original positions and the default (unfiltered) paint.
    defaultPaint.setAlphaf(alpha);
    fillXforms(commands, n, 0, 0);
    const mainDsts = xforms.length === n ? xforms : xforms.slice(0, n);
    canvas.drawAtlas(image, srcs, mainDsts, defaultPaint);
    defaultPaint.setAlphaf(1);
  }

  function resolveEffectPaint(effect: AnySpriteEffect): SkPaint {
    switch (effect.type) {
      case 'tint':
        return applyTint(effect);
      case 'flash':
        return applyFlash(effect);
      case 'grayscale':
        return applyGrayscale(effect);
      case 'custom':
        return applyCustom(effect);
      case 'water':
        return applyWater(effect, currentFrameTime);
      case 'fog':
        return applyFog(effect, currentFrameTime);
      case 'fire':
        return applyFire(effect, currentFrameTime);
      case 'outline':
        // Outline is drawn via a multi-pass path; this branch is only reached
        // if a caller bypasses `drawOutlined`. Return the outline paint so
        // the single-pass drawAtlas still renders something visible.
        return applyOutlinePaint(effect);
      case 'roofs-city':
        return applyRoofsCity(effect);
      case 'forest-canopy':
        return applyForestCanopy(effect);
      case 'river-wave':
        return applyRiverWave(effect);
      case 'moon-crater':
        return applyMoonCrater(effect);
      case 'cave-interior':
        return applyCaveInterior(effect);
      case 'mountain-hills':
        return applyMountainHills(effect);
    }
  }

  return {
    canvas,

    beginFrame(viewportWidth: number, viewportHeight: number, time = 0, pixelDensity = 1): void {
      if (viewportWidth === 0 || viewportHeight === 0) return;
      _boundRuntime = null;
      _boundChain = null;
      currentFrameTime = time;
      const pd = pixelDensity;
      recordingBounds.setXYWH(0, 0, viewportWidth * pd, viewportHeight * pd);
      current = recorder.beginRecording(recordingBounds);
      if (pd !== 1) current.scale(pd, pd);
    },

    drawAtlas(image, commands): void {
      if (current === null) return;
      const n = commands.length;
      if (n === 0) return;

      const effect = commands[0]?.effect;
      const alpha = commands[0]?.alpha ?? 1;
      const skImage = image as SkImage;

      // Zone-background effects are procedural fullscreen shaders. They must be
      // drawn via drawRect (not drawAtlas) because:
      //   1. RSXform only encodes uniform scale — a 32×32 atlas frame stretched
      //      to 360×640 renders as 360×360 (a square), clipping 45% of height.
      //   2. The shaders don't sample the atlas at all (no `uniform shader src`);
      //      they produce the entire pixel value from SkSL uniforms.
      // Each command is an independent drawRect call — these BG entities are
      // never batched with regular sprites (different effect identity).
      if (
        effect?.type === 'roofs-city' ||
        effect?.type === 'forest-canopy' ||
        effect?.type === 'river-wave' ||
        effect?.type === 'moon-crater' ||
        effect?.type === 'cave-interior' ||
        effect?.type === 'mountain-hills'
      ) {
        const paint = resolveEffectPaint(effect);
        paint.setAlphaf(alpha);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          const rect = Skia.XYWHRect(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          current.drawRect(rect, paint);
        }
        paint.setAlphaf(1);
        return;
      }

      // Stretch path — non-uniform scale via drawImageRect. Each command with
      // stretch=true is an independent call so dstW and dstH are both honored
      // regardless of the src aspect ratio.
      // Rotation is unsupported in stretch mode (axis-aligned rect only).
      if (commands[0]?.stretch) {
        if (stretchPaint === null) stretchPaint = Skia.Paint();
        ensureStretchPoolCapacity(n);
        stretchPaint.setAlphaf(alpha);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          // ensureStretchPoolCapacity(n) guarantees index i exists.
          const srcR = stretchSrcRects[i]!;
          const dstR = stretchDstRects[i]!;
          srcR.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
          dstR.setXYWH(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          current.drawImageRect(skImage, srcR, dstR, stretchPaint);
        }
        stretchPaint.setAlphaf(1);
        return;
      }

      ensurePoolCapacity(n);
      fillSrcRects(commands, n);

      if (effect?.type === 'outline') {
        drawOutlined(current, skImage, commands, n, effect, alpha);
        return;
      }

      fillXforms(commands, n, 0, 0);
      const srcs = srcRects.length === n ? srcRects : srcRects.slice(0, n);
      const dsts = xforms.length === n ? xforms : xforms.slice(0, n);
      const paint = effect === undefined ? defaultPaint : resolveEffectPaint(effect);
      paint.setAlphaf(alpha);
      current.drawAtlas(skImage, srcs, dsts, paint);
      paint.setAlphaf(1);
    },

    setPostFxBinding(runtime, chain): void {
      _boundRuntime = runtime;
      _boundChain = chain;
    },

    buildPostFxPasses(runtime, chain, width, height): readonly PostFxPassDescriptor[] {
      const rt = runtime ?? _boundRuntime;
      const ch = chain ?? _boundChain;
      if (rt === null || !rt.supported) return [];
      if (rt.buildPass === undefined) {
        logOnce('buildPostFxPasses: runtime.supported but buildPass absent — no passes');
        return [];
      }
      if (ch === null) return [];
      const passes = rt.buildPass(ch, width, height);
      if (passes.length === 0) return [];
      const out: PostFxPassDescriptor[] = [];
      for (const pass of passes) {
        const shader = pass.shader as SkRuntimeEffect;
        const uniformCount =
          typeof shader.getUniformCount === 'function' ? shader.getUniformCount() : 0;
        const uniforms: Record<string, number | readonly number[]> = {};
        for (let i = 0; i < uniformCount; i++) {
          const name =
            typeof shader.getUniformName === 'function' ? shader.getUniformName(i) : String(i);
          const info =
            typeof shader.getUniform === 'function'
              ? shader.getUniform(i)
              : { columns: 1, rows: 1, slot: i };
          const size = info.columns * info.rows;
          if (size === 1) {
            uniforms[name] = pass.uniforms[info.slot] ?? 0;
          } else {
            const vec: number[] = [];
            for (let k = 0; k < size; k++) {
              vec.push(pass.uniforms[info.slot + k] ?? 0);
            }
            uniforms[name] = vec;
          }
        }
        out.push({
          id: pass.id,
          source: shader,
          uniforms,
          children: pass.children as readonly SkImage[],
        });
      }
      return out;
    },

    endFrame(): SkPicture | null {
      if (current === null) return null;
      current = null;
      return recorder.finishRecordingAsPicture();
    },
  };
}

// Scratch buffer for ARGB → RGBA-float unpacking in renderShapesToImage.
// Allocated once per call (not module-level) so concurrent callers are safe.
// Hot paths inside createSkiaFrameRenderer use their own pre-allocated buffers.

/**
 * Render a list of solid rectangles into a fresh offscreen surface and return
 * the resulting image snapshot. Returns `null` if `Surface` factory is absent or
 * fails. The surface is not cached — callers that need reuse should cache the
 * returned image themselves.
 */
export function renderShapesToImage(
  skia: SkiaModuleLike,
  opts: RenderShapesOpts,
): SkImageLike | null {
  if (skia.Surface === undefined) return null;
  const surface = skia.Surface.Make(opts.width, opts.height);
  if (surface === null) return null;

  const scratch = new Float32Array(4);
  const canvas = surface.getCanvas();

  unpackArgb(scratch, opts.clearColor);
  canvas.clear(scratch);

  const paint = skia.Paint();
  for (const shape of opts.shapes) {
    unpackArgb(scratch, shape.color);
    paint.setColor(scratch);
    const rect = skia.XYWHRect(shape.x, shape.y, shape.w, shape.h);
    canvas.drawRect(rect, paint);
  }

  return detachSnapshot(surface);
}

/** Unpack a 0xAARRGGBB integer into a Float32Array [r, g, b, a] in 0..1 range. */
function unpackArgb(out: Float32Array, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}

function writeColor(out: SkColor, color: SpriteColor, alphaMul: number): void {
  out[0] = color.r;
  out[1] = color.g;
  out[2] = color.b;
  out[3] = color.a * alphaMul;
}

function writeGrayscaleMatrix(out: number[], amount: number): void {
  const inv = 1 - amount;
  const lr = 0.299 * amount;
  const lg = 0.587 * amount;
  const lb = 0.114 * amount;
  // Row 0: R channel
  out[0] = inv + lr;
  out[1] = lg;
  out[2] = lb;
  out[3] = 0;
  out[4] = 0;
  // Row 1: G channel
  out[5] = lr;
  out[6] = inv + lg;
  out[7] = lb;
  out[8] = 0;
  out[9] = 0;
  // Row 2: B channel
  out[10] = lr;
  out[11] = lg;
  out[12] = inv + lb;
  out[13] = 0;
  out[14] = 0;
  // Row 3: A channel (pass-through) — written once at init and never
  // changes, but re-asserted here so callers don't need to trust the
  // constructor layout.
  out[15] = 0;
  out[16] = 0;
  out[17] = 0;
  out[18] = 1;
  out[19] = 0;
}

function fillCustomUniforms(
  effect: CustomShaderEffect,
  shader: SkRuntimeEffect,
  out: number[],
): void {
  const count = shader.getUniformCount();
  for (let i = 0; i < out.length; i++) out[i] = 0;
  for (let i = 0; i < count; i++) {
    const info = shader.getUniform(i);
    const name = shader.getUniformName(i);
    const value = effect.uniforms[name];
    const size = info.columns * info.rows;
    if (value === undefined) continue;
    if (typeof value === 'number') {
      out[info.slot] = value;
      continue;
    }
    for (let k = 0; k < size; k++) {
      out[info.slot + k] = value[k] ?? 0;
    }
  }
}
