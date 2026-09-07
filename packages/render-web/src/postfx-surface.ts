import {
  type CompiledPass,
  createPostFxRuntime,
  type EffectChain,
  type SkiaPostFxModuleLike,
} from '@flare-engine/postfx';
import type {
  CanvasKit,
  Canvas as CKCanvas,
  GrDirectContext,
  Shader,
  Surface,
  WebGLContextHandle,
} from 'canvaskit-wasm';

/**
 * A CanvasKit-backed render surface with a parameterized postfx chain.
 *
 * Manages an offscreen scene surface and an on-screen surface, owns the WebGL
 * `GrDirectContext`, handles context loss/restore, and composites the scene
 * through a caller-supplied effect chain each frame.
 *
 * Usage:
 *   const chain = new EffectChain();
 *   chain.add(createBloom('bloom', { threshold: 0.5, intensity: 0.9 }));
 *   const surface = createPostFxSurface(kit, canvas, chain);
 */
export interface PostFxSurface {
  /** Current backing-store width (device px), floored. */
  readonly width: number;
  /** Current backing-store height (device px), floored. */
  readonly height: number;
  /** The offscreen scene canvas — draw the scene here each frame. Null while the context is lost. */
  sceneCanvas(): CKCanvas | null;
  /** The on-screen canvas — draw crisp overlays here AFTER composite(). Null while lost. */
  onscreenCanvas(): CKCanvas | null;
  /** Hard-clear the scene to an opaque background (call once after create + after resize). */
  clear(bgRgb: readonly number[]): void;
  /** Motion-blur trail: fade the previous scene frame toward bg instead of clearing. */
  fadeTrail(bgRgb: readonly number[], alpha: number): void;
  /**
   * Snapshot the scene, run the chain, composite to screen. The pass runs at the
   * chain's own `globalIntensity` (so an a11y `setMotionScale` holds frame to
   * frame); pass a value only to write a new global intensity into the chain.
   */
  composite(globalIntensity?: number): void;
  /** Flush the on-screen surface (after drawing crisp overlays). */
  flush(): void;
  /** Resize the canvas backing store + offscreen surfaces (does NOT clear — call clear() after). */
  resize(width: number, height: number): void;
  /** True while the WebGL context is lost or GPU surfaces could not be allocated. */
  isLost(): boolean;
  dispose(): void;
}

/**
 * Create a `PostFxSurface` backed by a WebGL CanvasKit context.
 *
 * Returns `null` when WebGL is unavailable.
 *
 * @param kit    Loaded CanvasKit instance.
 * @param canvas Target `<canvas>` element.
 * @param chain  Effect chain to apply at composite time.
 *               Pass a new empty `EffectChain()` for a passthrough surface.
 */
