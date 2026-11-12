/**
 * Dev-flag access for the per-sprite transform counters below.
 *
 * Read as a PROPERTY of a stable object, never as the bare `__DEV__` identifier
 * behind a `typeof` guard. JSC has no inline cache for an unresolvable global
 * identifier, so that form costs ~270 ns *per evaluation* wherever the global
 * is undeclared — and this expression sits once per sprite per transform pass,
 * nine times over under an outline effect. A property miss on `globalThis` is
 * inline-cached at ~0.46 ns, ~400x cheaper, and stays togglable at runtime
 * exactly as before.
 *
 * (Phrased without the literal old expression on purpose: the dist canary in
 * `tests/frame-renderer-dist.test.ts` greps the built artifact as text, and a
 * comment quoting it would read as a reintroduction.)
 *
 * React Native always defines `__DEV__`, so RN builds never paid this; web /
 * CanvasKit and any Node or Bun consumer did. Measured B28, retired PERF-10:
 * `render.flush 1000 / 1 atlas` in the UNDECLARED configuration went 412-450 µs
 * before this change to 56-88 µs after — the same band the declared-false
 * configuration occupies, so the two are no longer distinguishable.
 *
 * Non-RN runtimes set `globalThis.__DEV__`, which is the contract api-specs
 * already documents for `isDevMode()`. Truthiness is deliberate: it matches the
 * previous guard for every possible value, so no consumer loses a dev check.
 */

import type { SkImageLike } from '@flare-engine/assets';
import { argbToFloat4Into } from '@flare-engine/math';
import type { CanvasLike } from './renderer.js';
import {
  CAVE_INTERIOR_SKSL,
  FIRE_SKSL,
  FOG_SKSL,
  FOREST_CANOPY_SKSL,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  RIVER_WAVE_SKSL,
  ROOFS_CITY_SKSL,
  WATER_SKSL,
} from './shaders.js';
import type { SpriteDrawCommand } from './sprite-batch.js';
import {
  type AnySpriteEffect,
  type CaveInteriorEffect,
  type CustomShaderEffect,
  type DropShadowEffect,
  type FireEffect,
  type FlashEffect,
  type FogEffect,
  type ForestCanopyEffect,
  flashIntensity,
  type GrayscaleEffect,
  type MoonCraterEffect,
  type MountainHillsEffect,
  type OutlineEffect,
  type RiverWaveEffect,
  type RoofsCityEffect,
  type SpriteColor,
  type TintEffect,
  type WaterEffect,
} from './sprite-effects.js';

/** See the dev-flag note at the top of this file. */
const G = globalThis as { __DEV__?: boolean };

// ---------------------------------------------------------------------------
// Structural interfaces — no @shopify/react-native-skia import anywhere here.
// ---------------------------------------------------------------------------

/**
 * A mutable axis-aligned rect.
 *
 * The `x`, `y`, `width`, `height` fields are required so that RN-Skia's
 * `SkHostRect` (which carries those fields) structurally satisfies this
 * interface in contra-variant parameter positions.
 */
export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
  setXYWH(x: number, y: number, w: number, h: number): void;
}

/**
 * A mutable similarity transform.
 *
 * The `scos`, `ssin`, `tx`, `ty` fields are readable so that CK-backed
 * canvas wrappers can flatten pools into Float32Arrays without allocation.
 * RN-Skia's `SkRSXform` exposes all four fields.
 */
export interface RSXformLike {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
  set(scos: number, ssin: number, tx: number, ty: number): void;
}

/** A compiled SkSL runtime effect. */
export interface RuntimeEffectLike {
  makeShader(uniforms: number[]): unknown;
  getUniformCount(): number;
  getUniformFloatCount(): number;
  getUniformName(index: number): string;
  getUniform(index: number): { columns: number; rows: number; slot: number };
}

/** Color filter factory — subset used by the frame-renderer. */
export interface ColorFilterFactoryLike {
  MakeBlend(color: Float32Array, mode: number): unknown;
  MakeMatrix(matrix: number[]): unknown;
}

/** Image filter factory — optional; absent on CPU/test surfaces. */
export interface ImageFilterFactoryLike {
  MakeDropShadow(
    dx: number,
    dy: number,
    sigmaX: number,
    sigmaY: number,
    color: Float32Array,
    input: null,
  ): unknown;
}

/** Runtime-effect factory — optional; absent when SkSL is unsupported. */
export interface RuntimeEffectFactoryLike {
  Make(sksl: string): RuntimeEffectLike | null;
}

/** Paint — the writable subset the frame-renderer mutates. */
export interface PaintLike {
  setAlphaf(alpha: number): void;
  setColor?(color: Float32Array): void;
  setColorFilter(filter: unknown): void;
  setShader(shader: unknown): void;
  setImageFilter(filter: unknown): void;
  /**
   * Set the Skia BlendMode on this paint.
   * Optional — absent on mocks and some test stubs; the renderer silently
   * falls back to SrcOver (the Skia default) when the method is missing.
   */
  setBlendMode?(mode: number): void;
}

