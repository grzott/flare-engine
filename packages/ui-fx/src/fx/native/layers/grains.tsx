import { type ReactNode, useMemo } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type FragmentPose, fragmentPoseInto } from '../../../core/motion/pose';
import { type FragmentRun, grainCells, shardXformInto } from '../../fragments';
import { type EffectLayerProps, handOff } from '../host';

const _pose: FragmentPose = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };

/** For `modify`: the buffer was written in place, and this tells whoever reads it. */
function written<T>(buffer: T): T {
  'worklet';
  return buffer;
}

/**
 * Write the pool sprites of `count` grains as they are `t` seconds into their motion: the RSXform
 * of grain `i` into `xforms`, and its alpha into `colors`, both at sprite `first + i`. A grain
 * turns and scales about its cell's centre, `pivots[i * 2]` and the float after it, in image
 * pixels from the cell's corner. (`left`, `top`) is the element's corner on the canvas, and
 * `scale` is layout pixels per image pixel.
 */
export function grainSpritesInto(
  state: Float32Array,
  phys: Float32Array,
  count: number,
  t: number,
  pivots: Float32Array,
  left: number,
  top: number,
  scale: number,
  xforms: Float32Array,
  colors: Float32Array,
  first: number,
): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    fragmentPoseInto(state, i, t, phys, _pose);
    _pose.x += left;
    _pose.y += top;
    const o = (first + i) * 4;
    shardXformInto(_pose, pivots[i * 2]!, pivots[i * 2 + 1]!, scale, xforms, o);
    // The sprite's colour is white, so the alpha alone fades it.
    colors[o + 3] = _pose.alpha < 0 ? 0 : _pose.alpha > 1 ? 1 : _pose.alpha;
  }
}

/**
 * The grains of one run: the pieces of a rectangular mesh, each a cell cut straight from the
 * capture. It mounts nothing. Its frame worklet writes the pool sprites the run claimed, which
 * the host's one `<Atlas>` draws (C38), and the host frees them when the run ends.
 */
export function GrainLayer({
  run,
  fragments,
  onFirstFrame,
  onDone,
}: EffectLayerProps & { fragments: FragmentRun }): ReactNode {
  const { rect, image, hidden, startTime, progress, direction, spriteStart } = run;
  const { transforms, colors } = run.pool;
  const sprites = run.pool.rects;
  const { mesh, state, phys, delay, duration } = fragments;
  const { count } = mesh;
  const { rects, pivots } = useMemo(() => grainCells(mesh, rect, image), [mesh, rect, image]);
  const left = rect.x;
  const top = rect.y;
  const scale = 1 / image.pixelRatio;

  const ended = useSharedValue(false);

  const cut = <T extends Float32Array>(buffer: T): T => {
    'worklet';
    buffer.set(rects, spriteStart * 4);
    return buffer;
  };

  useFrameCallback((frame) => {
    'worklet';
    // The host frees the sprites once it hears of the end: nothing may write them after that.
    if (ended.value) return;
    const now = frame.timestamp / 1000;
    const first = startTime.value < 0;
    if (first) {
      startTime.value = now;
      sprites.modify(cut);
    }
    let seconds = now - startTime.value;
    let over = false;
    if (progress !== undefined) seconds = progress.value * duration;
    else if (seconds >= duration) {
      seconds = duration;
      over = true;
    }
    const t = seconds > delay ? seconds - delay : 0;

    // One pass writes both buffers in place. `modify` then marks each as changed.
    grainSpritesInto(
      state,
      phys,
      count,
      t,
      pivots,
      left,
      top,
      scale,
      transforms.value,
      colors.value,
      spriteStart,
    );
    transforms.modify(written);
    colors.modify(written);

    if (first) handOff(hidden, onFirstFrame);
    if (!over) return;
    ended.value = true;
    // An enter ends with its grains at home: the element takes over on this same frame.
    if (direction === 1) hidden.value = 0;
    scheduleOnRN(onDone, true);
  });

  return null;
}
