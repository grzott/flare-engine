import { ImageShader, type SkImage, Vertices } from '@shopify/react-native-skia';
import { type ComponentType, type ReactNode, useLayoutEffect, useMemo } from 'react';
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { FractureMesh } from '../../../core/fracture/types';
import { FRAG_STRIDE, HX, HY } from '../../../core/motion/layout';
import { type FragmentPose, fragmentPoseInto } from '../../../core/motion/pose';
import type { RectLike } from '../../../core/placement';
import type { FxImage } from '../../../runtime/contracts';
import {
  createFragmentRun,
  type FragmentRun,
  fragmentMesh,
  isFragmentPreset,
} from '../../fragments';
import { type EffectLayerProps, handOff, type NativeEffect } from '../host';
import { GrainLayer } from './grains';

interface Point {
  x: number;
  y: number;
}

/** What a shard layer draws, built once per run. A vertex is one corner of one piece. */
interface ShardGeometry {
  /** Each vertex at home: x, y in layout pixels from the element's top left corner. */
  home: Float32Array;
  /** Each vertex in the capture, in image pixels. */
  textures: Point[];
  /** Three vertices per triangle: every piece is a fan about its first vertex. */
  indices: number[];
  /** A colour per vertex, white at full alpha. The layer rewrites the alpha each frame. */
  colors: Float32Array[];
}

interface ShardVerticesProps {
  mode: 'triangles';
  vertices: SharedValue<Point[]>;
  textures: Point[];
  indices: number[];
  colors: SharedValue<Float32Array[]>;
  blendMode: 'multiply';
  children?: ReactNode;
}

// The workspace builds against an older RN-Skia than the peer floor, 2.14, which types `colors`
// as strings. 2.14 passes a `Float32Array` colour through unconverted (C43).
const ShardVertices = Vertices as unknown as ComponentType<ShardVerticesProps>;

const _pose: FragmentPose = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };

/**
 * Where the vertex (`vx`, `vy`) of a piece is when the piece is at `pose`, into `out`. The vertex
 * turns and scales about the piece's centroid (`cx`, `cy`), and the centroid lands on
 * (`pose.x`, `pose.y`).
 */
export function shardVertexInto(
  pose: FragmentPose,
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  out: { x: number; y: number },
): void {
  'worklet';
  const dx = vx - cx;
  const dy = vy - cy;
  const c = pose.scale * Math.cos(pose.rotation);
  const s = pose.scale * Math.sin(pose.rotation);
  out.x = pose.x + c * dx - s * dy;
  out.y = pose.y + s * dx + c * dy;
}

function shardGeometry(mesh: FractureMesh, rect: RectLike, image: FxImage): ShardGeometry {
  const { count, vertexStart, vertices } = mesh;
  const total = vertexStart[count]!;
  const home = new Float32Array(total * 2);
  const textures: Point[] = [];
  const indices: number[] = [];
  const colors: Float32Array[] = [];
  for (let v = 0; v < total; v++) {
    const x = vertices[v * 2]! * rect.width;
    const y = vertices[v * 2 + 1]! * rect.height;
    home[v * 2] = x;
    home[v * 2 + 1] = y;
    textures.push({
      x: (image.padding + x) * image.pixelRatio,
      y: (image.padding + y) * image.pixelRatio,
    });
    colors.push(new Float32Array([1, 1, 1, 1]));
  }
  for (let i = 0; i < count; i++) {
    const first = vertexStart[i]!;
    const end = vertexStart[i + 1]!;
    for (let v = first + 1; v < end - 1; v++) indices.push(first, v, v + 1);
  }
  return { home, textures, indices, colors };
}

/**
 * The shards of one run, drawn as textured triangles straight from the capture (C43): nothing is
 * baked, and no pool sprite is used.
 */