/** Texture sampling mode for `FrameRenderer.setImageSampling`. */
export type ImageSampling = 'nearest' | 'linear';

/**
 * RN Skia's `FilterOptions` shape: `filter` is the FilterMode (0 = Nearest,
 * 1 = Linear), `mipmap` the MipmapMode (0 = None, 1 = Nearest, 2 = Linear).
 */
export interface SamplingOptionsLike {
  filter: number;
  mipmap?: number;
}

/** Minimal draw surface the frame-renderer calls into. */
export interface DrawSurfaceLike {
  save(): number;
  restore(): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy: number): void;
  /** rotate(degrees, cx, cy) — DEGREES, forwarded verbatim (both Skia backends take degrees). */
  rotate(degrees: number, cx: number, cy: number): void;
  clear(color: Float32Array): void;
  /**
   * `blendMode` and `colors` are positional placeholders in RN Skia's argument
   * order; the renderer never fills them. `sampling` is passed only for an
   * image with a `setImageSampling` setting — otherwise the call stops at `paint`.
   */
  drawAtlas(
    image: unknown,
    srcRects: RectLike[],
    dstXforms: RSXformLike[],
    paint: PaintLike,
    blendMode?: undefined,
    colors?: undefined,
    sampling?: SamplingOptionsLike,
  ): void;
  drawImageRect(image: unknown, src: RectLike, dst: RectLike, paint: PaintLike): void;
  /**
   * Sampled stretch/flip draw — `filterMode` and `mipmapMode` are the numeric
   * Skia enum values (see `SamplingOptionsLike`). `paint` is optional only to
   * mirror RN Skia's `paint?: SkPaint | null`; the renderer always passes one.
   * Optional — absent on some test stubs; when it is missing, a stretch draw
   * of an image with a sampling setting falls back to `drawImageRect`.
   */
  drawImageRectOptions?(
    image: unknown,
    src: RectLike,
    dst: RectLike,
    filterMode: number,
    mipmapMode: number,
    paint?: PaintLike | null,
  ): void;
  drawRect(rect: RectLike, paint: PaintLike): void;
}

/**
 * Opaque picture (recorded draw commands).
 * Typed as `object` so both `SkPicture` (RN-Skia) and CanvasKit's
 * `SkPicture` satisfy it without structural mismatches.
 * Callers that need concrete type methods cast to the platform type.
 */
export type PictureLike = object;

/** Picture recorder. */
export interface PictureRecorderLike {
  beginRecording(bounds: RectLike): DrawSurfaceLike;
  finishRecordingAsPicture(): PictureLike;
}

/**
 * Minimal structural view of the Skia module the frame-renderer needs.
 * Declared here so both `@flare-engine/react` and `@flare-engine/render-web`
 * can pass their respective backends without coupling to a concrete Skia SDK.
 *
 * The `Surface` and `ImageFilter` slots are optional because they are absent
 * on CPU surfaces and in test mocks.
 */
export interface FrameRendererModule {
  XYWHRect(x: number, y: number, w: number, h: number): RectLike;
  RSXform(scos: number, ssin: number, tx: number, ty: number): RSXformLike;
  Paint(): PaintLike;
  PictureRecorder(): PictureRecorderLike;
  ColorFilter: ColorFilterFactoryLike;
  RuntimeEffect?: RuntimeEffectFactoryLike;
  ImageFilter?: ImageFilterFactoryLike;
}

/**
 * A single compiled postfx pass descriptor produced by the runtime.
 */
export interface FrameRendererCompiledPass {
  readonly id: string;
  readonly shader: {
    makeShaderWithChildren(uniforms: Float32Array | number[], children: unknown[]): unknown | null;
    getUniformCount?(): number;
    getUniformName?(index: number): string;
    getUniform?(index: number): { columns: number; rows: number; slot: number };
  };
  readonly uniforms: Float32Array;
  readonly children: readonly unknown[];
}

/** Minimal structural view of a PostFxRuntime that the frame-renderer needs. */
export interface FrameRendererPostFxRuntime {
  readonly supported: boolean;
  buildPass?(
    chain: FrameRendererPostFxChain,
    width: number,
    height: number,
  ): readonly FrameRendererCompiledPass[];
}

/** Minimal structural view of an EffectChain the frame-renderer needs. */
export interface FrameRendererPostFxChain {
  enabled(): Iterable<unknown>;
}

/** A resolved postfx pass descriptor with named uniforms (for React JSX). */
export interface FrameRendererPostFxDescriptor {
  readonly id: string;
  readonly source: unknown;
  readonly uniforms: Record<string, number | readonly number[]>;
  readonly children: readonly unknown[];
}

/**
 * Frame renderer that bridges a `SpriteBatch` to a picture-backed draw surface.
 *
 * Each frame:
 *   1. Call `beginFrame(viewportWidth, viewportHeight)`.
 *   2. Call `drawAtlas(image, commands)` one or more times.
 *   3. Call `endFrame()` — returns the recorded picture. The caller owns it: draw it,
 *      then release it (CanvasKit: `delete()`). The renderer never frees it.
 */
