import type { WebEffect, WebRunState } from '../../../web/fx-runtime';
import {
  createFragmentRun,
  type FragmentRun,
  fragmentMesh,
  grainCells,
  isFragmentPreset,
} from '../../fragments';
import { pieceSpritesInto } from './shatter';

/** What one run draws its grains from. */
interface GrainRun {
  fragments: FragmentRun;
  /** Each grain's cell in the capture: left, top, right, bottom in image pixels. */
  srcs: Float32Array;
  /** Each cell's centre: x, y in image pixels from the cell's corner. */
  pivots: Float32Array;
}

const runs = new WeakMap<WebRunState, GrainRun>();

function grainRunOf(run: WebRunState): GrainRun {
  const { preset, rect, image } = run;
  if (!isFragmentPreset(preset)) {
    throw new Error(`the grains effect cannot draw a ${preset.kind} preset`);
  }
  const mesh = fragmentMesh(preset, rect.width, rect.height, run.press, image.pixelRatio);
  if (!mesh.rectangular) {
    throw new Error(`the grains effect cannot draw the pieces of '${preset.fragment.pattern}'`);
  }
  const fragments = createFragmentRun(
    preset,
    mesh,
    rect.width,
    rect.height,
    run.direction,
    run.press,
  );
  const { rects, pivots } = grainCells(mesh, rect, image);
  // `rects` holds a width and a height, where `drawAtlas` takes the right and bottom edges.
  for (let o = 0; o < rects.length; o += 4) {
    rects[o + 2] = rects[o]! + rects[o + 2]!;
    rects[o + 3] = rects[o + 1]! + rects[o + 3]!;
  }
  return { fragments, srcs: rects, pivots };
}

/**
 * How a fragment preset whose mesh is rectangular draws on the web: every piece is a cell cut
 * straight from the capture, so nothing is baked, and every frame draws one sprite per cell. A
 * grain fades through its sprite's colour, which the runtime's Modulate blend multiplies in.
 *
 * An enter plays the preset's `reverse` mode. On the frame a run ends, its grains are written at
 * their last pose although nothing is drawn. A mesh that is not rectangular throws from
 * `sprites`, so the run falls back.
 */
export const grainsEffect: WebEffect = {
  sprites(run) {
    const grains = grainRunOf(run);
    runs.set(run, grains);
    return grains.fragments.mesh.count;
  },

  frame(run, pool, time) {
    const grains = runs.get(run);
    if (grains === undefined) return false;
    const { fragments, srcs, pivots } = grains;
    return pieceSpritesInto(run, pool, time, fragments, srcs, pivots, 1 / run.image.pixelRatio);
  },
};