export function createPostFxSurface(
  kit: CanvasKit,
  canvas: HTMLCanvasElement,
  chain: EffectChain,
): PostFxSurface | null {
  const clampDim = (v: number): number => {
    const n = Math.floor(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  let w = clampDim(canvas.width);
  let h = clampDim(canvas.height);
  // Retained so a future context-restore handler can re-clear to the last background.
  // A private zero-alloc buffer copied INTO on each clear — never aliases the caller's
  // array, so mutating that array later can't retroactively change what gets replayed.
  const lastBg = new Float32Array(3);

  const info = () => ({
    width: w,
    height: h,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Premul,
    colorSpace: kit.ColorSpace.SRGB,
  });

  let ctxHandle: WebGLContextHandle = 0;
  let grContext: GrDirectContext | null = null;
  let onscreen: Surface | null = null;
  let scene: Surface | null = null;
  let pong: Surface | null = null;
  let lost = false;

  // Frees every GPU object. Null-safe: runs on partial construction and on every restore.
  const disposeGpu = (): void => {
    scene?.delete();
    pong?.delete();
    onscreen?.delete();
    grContext?.delete();
    if (ctxHandle) kit.deleteContext(ctxHandle);
    scene = null;
    pong = null;
    onscreen = null;
    grContext = null;
    ctxHandle = 0;
  };

  // (Re)creates context + surfaces on the current canvas at w×h. False if the GPU cannot.
  const buildGpu = (): boolean => {
    ctxHandle = kit.GetWebGLContext(canvas);
    if (!ctxHandle) return false;
    grContext = kit.MakeWebGLContext(ctxHandle);
    if (!grContext) {
      kit.deleteContext(ctxHandle);
      ctxHandle = 0;
      return false;
    }
    onscreen = kit.MakeOnScreenGLSurface(grContext, w, h, kit.ColorSpace.SRGB);
    scene = onscreen?.makeSurface(info()) ?? null;
    pong = onscreen?.makeSurface(info()) ?? null;
    if (!onscreen || !scene || !pong) {
      disposeGpu();
      return false;
    }
    return true;
  };

  if (!buildGpu()) {
    disposeGpu();
    return null;
  }

  const clearScene = (bgRgb: ArrayLike<number>): void => {
    // Copy (not alias) — the restore path replays this later, when the caller's own
    // array may hold different values. Keep recording even while lost, so a clear
    // issued during a loss is honoured on restore.
    lastBg[0] = bgRgb[0] ?? 0;
    lastBg[1] = bgRgb[1] ?? 0;
    lastBg[2] = bgRgb[2] ?? 0;
    if (lost) return; // never touch GPU objects while the context is dead
    const sc = scene?.getCanvas();
    if (!sc) return;
    sc.clear(kit.Color4f(lastBg[0], lastBg[1], lastBg[2], 1));
    scene?.flush();
  };

  // preventDefault() keeps the context restorable; `lost` gates every draw op so nothing touches a
  // dead context. On restore, rebuild on the same canvas and re-clear to the retained background.
  const onContextLost = (e: Event): void => {
    e.preventDefault();
    lost = true;
  };
  const onContextRestored = (): void => {
    disposeGpu();
    lost = !buildGpu();
    if (!lost) clearScene(lastBg);
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  const fade = new kit.Paint();
  const fx = new kit.Paint();
  // Full-frame replace-blit: never composite stale pong content from a previous pass.
  fx.setBlendMode(kit.BlendMode.Src);
  const scratch = new Float32Array(4);
  const rectScratch = new Float32Array(4);

  // Reused children array — resized in place per pass (src + any extra sampler
  // children) so no shader-children array is allocated in the composite loop.
  const childrenBuf: unknown[] = [null];

  // Build a minimal SkiaPostFxModuleLike shim that routes to CanvasKit's RuntimeEffect.
  const skia: SkiaPostFxModuleLike = {
    RuntimeEffect: {
      Make(sksl) {
        const eff = kit.RuntimeEffect.Make(sksl);
        if (!eff) return null;
        return {
          makeShaderWithChildren: (uniforms, children) =>
            eff.makeShaderWithChildren(uniforms as Float32Array, (children ?? []) as Shader[]),
        };
      },
    },
  };
  const runtime = createPostFxRuntime(skia);

  function blit(img: import('canvaskit-wasm').Image): void {
    if (lost || !onscreen) return;
    const passes: readonly CompiledPass[] = runtime.supported ? runtime.buildPass(chain, w, h) : [];
    if (passes.length === 0) {
      onscreen.getCanvas().drawImage(img, 0, 0);
      onscreen.flush();
      return;
    }
    let src: import('canvaskit-wasm').Image = img;
    const last = passes.length - 1;
    rectScratch[0] = 0;
    rectScratch[1] = 0;
    rectScratch[2] = w;
    rectScratch[3] = h;
    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];
      if (!pass) continue;
      const toScreen = i === last;
      const target = toScreen ? onscreen : pong;
      if (!target) break;
      const srcShader = src.makeShaderOptions(
        kit.TileMode.Clamp,
        kit.TileMode.Clamp,
        kit.FilterMode.Linear,
        kit.MipmapMode.None,
      );
      // src is child 0; Convention-A extra sampler children (pass.children,
      // which EXCLUDES src — e.g. the color-grading-lut LUT image) follow in
      // SkSL declaration order (src=0, lut=1), each wrapped as a shader. The
      // reused childrenBuf is re-sized in place (no `new`) and its slots are
      // nulled after the pass, so a LUT child cannot leak into a later or
      // non-LUT pass.
      const childCount = 1 + pass.children.length;
      childrenBuf.length = childCount;
      childrenBuf[0] = srcShader;
      for (let c = 0; c < pass.children.length; c++) {
        const childImg = pass.children[c];
        if (!childImg) continue;
        childrenBuf[c + 1] = (childImg as import('canvaskit-wasm').Image).makeShaderOptions(
          kit.TileMode.Clamp,
          kit.TileMode.Clamp,
          kit.FilterMode.Linear,
          kit.MipmapMode.None,
        );
      }
      const shader = pass.shader.makeShaderWithChildren(
        pass.uniforms,
        childrenBuf,
      ) as Shader | null;
      fx.setShader(shader);
      target.getCanvas().drawRect(rectScratch, fx);
      fx.setShader(null);
      shader?.delete();
      // Delete the shaders we wrapped this pass (src + any extra children).
      // Do NOT delete the underlying pass.children SkImages — caller-owned.
      for (let c = 0; c < childCount; c++) {
        (childrenBuf[c] as Shader | null)?.delete();
        childrenBuf[c] = null;
      }
      target.flush();
      if (!toScreen) {
        if (src !== img) src.delete();
        src = target.makeImageSnapshot();
      }
    }
    if (src !== img) src.delete();
  }

  return {
    get width() {
      return w;
    },
    get height() {
      return h;
    },
    sceneCanvas: () => (lost ? null : (scene?.getCanvas() ?? null)),
    onscreenCanvas: () => (lost ? null : (onscreen?.getCanvas() ?? null)),
    clear(bgRgb) {
      clearScene(bgRgb);
    },
    fadeTrail(bgRgb, alpha) {
      const sc = scene?.getCanvas();
      if (lost || !sc) return;
      scratch[0] = bgRgb[0] ?? 0;
      scratch[1] = bgRgb[1] ?? 0;
      scratch[2] = bgRgb[2] ?? 0;
      scratch[3] = alpha;
      fade.setColor(scratch);
      fade.setBlendMode(kit.BlendMode.SrcOver);
      rectScratch[0] = 0;
      rectScratch[1] = 0;
      rectScratch[2] = w;
      rectScratch[3] = h;
      sc.drawRect(rectScratch, fade);
    },
    composite(globalIntensity) {
      if (lost || !scene) return;
      scene.flush();
      if (globalIntensity !== undefined) chain.globalIntensity = globalIntensity;
      const img = scene.makeImageSnapshot();
      blit(img);
      img.delete();
    },
    flush() {
      if (!lost) onscreen?.flush();
    },
    resize(nextW, nextH) {
      w = clampDim(nextW);
      h = clampDim(nextH);
      canvas.width = w;
      canvas.height = h;
      if (lost || !grContext) return; // a pending restore rebuilds at the new size
      scene?.delete();
      pong?.delete();
      onscreen?.delete();
      onscreen = kit.MakeOnScreenGLSurface(grContext, w, h, kit.ColorSpace.SRGB);
      scene = onscreen?.makeSurface(info()) ?? null;
      pong = onscreen?.makeSurface(info()) ?? null;
      if (!onscreen || !scene || !pong) {
        disposeGpu();
        lost = true;
      }
    },
    isLost: () => lost,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
      fade.delete();
      fx.delete();
      runtime.reset();
      disposeGpu();
    },
  };
}