export interface FrameRenderer {
  readonly canvas: CanvasLike;
  beginFrame(
    viewportWidth: number,
    viewportHeight: number,
    time?: number,
    pixelDensity?: number,
  ): void;
  drawAtlas(image: SkImageLike, commands: SpriteDrawCommand[]): void;
  /**
   * Set the texture sampling for every draw of `image` (an atlas or a texture)
   * on both the atlas path and the stretch/flip path. The last call wins. An
   * image with no setting keeps each path's own Skia default: linear on the
   * atlas path (`drawAtlas`), nearest on the stretch path (`drawImageRect`).
   * Throws `RangeError` for a mode other than `'nearest'` or `'linear'`.
   */
  setImageSampling(image: SkImageLike, sampling: ImageSampling): void;
  buildPostFxPasses(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
    width: number,
    height: number,
  ): readonly FrameRendererPostFxDescriptor[];
  /**
   * The compiled passes exactly as the runtime builds them — `uniforms` is the
   * packed Float32Array `makeShaderWithChildren` takes. `buildPostFxPasses`
   * derives its named JSX descriptors from these; an imperative compositor
   * (GameView's web path) draws from them directly. Same null/unsupported/
   * no-chain rules as `buildPostFxPasses` (empty array), same
   * `runtime ?? bound`, `chain ?? bound` resolution.
   */
  compilePostFxPasses(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
    width: number,
    height: number,
  ): readonly FrameRendererCompiledPass[];
  setPostFxBinding(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
  ): void;
  /**
   * Whether `buildPostFxPasses` would attempt to build passes from the bound
   * runtime and chain. Pure null/flag checks — never calls `runtime.buildPass`,
   * so it is safe on platforms where building throws (React Native Web).
   */
  hasPostFxBinding(): boolean;
  endFrame(): PictureLike | null;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** `SpriteDrawCommand.rotation` is radians; `DrawSurfaceLike.rotate` takes degrees. */
const RAD_TO_DEG = 180 / Math.PI;

const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;
/** Skia BlendMode.SrcATop — r = s·da + d·(1−sa): keeps the art's alpha, lerps colour by the filter's alpha. */
const BLEND_SRC_ATOP = 9;
/** Skia BlendMode.Plus — additive: dst = clamp(src + dst). */
const BLEND_PLUS = 12;

/** Effects drawn as a shader-filled rect; the sprite's atlas frame is only a carrier. */
type ZoneBgEffect =
  | RoofsCityEffect
  | ForestCanopyEffect
  | RiverWaveEffect
  | MoonCraterEffect
  | CaveInteriorEffect
  | MountainHillsEffect;

type ZoneBgType = ZoneBgEffect['type'];
type ZoneBgEffectByType = { [E in ZoneBgEffect as E['type']]: E };

interface ZoneBgDescriptor<E extends ZoneBgEffect> {
  readonly sksl: string;
  readonly uniformCount: number;
  /** Writes `effect` into `out`, slot for slot in the order `sksl` declares its uniforms. */
  readonly fill: (effect: E, out: number[]) => void;
}

/** The uniform layout all six zone-bg shaders share: resolution, two rgb colours, scroll, one scalar. */
function writeZoneBgUniforms(
  out: number[],
  resolutionW: number,
  resolutionH: number,
  colorA: SpriteColor,
  colorB: SpriteColor,
  scrollOffsetY: number,
  param: number,
): void {
  out[0] = resolutionW;
  out[1] = resolutionH;
  out[2] = colorA.r;
  out[3] = colorA.g;
  out[4] = colorA.b;
  out[5] = colorB.r;
  out[6] = colorB.g;
  out[7] = colorB.b;
  out[8] = scrollOffsetY;
  out[9] = param;
}

function fillRoofsCity(e: RoofsCityEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.skyColor,
    e.roofColor,
    e.scrollOffsetY,
    e.density,
  );
}

function fillForestCanopy(e: ForestCanopyEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.skyColor,
    e.leafColor,
    e.scrollOffsetY,
    e.density,
  );
}

function fillRiverWave(e: RiverWaveEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.waterColor,
    e.foamColor,
    e.scrollOffsetY,
    e.waveScale,
  );
}

function fillMoonCrater(e: MoonCraterEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.moonColor,
    e.craterColor,
    e.scrollOffsetY,
    e.craterCount,
  );
}

function fillCaveInterior(e: CaveInteriorEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.caveColor,
    e.glowColor,
    e.scrollOffsetY,
    e.stalactiteCount,
  );
}

function fillMountainHills(e: MountainHillsEffect, out: number[]): void {
  writeZoneBgUniforms(
    out,
    e.resolutionW,
    e.resolutionH,
    e.skyColor,
    e.hillColor,
    e.scrollOffsetY,
    e.ridgeScale,
  );
}

