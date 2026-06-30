import {
  type CompiledPass,
  type EffectChain,
  type SkiaPostFxModuleLike,
  createPostFxRuntime,
} from '@flare-engine/postfx';
import type { Canvas as CKCanvas, CanvasKit, Shader, Surface } from 'canvaskit-wasm';

/**
 * A CanvasKit-backed render surface with a parameterized postfx chain.
 *
 * Lifted verbatim from `flare-engine-page/src/components/demos/postfx/surface.ts`
 * with the hardcoded effect chain replaced by the caller-supplied `chain` argument.
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
  /** The offscreen scene canvas — draw the scene here each frame. */
  sceneCanvas(): CKCanvas | null;
  /** The on-screen canvas — draw crisp overlays here AFTER composite(). */
  onscreenCanvas(): CKCanvas;
  /** Hard-clear the scene to an opaque background (call once after create + after resize). */
  clear(bgRgb: readonly number[]): void;
  /** Motion-blur trail: fade the previous scene frame toward bg instead of clearing. */
  fadeTrail(bgRgb: readonly number[], alpha: number): void;
  /** Snapshot the scene, run the chain at `globalIntensity`, composite to screen. */
  composite(globalIntensity: number): void;
  /** Flush the on-screen surface (after drawing crisp overlays). */
  flush(): void;
  /** Resize the canvas backing store + offscreen surfaces (does NOT clear — call clear() after). */
  resize(width: number, height: number): void;
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
  const onscreenOrNull = kit.MakeWebGLCanvasSurface(canvas);
  if (!onscreenOrNull) return null;
  // Capture as non-null so closures below can reference it without re-narrowing.
  const onscreen: import('canvaskit-wasm').Surface = onscreenOrNull;

  let w = Math.max(1, canvas.width);
  let h = Math.max(1, canvas.height);

  const info = () => ({
    width: w,
    height: h,
    colorType: kit.ColorType.RGBA_8888,
    alphaType: kit.AlphaType.Premul,
    colorSpace: kit.ColorSpace.SRGB,
  });

  let scene: Surface | null = onscreen.makeSurface(info());
  let pong: Surface | null = onscreen.makeSurface(info());

  const fade = new kit.Paint();
  const fx = new kit.Paint();
  const scratch = new Float32Array(4);

  // Build a minimal SkiaPostFxModuleLike shim that routes to CanvasKit's RuntimeEffect.
  const skia: SkiaPostFxModuleLike = {
    RuntimeEffect: {
      Make(sksl) {
        const eff = kit.RuntimeEffect.Make(sksl);
        if (!eff) return null;
        return {
          makeShaderWithChildren: (uniforms, children) =>
            eff.makeShaderWithChildren(Float32Array.from(uniforms), (children ?? []) as Shader[]),
        };
      },
    },
  };
  const runtime = createPostFxRuntime(skia);

  function blit(img: import('canvaskit-wasm').Image): void {
    const passes: readonly CompiledPass[] = runtime.supported ? runtime.buildPass(chain, w, h) : [];
    if (passes.length === 0) {
      onscreen.getCanvas().drawImage(img, 0, 0);
      onscreen.flush();
      return;
    }
    let src: import('canvaskit-wasm').Image = img;
    const last = passes.length - 1;
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
      const shader = pass.shader.makeShaderWithChildren(Array.from(pass.uniforms), [
        srcShader,
      ]) as Shader | null;
      fx.setShader(shader);
      target.getCanvas().drawRect(kit.LTRBRect(0, 0, w, h), fx);
      fx.setShader(null);
      shader?.delete();
      srcShader.delete();
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
    sceneCanvas: () => scene?.getCanvas() ?? null,
    onscreenCanvas: () => onscreen.getCanvas(),
    clear(bgRgb) {
      scene?.getCanvas().clear(kit.Color4f(bgRgb[0] ?? 0, bgRgb[1] ?? 0, bgRgb[2] ?? 0, 1));
      scene?.flush();
    },
    fadeTrail(bgRgb, alpha) {
      const sc = scene?.getCanvas();
      if (!sc) return;
      scratch[0] = bgRgb[0] ?? 0;
      scratch[1] = bgRgb[1] ?? 0;
      scratch[2] = bgRgb[2] ?? 0;
      scratch[3] = alpha;
      fade.setColor(scratch);
      fade.setBlendMode(kit.BlendMode.SrcOver);
      sc.drawRect(kit.LTRBRect(0, 0, w, h), fade);
    },
    composite(globalIntensity) {
      if (!scene) return;
      scene.flush();
      chain.globalIntensity = globalIntensity;
      const img = scene.makeImageSnapshot();
      blit(img);
      img.delete();
    },
    flush() {
      onscreen.flush();
    },
    resize(nextW, nextH) {
      w = Math.max(1, Math.floor(nextW));
      h = Math.max(1, Math.floor(nextH));
      canvas.width = w;
      canvas.height = h;
      scene?.delete();
      pong?.delete();
      scene = onscreen.makeSurface(info());
      pong = onscreen.makeSurface(info());
    },
    dispose() {
      scene?.delete();
      pong?.delete();
      fade.delete();
      fx.delete();
      runtime.reset();
      onscreen.delete();
    },
  };
}
