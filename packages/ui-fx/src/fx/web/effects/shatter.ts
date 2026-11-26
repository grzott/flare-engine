import { packShardsInto } from '../../../core/fracture/pack';
import type { ShardPacking } from '../../../core/fracture/types';
import { type FragmentPose, fragmentPoseInto } from '../../../core/motion/pose';
import { CAPTURE_MAX_PX } from '../../../runtime/element';
import type { WebEffect, WebRunState } from '../../../web/fx-runtime';
import {
  createFragmentRun,
  type FragmentRun,
  fragmentMesh,
  isFragmentPreset,
  shardXformInto,
} from '../../fragments';
import { bakeShardAtlas } from '../bake';

/** Clear atlas pixels around every shard, so a turned shard samples none of its neighbours. */
const ATLAS_PADDING = 2;

/** What one run draws its shards from. */
interface ShardRun {
  fragments: FragmentRun;
  packing: ShardPacking;
  /** The element's size in image pixels. */
  widthPx: number;
  heightPx: number;
  /** Each shard's source rect in the atlas: left, top, right, bottom. */
  srcs: Float32Array;
  /** Each shard's centroid in its source rect: x, y in atlas pixels from the rect's corner. */
  pivots: Float32Array;
  /** Layout pixels per atlas pixel. */
  scale: number;
}

const runs = new WeakMap<WebRunState, ShardRun>();

const _pose: FragmentPose = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };

function shardRunOf(run: WebRunState): ShardRun {
  const { preset, rect, image } = run;
  if (!isFragmentPreset(preset)) {
    throw new Error(`the shatter effect cannot draw a ${preset.kind} preset`);
  }
  const mesh = fragmentMesh(preset, rect.width, rect.height, run.press);
  const fragments = createFragmentRun(
    preset,
    mesh,
    rect.width,
    rect.height,
    run.direction,
    run.press,
  );
  const widthPx = rect.width * image.pixelRatio;
  const heightPx = rect.height * image.pixelRatio;
  const { count, centroids, bounds } = mesh;
  const packing = packShardsInto(mesh, widthPx, heightPx, ATLAS_PADDING, CAPTURE_MAX_PX, {
    atlasW: 0,
    atlasH: 0,
    scale: 1,
    rects: new Float32Array(count * 4),
  });
  const { rects } = packing;
  const srcs = new Float32Array(count * 4);
  const pivots = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    srcs[o] = rects[o]!;
    srcs[o + 1] = rects[o + 1]!;
    srcs[o + 2] = rects[o]! + rects[o + 2]!;
    srcs[o + 3] = rects[o + 1]! + rects[o + 3]!;
    pivots[i * 2] = (centroids[i * 2]! - bounds[o]!) * widthPx * packing.scale;
    pivots[i * 2 + 1] = (centroids[i * 2 + 1]! - bounds[o + 1]!) * heightPx * packing.scale;
  }
  return {
    fragments,
    packing,
    widthPx,
    heightPx,
    srcs,
    pivots,
    scale: 1 / (image.pixelRatio * packing.scale),
  };
}

/**
 * How a fragment preset draws on the web: the capture is baked into a shard atlas, each piece
 * clipped by its polygon, and every frame draws one sprite per piece from it. A piece fades
 * through its sprite's colour, which the runtime's Modulate blend multiplies in.
 *
 * An enter plays the preset's `reverse` mode. On the frame a run ends, its pieces are written at
 * their last pose although nothing is drawn.
 */
export const shatterEffect: WebEffect = {
  sprites(run) {
    const shards = shardRunOf(run);
    runs.set(run, shards);
    return shards.fragments.mesh.count;
  },

  bake(run, kit, capture) {
    const shards = runs.get(run) ?? shardRunOf(run);
    const { fragments, packing, widthPx, heightPx } = shards;
    return bakeShardAtlas(kit, capture, run.image, fragments.mesh, packing, widthPx, heightPx);
  },

  frame(run, pool, time) {
    const shards = runs.get(run);
    if (shards === undefined) return false;
    const { fragments, pivots, scale } = shards;
    const { state, phys, delay, duration } = fragments;
    const count = fragments.mesh.count;
    const { progress } = run;
    const playing = progress !== undefined || time < duration;
    let seconds = duration;
    if (progress !== undefined) seconds = progress.value * duration;
    else if (playing) seconds = time;
    const t = seconds > delay ? seconds - delay : 0;
    // The capture's corner is the origin, and the element starts a padding in from it.
    const inset = run.image.padding;
    const { xforms, colors } = pool;

    pool.srcs.set(shards.srcs);
    for (let i = 0; i < count; i++) {
      fragmentPoseInto(state, i, t, phys, _pose);
      _pose.x += inset;
      _pose.y += inset;
      shardXformInto(_pose, pivots[i * 2]!, pivots[i * 2 + 1]!, scale, xforms, i * 4);
      const alpha = _pose.alpha < 0 ? 0 : _pose.alpha > 1 ? 1 : _pose.alpha;
      colors[i] = (((alpha * 255) << 24) | 0xffffff) >>> 0;
    }
    return playing;
  },
};