const ZONE_BG: { readonly [T in ZoneBgType]: ZoneBgDescriptor<ZoneBgEffectByType[T]> } = {
  'roofs-city': { sksl: ROOFS_CITY_SKSL, uniformCount: 10, fill: fillRoofsCity },
  'forest-canopy': { sksl: FOREST_CANOPY_SKSL, uniformCount: 10, fill: fillForestCanopy },
  'river-wave': { sksl: RIVER_WAVE_SKSL, uniformCount: 10, fill: fillRiverWave },
  'moon-crater': { sksl: MOON_CRATER_SKSL, uniformCount: 10, fill: fillMoonCrater },
  'cave-interior': { sksl: CAVE_INTERIOR_SKSL, uniformCount: 10, fill: fillCaveInterior },
  'mountain-hills': { sksl: MOUNTAIN_HILLS_SKSL, uniformCount: 10, fill: fillMountainHills },
};

function isZoneBgEffect(effect: AnySpriteEffect | undefined): effect is ZoneBgEffect {
  return effect !== undefined && effect.type in ZONE_BG;
}

/** Generic over the type so the descriptor and the effect are the same variant — no cast. */
function fillZoneBgUniforms<T extends ZoneBgType>(
  type: T,
  effect: ZoneBgEffectByType[T],
  out: number[],
): void {
  ZONE_BG[type].fill(effect, out);
}

/** What one renderer holds per zone-bg effect type: compiled lazily, then reused every frame. */
interface ZoneBgSlot {
  effect: RuntimeEffectLike | null;
  paint: PaintLike | null;
  readonly uniforms: number[];
}

function createZoneBgSlot(type: ZoneBgType): ZoneBgSlot {
  return {
    effect: null,
    paint: null,
    uniforms: new Array<number>(ZONE_BG[type].uniformCount).fill(0),
  };
}

/** One constant, so the per-frame `logOnce` lookup builds no string. */
const ZONE_BG_SKIPPED_MSG =
  'zone-bg run skipped: Skia.RuntimeEffect is absent or the shader failed to compile';

/** Shared empty result for `compilePostFxPasses`, so a chain-free frame allocates nothing. */
const EMPTY_COMPILED_PASSES: readonly FrameRendererCompiledPass[] = [];

/** The two sampling objects `setImageSampling` hands to the surface — shared, never rebuilt. */
const SAMPLING_NEAREST: SamplingOptionsLike = { filter: 0 };
const SAMPLING_LINEAR: SamplingOptionsLike = { filter: 1 };
/** Skia MipmapMode.None — the stretch path never mipmaps. */
const MIPMAP_NONE = 0;

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

let _xformUnrotatedCount = 0;
let _xformRotatedCount = 0;

const MAX_CACHED_RUN_LENGTH = 256;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a `FrameRenderer` backed by the given structural Skia module.
 *
 * Both `@flare-engine/react` (passing the real RN-Skia module) and
 * `@flare-engine/render-web` (passing a CanvasKit shim) use this factory.
 */
