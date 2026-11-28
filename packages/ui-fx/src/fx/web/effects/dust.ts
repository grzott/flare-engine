import type { CanvasKit, Paint, RuntimeEffect, Shader } from 'canvaskit-wasm';
import { DELAY, FRAG_STRIDE } from '../../../core/motion/layout';
import { type FragmentPose, fragmentPoseInto } from '../../../core/motion/pose';
import { DUST_SKSL, packDustUniformsInto } from '../../../core/sksl';
import { timingAt } from '../../../core/timing';
import type { AtlasPool } from '../../../web/atlas';
import type { WebEffect, WebRunState } from '../../../web/fx-runtime';
import { createDustRun, type DustGrains, type DustRun, type DustRunPreset } from '../../dust';
import { shardXformInto } from '../../fragments';

/** What one run draws its dissolve from. */
interface DustDrawing {
  preset: DustRunPreset;
  dust: DustRun;
  /** Each grain's cell in the capture: left, top, right, bottom in image pixels. */
  srcs: Float32Array;
  /** The rect the shader fills, from its own corner: left, top, right, bottom. */
  box: Float32Array;
  /** Made by `prepare`, and `null` before it and after `release`. */
  effect: RuntimeEffect | null;
  capture: Shader | null;
  paint: Paint | null;
}

const runs = new WeakMap<WebRunState, DustDrawing>();

const compiled = new WeakMap<CanvasKit, RuntimeEffect>();

const _pose: FragmentPose = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };

/** The dust shader compiled by `kit`, made on first use and kept for the kit's life. */
function dustEffectOf(kit: CanvasKit): RuntimeEffect {
  let effect = compiled.get(kit);
  if (effect === undefined) {
    const made = kit.RuntimeEffect.Make(DUST_SKSL);
    if (made === null) throw new Error('the dust shader did not compile');
    effect = made;
    compiled.set(kit, effect);
  }
  return effect;
}

function drawingOf(run: WebRunState): DustDrawing {
  const { preset, rect, image } = run;
  if (preset.kind !== 'dust') {
    throw new Error(`the dust effect cannot draw a ${preset.kind} preset`);
  }
  const dust = createDustRun(preset, rect, image);
  const srcs = dust.grains === null ? new Float32Array(0) : dust.grains.rects.slice();
  // The cells hold a width and a height, where `drawAtlas` takes the right and bottom edges.
  for (let o = 0; o < srcs.length; o += 4) {
    srcs[o + 2] = srcs[o]! + srcs[o + 2]!;
    srcs[o + 3] = srcs[o + 1]! + srcs[o + 3]!;
  }
  const box = Float32Array.of(
    0,
    0,
    rect.width + 2 * preset.spread,
    rect.height + 2 * preset.spread,
  );
  return { preset, dust, srcs, box, effect: null, capture: null, paint: null };
}

/**
 * Write one sprite per grain into `pool` as the grains are when the dissolve is `gone`, 0 whole
 * to 1 gone. A grain the front has not reached is written unseen: until then it would draw its
 * cell at home, over a place the shader may have dissolved already.
 */
function grainSpritesInto(
  run: WebRunState,
  pool: AtlasPool,
  grains: DustGrains,
  srcs: Float32Array,
  gone: number,
): void {
  const { state, phys, mesh } = grains.fragments;
  const { pivots } = grains;
  const t = gone * grains.seconds;
  // The capture's corner is the origin, and the element starts a padding in from it.
  const inset = run.image.padding;
  const scale = 1 / run.image.pixelRatio;
  const { xforms, colors } = pool;

  pool.srcs.set(srcs);
  for (let i = 0; i < mesh.count; i++) {
    fragmentPoseInto(state, i, t, phys, _pose);
    _pose.x += inset;
    _pose.y += inset;
    shardXformInto(_pose, pivots[i * 2]!, pivots[i * 2 + 1]!, scale, xforms, i * 4);
    let alpha = _pose.alpha < 0 ? 0 : _pose.alpha > 1 ? 1 : _pose.alpha;
    if (t < state[i * FRAG_STRIDE + DELAY]!) alpha = 0;
    colors[i] = (((alpha * 255) << 24) | 0xffffff) >>> 0;
  }
}

/**
 * How `dust` draws on the web: a rect that reaches `spread` beyond the element on every side,
 * filled by the dust shader with the capture as its child. The shader is compiled once per
 * CanvasKit; a run whose shader does not compile falls back.
 *
 * With `grainsAtFront`, the run also draws a sprite per grain over the rect, cut straight from
 * the capture. An enter plays the dissolve backwards.
 */
export const dustEffect: WebEffect = {
  sprites(run) {
    const drawing = drawingOf(run);
    runs.set(run, drawing);
    return drawing.dust.grains?.fragments.mesh.count ?? 0;
  },

  prepare(run, kit, image) {
    const drawing = runs.get(run);
    if (drawing === undefined) throw new Error('the dust run was not set up');
    drawing.effect = dustEffectOf(kit);
    const scale = 1 / run.image.pixelRatio;
    const inset = -run.image.padding;
    // Image pixels to layout pixels from the element's corner, where the shader samples. Past
    // the capture's edges there is nothing.
    drawing.capture = image.makeShaderOptions(
      kit.TileMode.Decal,
      kit.TileMode.Decal,
      kit.FilterMode.Linear,
      kit.MipmapMode.None,
      [scale, 0, inset, 0, scale, inset, 0, 0, 1],
    );
    drawing.paint = new kit.Paint();
  },

  frame(run, pool, time) {
    const drawing = runs.get(run);
    if (drawing === undefined) return false;
    const { preset, dust } = drawing;
    const { total } = dust;
    const { progress } = run;
    const playing = progress !== undefined || time < total;
    let seconds = total;
    if (progress !== undefined) seconds = progress.value * total;
    else if (playing) seconds = time;
    const eased = timingAt(dust.samples, dust.delay, dust.duration, seconds);
    // An enter is the dissolve backwards: it starts gone and ends whole.
    const gone = run.direction === 1 ? 1 - eased : eased;

    packDustUniformsInto(preset, gone, run.rect.width, run.rect.height, dust.uniforms);
    if (dust.grains !== null) grainSpritesInto(run, pool, dust.grains, drawing.srcs, gone);
    return playing;
  },

  paint(run, canvas) {
    const drawing = runs.get(run);
    if (drawing === undefined) return;
    const { effect, capture, paint } = drawing;
    if (effect === null || capture === null || paint === null) return;
    // CanvasKit binds uniforms when a shader is made, so each frame makes its own.
    const shader = effect.makeShaderWithChildren(drawing.dust.uniforms, [capture]);
    paint.setShader(shader);
    const corner = run.image.padding - drawing.preset.spread;
    canvas.save();
    // The shader measures from the rect's corner.
    canvas.translate(corner, corner);
    canvas.drawRect(drawing.box, paint);
    canvas.restore();
    shader.delete();
  },

  release(run) {
    const drawing = runs.get(run);
    if (drawing === undefined) return;
    drawing.capture?.delete();
    drawing.capture = null;
    drawing.paint?.delete();
    drawing.paint = null;
    drawing.effect = null;
  },
};