function ShardLayer({
  run,
  fragments,
  onFirstFrame,
  onDone,
}: EffectLayerProps & { fragments: FragmentRun }): ReactNode {
  const { rect, image, hidden, startTime, progress, direction } = run;
  const { mesh, state, phys, delay, duration } = fragments;
  const geometry = useMemo(() => shardGeometry(mesh, rect, image), [mesh, rect, image]);
  const { home } = geometry;
  const { count, vertexStart } = mesh;
  const total = vertexStart[count]!;
  const left = rect.x;
  const top = rect.y;

  /** Seconds into the run. */
  const time = useSharedValue(0);
  const ended = useSharedValue(false);
  // A shared value, so the arrays the worklet rewrites each frame are the ones Skia reads.
  const tints = useSharedValue(geometry.colors);

  useFrameCallback((frame) => {
    'worklet';
    const now = frame.timestamp / 1000;
    if (startTime.value < 0) {
      startTime.value = now;
      handOff(hidden, onFirstFrame);
    }
    if (progress !== undefined) {
      time.value = progress.value * duration;
      return;
    }
    const elapsed = now - startTime.value;
    if (elapsed < duration) {
      time.value = elapsed;
      return;
    }
    if (ended.value) return;
    ended.value = true;
    time.value = duration;
    // An enter ends with its pieces at home: the element takes over on this same frame.
    if (direction === 1) hidden.value = 0;
    scheduleOnRN(onDone, true);
  });

  const positions = useDerivedValue(() => {
    'worklet';
    const t = time.value > delay ? time.value - delay : 0;
    // RN-Skia's points cannot be moved, so each frame makes its own (C43).
    const points = new Array<Point>(total);
    for (let i = 0; i < count; i++) {
      fragmentPoseInto(state, i, t, phys, _pose);
      const cx = state[i * FRAG_STRIDE + HX]!;
      const cy = state[i * FRAG_STRIDE + HY]!;
      const end = vertexStart[i + 1]!;
      for (let v = vertexStart[i]!; v < end; v++) {
        const point = { x: 0, y: 0 };
        shardVertexInto(_pose, cx, cy, home[v * 2]!, home[v * 2 + 1]!, point);
        point.x += left;
        point.y += top;
        points[v] = point;
      }
    }
    return points;
  });

  const colors = useDerivedValue(() => {
    'worklet';
    const t = time.value > delay ? time.value - delay : 0;
    const out = tints.value;
    for (let i = 0; i < count; i++) {
      fragmentPoseInto(state, i, t, phys, _pose);
      const alpha = _pose.alpha < 0 ? 0 : _pose.alpha > 1 ? 1 : _pose.alpha;
      const end = vertexStart[i + 1]!;
      for (let v = vertexStart[i]!; v < end; v++) out[v]![3] = alpha;
    }
    return out;
  });

  return (
    <ShardVertices
      mode="triangles"
      vertices={positions}
      textures={geometry.textures}
      indices={geometry.indices}
      colors={colors}
      // With an image shader, `modulate` and the default blend draw nothing (C43).
      blendMode="multiply"
    >
      {/* `captureView` puts an `SkImage` in `handle`. */}
      <ImageShader image={image.handle as SkImage | null} />
    </ShardVertices>
  );
}

/** Ends a run that nothing draws, unfinished, as soon as it mounts. */
export function Unplayed({ onDone }: Pick<EffectLayerProps, 'onDone'>): ReactNode {
  useLayoutEffect(() => {
    onDone(false);
  }, [onDone]);
  return null;
}

/**
 * The layer of a fragment run. The run's mesh picks how it draws, whatever the preset is called
 * (C43): pieces that are not all rectangles are shards, drawn by a `<Vertices>` layer. A
 * rectangular mesh is grains, which draw from the pool sprites the run claimed.
 */
function FragmentLayer(props: EffectLayerProps): ReactNode {
  const { preset, rect, image, direction, press } = props.run;
  const { pixelRatio } = image;
  const fragments = useMemo(() => {
    if (!isFragmentPreset(preset)) return null;
    const mesh = fragmentMesh(preset, rect.width, rect.height, press, pixelRatio);
    return createFragmentRun(preset, mesh, rect.width, rect.height, direction, press);
  }, [preset, rect, pixelRatio, direction, press]);
  if (fragments === null) return <Unplayed onDone={props.onDone} />;
  if (fragments.mesh.rectangular) return <GrainLayer {...props} fragments={fragments} />;
  return <ShardLayer {...props} fragments={fragments} />;
}

/**
 * How `shatter` and `disintegrate` draw on native. A run whose mesh is rectangular claims a pool
 * sprite per piece; any other mesh draws on its own layer and claims none.
 */
export const fragmentEffect: NativeEffect = {
  sprites(preset, rect, image) {
    if (!isFragmentPreset(preset)) return 0;
    // Whether a mesh is rectangular, and how many pieces it then has, does not depend on where
    // the press was.
    const mesh = fragmentMesh(preset, rect.width, rect.height, null, image.pixelRatio);
    return mesh.rectangular ? mesh.count : 0;
  },
  Layer: FragmentLayer,
};