export function createFrameRenderer(Skia: FrameRendererModule): FrameRenderer {
  const defaultPaint: PaintLike = Skia.Paint();

  let tintPaint: PaintLike | null = null;
  let flashPaint: PaintLike | null = null;
  let grayscalePaint: PaintLike | null = null;
  let outlinePaint: PaintLike | null = null;
  let customPaint: PaintLike | null = null;
  let waterPaint: PaintLike | null = null;
  let waterRuntimeEffect: RuntimeEffectLike | null = null;
  let fogPaint: PaintLike | null = null;
  let fogRuntimeEffect: RuntimeEffectLike | null = null;
  let firePaint: PaintLike | null = null;
  let fireRuntimeEffect: RuntimeEffectLike | null = null;
  let dropShadowPaint: PaintLike | null = null;

  const zoneBgSlots: { readonly [T in ZoneBgType]: ZoneBgSlot } = {
    'roofs-city': createZoneBgSlot('roofs-city'),
    'forest-canopy': createZoneBgSlot('forest-canopy'),
    'river-wave': createZoneBgSlot('river-wave'),
    'moon-crater': createZoneBgSlot('moon-crater'),
    'cave-interior': createZoneBgSlot('cave-interior'),
    'mountain-hills': createZoneBgSlot('mountain-hills'),
  };

  const recorder: PictureRecorderLike = Skia.PictureRecorder();
  const recordingBounds: RectLike = Skia.XYWHRect(0, 0, 0, 0);

  const srcRects: RectLike[] = [];
  const xforms: RSXformLike[] = [];

  const stretchSrcRects: RectLike[] = [];
  const stretchDstRects: RectLike[] = [];
  let stretchPaint: PaintLike | null = null;

  const zoneBgRects: RectLike[] = [];

  const imageSampling = new WeakMap<SkImageLike, SamplingOptionsLike>();

  // Indexed by run length, for runs up to MAX_CACHED_RUN_LENGTH. Entries are
  // always real copies, never the pool array itself: an aliased entry would
  // lengthen when the pool grows. Growth only appends and the pooled elements
  // are mutated in place, so a copy stays valid for the lifetime of the
  // renderer. Longer runs share one last-length slot each, because a slice per
  // length would retain memory quadratic in the longest run.
  const srcSlices: (RectLike[] | undefined)[] = [];
  const xformSlices: (RSXformLike[] | undefined)[] = [];
  let longSrcSlice: RectLike[] | null = null;
  let longXformSlice: RSXformLike[] | null = null;

  const clearColor: Float32Array = new Float32Array(4);
  const tintColor: Float32Array = new Float32Array(4);
  const flashColor: Float32Array = new Float32Array(4);
  const outlineColor: Float32Array = new Float32Array(4);
  const dropShadowColor: Float32Array = new Float32Array(4);

  const grayMatrix: number[] = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const customUniforms: number[] = [];

  const waterUniforms: number[] = new Array(11).fill(0);
  const fogUniforms: number[] = new Array(9).fill(0);
  const fireUniforms: number[] = new Array(11).fill(0);

  let currentFrameTime = 0;
  let currentSpriteW = 0;
  let currentSpriteH = 0;
  let current: DrawSurfaceLike | null = null;

  let _boundRuntime: FrameRendererPostFxRuntime | null = null;
  let _boundChain: FrameRendererPostFxChain | null = null;

  const _loggedOnce = new Set<string>();
  function logOnce(msg: string): void {
    if (_loggedOnce.has(msg)) return;
    _loggedOnce.add(msg);
    console.warn(`[postfx] ${msg}`);
  }

  function compilePostFxPasses(
    runtime: FrameRendererPostFxRuntime | null,
    chain: FrameRendererPostFxChain | null,
    width: number,
    height: number,
  ): readonly FrameRendererCompiledPass[] {
    const rt = runtime ?? _boundRuntime;
    const ch = chain ?? _boundChain;
    if (rt === null || !rt.supported) return EMPTY_COMPILED_PASSES;
    if (rt.buildPass === undefined) {
      logOnce('buildPostFxPasses: runtime.supported but buildPass absent — no passes');
      return EMPTY_COMPILED_PASSES;
    }
    if (ch === null) return EMPTY_COMPILED_PASSES;
    return rt.buildPass(ch, width, height);
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
    rotate: (degrees, cx, cy) => {
      current?.rotate(degrees, cx, cy);
    },
    clear: (argb) => {
      if (current === null) return;
      argbToFloat4Into(clearColor, argb);
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

  function ensureZoneBgPoolCapacity(n: number): void {
    while (zoneBgRects.length < n) {
      zoneBgRects.push(Skia.XYWHRect(0, 0, 0, 0));
    }
  }

  function getCachedSrcSlice(n: number): RectLike[] {
    if (n > MAX_CACHED_RUN_LENGTH) {
      if (longSrcSlice === null || longSrcSlice.length !== n) longSrcSlice = srcRects.slice(0, n);
      return longSrcSlice;
    }
    let slice = srcSlices[n];
    if (slice === undefined) {
      slice = srcRects.slice(0, n);
      srcSlices[n] = slice;
    }
    return slice;
  }

  function getCachedXformSlice(n: number): RSXformLike[] {
    if (n > MAX_CACHED_RUN_LENGTH) {
      if (longXformSlice === null || longXformSlice.length !== n)
        longXformSlice = xforms.slice(0, n);
      return longXformSlice;
    }
    let slice = xformSlices[n];
    if (slice === undefined) {
      slice = xforms.slice(0, n);
      xformSlices[n] = slice;
    }
    return slice;
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
        xforms[i]?.set(scale, 0, cmd.dstX + dx, cmd.dstY + dy);
        if (G.__DEV__) _xformUnrotatedCount++;
      } else {
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
        if (G.__DEV__) _xformRotatedCount++;
      }
    }
  }

  function applyTint(effect: TintEffect): PaintLike {
    if (tintPaint === null) tintPaint = Skia.Paint();
    writeColor(tintColor, effect.color, effect.amount);
    tintPaint.setColorFilter(Skia.ColorFilter.MakeBlend(tintColor, BLEND_SRC_ATOP));
    return tintPaint;
  }

  function applyFlash(effect: FlashEffect): PaintLike {
    if (flashPaint === null) flashPaint = Skia.Paint();
    writeColor(flashColor, effect.color, flashIntensity(effect));
    flashPaint.setColorFilter(Skia.ColorFilter.MakeBlend(flashColor, BLEND_SRC_ATOP));
    return flashPaint;
  }

  function applyGrayscale(effect: GrayscaleEffect): PaintLike {
    if (grayscalePaint === null) grayscalePaint = Skia.Paint();
    writeGrayscaleMatrix(grayMatrix, effect.amount);
    grayscalePaint.setColorFilter(Skia.ColorFilter.MakeMatrix(grayMatrix));
    return grayscalePaint;
  }

  function applyOutlinePaint(effect: OutlineEffect): PaintLike {
    if (outlinePaint === null) outlinePaint = Skia.Paint();
    writeColor(outlineColor, effect.color, 1);
    outlinePaint.setColorFilter(Skia.ColorFilter.MakeBlend(outlineColor, BLEND_SRC_IN));
    return outlinePaint;
  }

  function applyCustom(effect: CustomShaderEffect): PaintLike {
    if (customPaint === null) customPaint = Skia.Paint();
    const shader = effect.shader as RuntimeEffectLike;
    const layout = customUniformLayout(shader);
    const floatCount = layout.floatCount;
    while (customUniforms.length < floatCount) customUniforms.push(0);
    customUniforms.length = floatCount;
    fillCustomUniforms(effect, layout, customUniforms);
    customPaint.setShader(shader.makeShader(customUniforms));
    return customPaint;
  }

  function applyWater(effect: WaterEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (waterRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(WATER_SKSL);
      if (compiled === null) return defaultPaint;
      waterRuntimeEffect = compiled;
    }
    if (waterPaint === null) waterPaint = Skia.Paint();
    waterUniforms[0] = currentSpriteW;
    waterUniforms[1] = currentSpriteH;
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

  function applyFog(effect: FogEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fogRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FOG_SKSL);
      if (compiled === null) return defaultPaint;
      fogRuntimeEffect = compiled;
    }
    if (fogPaint === null) fogPaint = Skia.Paint();
    fogUniforms[0] = currentSpriteW;
    fogUniforms[1] = currentSpriteH;
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

  function applyFire(effect: FireEffect, time: number): PaintLike {
    if (Skia.RuntimeEffect === undefined) return defaultPaint;
    if (fireRuntimeEffect === null) {
      const compiled = Skia.RuntimeEffect.Make(FIRE_SKSL);
      if (compiled === null) return defaultPaint;
      fireRuntimeEffect = compiled;
    }
    if (firePaint === null) firePaint = Skia.Paint();
    fireUniforms[0] = currentSpriteW;
    fireUniforms[1] = currentSpriteH;
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

  function applyDropShadow(effect: DropShadowEffect): PaintLike {
    if (Skia.ImageFilter === undefined) return defaultPaint;
    if (dropShadowPaint === null) dropShadowPaint = Skia.Paint();
    writeColor(dropShadowColor, effect.color, 1);
    dropShadowPaint.setImageFilter(
      Skia.ImageFilter.MakeDropShadow(
        effect.offsetX,
        effect.offsetY,
        effect.blur,
        effect.blur,
        dropShadowColor,
        null,
      ),
    );
    return dropShadowPaint;
  }

  /**
   * `null` when the effect's shader is not compiled — the caller skips the run,
   * which is never drawn black. A failed compile is retried on the next run.
   */
  function applyZoneBg(effect: ZoneBgEffect): PaintLike | null {
    const slot = zoneBgSlots[effect.type];
    if (slot.effect === null) {
      const compiled = Skia.RuntimeEffect?.Make(ZONE_BG[effect.type].sksl) ?? null;
      if (compiled === null) {
        logOnce(ZONE_BG_SKIPPED_MSG);
        return null;
      }
      slot.effect = compiled;
    }
    if (slot.paint === null) slot.paint = Skia.Paint();
    fillZoneBgUniforms(effect.type, effect, slot.uniforms);
    slot.paint.setShader(slot.effect.makeShader(slot.uniforms));
    return slot.paint;
  }

  function drawOutlined(
    cvs: DrawSurfaceLike,
    image: unknown,
    commands: SpriteDrawCommand[],
    n: number,
    effect: OutlineEffect,
    alpha: number,
    sampling: SamplingOptionsLike | undefined,
  ): void {
    const paint = applyOutlinePaint(effect);
    paint.setAlphaf(alpha);
    const srcs = getCachedSrcSlice(n);
    for (let k = 0; k < OUTLINE_OFFSETS.length; k++) {
      const offset = OUTLINE_OFFSETS[k] as readonly [number, number];
      fillXforms(commands, n, offset[0] * effect.width, offset[1] * effect.width);
      const dsts = getCachedXformSlice(n);
      drawAtlasSampled(cvs, image, srcs, dsts, paint, sampling);
    }
    paint.setAlphaf(1);
    defaultPaint.setAlphaf(alpha);
    fillXforms(commands, n, 0, 0);
    const mainDsts = getCachedXformSlice(n);
    drawAtlasSampled(cvs, image, srcs, mainDsts, defaultPaint, sampling);
    defaultPaint.setAlphaf(1);
  }

  function resolveEffectPaint(effect: Exclude<AnySpriteEffect, ZoneBgEffect>): PaintLike {
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
      case 'drop-shadow':
        return applyDropShadow(effect);
      case 'outline':
        return applyOutlinePaint(effect);
    }
  }

  return {
    canvas,

    beginFrame(viewportWidth, viewportHeight, time = 0, pixelDensity = 1): void {
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

      const cmd0 = commands[0] as SpriteDrawCommand;
      const effect = cmd0.effect;
      const alpha = cmd0.alpha;
      const blendAdditive = cmd0.blend === 'additive';
      const flipX = cmd0.flipX;
      const flipY = cmd0.flipY;
      const sampling = imageSampling.get(image);
      currentSpriteW = cmd0.dstW;
      currentSpriteH = cmd0.dstH;

      if (isZoneBgEffect(effect)) {
        const paint = applyZoneBg(effect);
        if (paint === null) return;
        if (blendAdditive) paint.setBlendMode?.(BLEND_PLUS);
        paint.setAlphaf(alpha);
        ensureZoneBgPoolCapacity(n);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          zoneBgRects[i]!.setXYWH(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          current.drawRect(zoneBgRects[i]!, paint);
        }
        paint.setAlphaf(1);
        if (blendAdditive) paint.setBlendMode?.(BLEND_SRC_OVER);
        return;
      }

      if (cmd0.stretch || flipX || flipY) {
        ensureStretchPoolCapacity(n);
        if (stretchPaint === null) stretchPaint = Skia.Paint();
        const sp = stretchPaint;
        // outline requires two passes (SRC_IN silhouette + source) which is
        // incompatible with the single-drawImageRect stretch path; fall back
        // to alpha-only. Also fall back when flip+outline is combined.
        const sPaint =
          effect === undefined || effect.type === 'outline' ? sp : resolveEffectPaint(effect);
        if (blendAdditive) sPaint.setBlendMode?.(BLEND_PLUS);
        sPaint.setAlphaf(alpha);
        for (let i = 0; i < n; i++) {
          const cmd = commands[i] as SpriteDrawCommand;
          const srcR = stretchSrcRects[i]!;
          const dstR = stretchDstRects[i]!;
          srcR.setXYWH(cmd.srcX, cmd.srcY, cmd.srcW, cmd.srcH);
          dstR.setXYWH(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
          if (cmd.flipX || cmd.flipY) {
            const cx = cmd.dstX + cmd.dstW * 0.5;
            const cy = cmd.dstY + cmd.dstH * 0.5;
            current.save();
            // Canvas ops apply to geometry in reverse call order: the rect is
            // mirrored about its centre first, then turned about the anchor
            // pivot — the same pivot the atlas path rotates about.
            if (cmd.rotation !== 0) {
              current.rotate(
                cmd.rotation * RAD_TO_DEG,
                cmd.dstX + cmd.anchorX * cmd.dstW,
                cmd.dstY + cmd.anchorY * cmd.dstH,
              );
            }
            current.translate(cx, cy);
            current.scale(cmd.flipX ? -1 : 1, cmd.flipY ? -1 : 1);
            current.translate(-cx, -cy);
            drawImageRectSampled(current, image, srcR, dstR, sPaint, sampling);
            current.restore();
          } else {
            drawImageRectSampled(current, image, srcR, dstR, sPaint, sampling);
          }
        }
        sPaint.setAlphaf(1);
        if (blendAdditive) sPaint.setBlendMode?.(BLEND_SRC_OVER);
        return;
      }

      ensurePoolCapacity(n);
      fillSrcRects(commands, n);

      if (effect?.type === 'outline') {
        if (blendAdditive) {
          outlinePaint?.setBlendMode?.(BLEND_PLUS);
          defaultPaint.setBlendMode?.(BLEND_PLUS);
        }
        drawOutlined(current, image, commands, n, effect, alpha, sampling);
        if (blendAdditive) {
          outlinePaint?.setBlendMode?.(BLEND_SRC_OVER);
          defaultPaint.setBlendMode?.(BLEND_SRC_OVER);
        }
        return;
      }

      fillXforms(commands, n, 0, 0);
      const srcs = getCachedSrcSlice(n);
      const dsts = getCachedXformSlice(n);
      const paint = effect === undefined ? defaultPaint : resolveEffectPaint(effect);
      if (blendAdditive) paint.setBlendMode?.(BLEND_PLUS);
      paint.setAlphaf(alpha);
      drawAtlasSampled(current, image, srcs, dsts, paint, sampling);
      paint.setAlphaf(1);
      if (blendAdditive) paint.setBlendMode?.(BLEND_SRC_OVER);
    },

    setImageSampling(image, sampling): void {
      if (sampling === 'nearest') {
        imageSampling.set(image, SAMPLING_NEAREST);
      } else if (sampling === 'linear') {
        imageSampling.set(image, SAMPLING_LINEAR);
      } else {
        throw new RangeError(
          `setImageSampling: unknown sampling '${String(sampling)}' (expected 'nearest' or 'linear')`,
        );
      }
    },

    setPostFxBinding(runtime, chain): void {
      _boundRuntime = runtime;
      _boundChain = chain;
    },

    hasPostFxBinding(): boolean {
      return (
        _boundRuntime !== null &&
        !!_boundRuntime.supported &&
        _boundRuntime.buildPass !== undefined &&
        _boundChain !== null
      );
    },

    compilePostFxPasses,

    buildPostFxPasses(runtime, chain, width, height): readonly FrameRendererPostFxDescriptor[] {
      const passes = compilePostFxPasses(runtime, chain, width, height);
      if (passes.length === 0) return [];
      const out: FrameRendererPostFxDescriptor[] = [];
      for (const pass of passes) {
        const shader = pass.shader;
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
          children: pass.children,
        });
      }
      return out;
    },

    endFrame(): PictureLike | null {
      if (current === null) return null;
      current = null;
      return recorder.finishRecordingAsPicture();
    },
  };
}

// ---------------------------------------------------------------------------
// Xform branch counters — observable surface for bench/diagnostic use
// ---------------------------------------------------------------------------

/** Zero both branch counters unconditionally (no __DEV__ guard). */
export function resetXformCounters(): void {
  _xformUnrotatedCount = 0;
  _xformRotatedCount = 0;
}

/**
 * Cumulative `fillXforms` branch hit counts since the last reset. Both stay 0
 * when `__DEV__` is falsy or absent.
 *
 * These count transform WRITES, not sprites: a run drawn with an outline effect
 * passes through `fillXforms` 9 times (8 offset passes + 1 main pass), so it
 * contributes 9 hits per command — the transform work the renderer actually
 * performs. The counters are process-global: every `createFrameRenderer`
 * instance increments the same pair, so readings sum across live renderers.
 *
 * Allocates one object per call — never call it from the render loop.
 */
export function getXformCounters(): { rotated: number; unrotated: number } {
  return { rotated: _xformRotatedCount, unrotated: _xformUnrotatedCount };
}

// ---------------------------------------------------------------------------
// Private helpers (module-private, not exported)
// ---------------------------------------------------------------------------

/** Without a sampling setting this is exactly the 4-argument call the surface always received. */
function drawAtlasSampled(
  cvs: DrawSurfaceLike,
  image: unknown,
  srcs: RectLike[],
  dsts: RSXformLike[],
  paint: PaintLike,
  sampling: SamplingOptionsLike | undefined,
): void {
  if (sampling === undefined) {
    cvs.drawAtlas(image, srcs, dsts, paint);
  } else {
    cvs.drawAtlas(image, srcs, dsts, paint, undefined, undefined, sampling);
  }
}

function drawImageRectSampled(
  cvs: DrawSurfaceLike,
  image: unknown,
  src: RectLike,
  dst: RectLike,
  paint: PaintLike,
  sampling: SamplingOptionsLike | undefined,
): void {
  if (sampling === undefined || cvs.drawImageRectOptions === undefined) {
    cvs.drawImageRect(image, src, dst, paint);
  } else {
    cvs.drawImageRectOptions(image, src, dst, sampling.filter, MIPMAP_NONE, paint);
  }
}

function writeColor(out: Float32Array, color: SpriteColor, alphaMul: number): void {
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
  out[0] = inv + lr;
  out[1] = lg;
  out[2] = lb;
  out[3] = 0;
  out[4] = 0;
  out[5] = lr;
  out[6] = inv + lg;
  out[7] = lb;
  out[8] = 0;
  out[9] = 0;
  out[10] = lr;
  out[11] = lg;
  out[12] = inv + lb;
  out[13] = 0;
  out[14] = 0;
  out[15] = 0;
  out[16] = 0;
  out[17] = 0;
  out[18] = 1;
  out[19] = 0;
}

interface CustomUniformLayout {
  names: string[];
  slots: Int32Array;
  sizes: Int32Array;
  floatCount: number;
}

// A compiled shader's uniform layout is fixed, so it is reflected once per shader.
const customUniformLayouts = new WeakMap<RuntimeEffectLike, CustomUniformLayout>();

function customUniformLayout(shader: RuntimeEffectLike): CustomUniformLayout {
  let layout = customUniformLayouts.get(shader);
  if (layout !== undefined) return layout;
  const count = shader.getUniformCount();
  const names: string[] = [];
  const slots = new Int32Array(count);
  const sizes = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const info = shader.getUniform(i);
    names.push(shader.getUniformName(i));
    slots[i] = info.slot;
    sizes[i] = info.columns * info.rows;
  }
  layout = { names, slots, sizes, floatCount: shader.getUniformFloatCount() };
  customUniformLayouts.set(shader, layout);
  return layout;
}

function fillCustomUniforms(
  effect: CustomShaderEffect,
  layout: CustomUniformLayout,
  out: number[],
): void {
  const { names, slots, sizes } = layout;
  for (let i = 0; i < out.length; i++) out[i] = 0;
  for (let i = 0; i < names.length; i++) {
    const value = effect.uniforms[names[i] as string];
    if (value === undefined) continue;
    const slot = slots[i] as number;
    if (typeof value === 'number') {
      out[slot] = value;
      continue;
    }
    const size = sizes[i] as number;
    for (let k = 0; k < size; k++) {
      out[slot + k] = value[k] ?? 0;
    }
  }
}
