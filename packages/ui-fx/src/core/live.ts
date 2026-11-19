import { directionInto, resolveEdge } from './conventions';
import { type ArcTable, buildArcTable, pathPoseAtInto } from './path/arc-table';
import { type LivePreset, type PresetCommon, presetDuration, type SlidePreset } from './presets';
import { compileTiming, type TimingTable } from './timing';

/** Numbers per row of `sampleLivePosesInto`, one per {@link LivePose} field, in field order. */
export const LIVE_POSE_STRIDE = 11;

/**
 * The style of a live element at one moment, relative to its laid-out rest: translation in
 * pixels, rotations in degrees, `scale`, `opacity` and `brightness` as factors. `perspective` is
 * in pixels and 0 means none. `shadowEdge` is how far the emerge shadow edge has crossed the
 * element (0..1) and `shadowOpacity` the opacity of that shadow. At rest the pose is all 0,
 * except `scale`, `opacity`, `brightness` and `shadowEdge`, which are 1.
 */
export interface LivePose {
  tx: number;
  ty: number;
  rotationDeg: number;
  rotateXDeg: number;
  rotateYDeg: number;
  perspective: number;
  scale: number;
  opacity: number;
  brightness: number;
  shadowEdge: number;
  shadowOpacity: number;
}

/**
 * A live preset, or a timeline's live entries, compiled for `livePoseAtInto`.
 *
 * - `kind`: 0 fade, 1 slide, 2 slide along a path, 3 press, 4 emerge, 5 a list of entries.
 * - `params`: the entry count, then one record per entry, then the pose tables of the path slides.
 * - `timing`: for one preset, its timing table. For a list, the entries' samples one after
 *   another, with `delay` 0 and the `duration` of the whole list.
 * - `path`: the arc table of the first slide along a path, or `null` without one.
 * - `duration`: seconds until the last entry has ended, delays included.
 * - `uses3d`: whether any entry writes `rotateXDeg`, `rotateYDeg` or `perspective`.
 */
export interface CompiledLive {
  kind: number;
  params: Float32Array;
  timing: TimingTable;
  path: ArcTable | null;
  duration: number;
  uses3d: boolean;
}

const FADE = 0;
const SLIDE = 1;
const PATH_SLIDE = 2;
const PRESS = 3;
const EMERGE = 4;
const LIST = 5;

// `params` starts with the entry count. Each record is its kind, the seconds at which its timing
// starts (entry start plus delay), its duration, the index of its first sample in
// `timing.samples`, the index of its last sample counted from the first, and four values by kind:
//   fade        away opacity
//   slide       away tx, away ty
//   path slide  index in `params` of its pose table
//   press       scale, opacity, brightness
//   emerge      away tx, away ty, shadow opacity, shadow lag
const HEADER = 1;
const KIND = 0;
const START = 1;
const DURATION = 2;
const FIRST = 3;
const LAST = 4;
const P0 = 5;
const P1 = 6;
const P2 = 7;
const P3 = 8;
const ENTRY_STRIDE = 9;

// A pose table has one row per timing sample: tx, ty and rotation entering, then the same three
// exiting. Baking the path in keeps the evaluator free of a path lookup, which would need a
// scratch object a worklet cannot own, and lets the rotation be unwrapped across ±180°.
const PATH_ROW = 6;
const EXIT_COLUMNS = 3;

const _direction = { x: 0, y: 0 };
const _pathPose = { x: 0, y: 0, angleDeg: 0 };
const _row: LivePose = {
  tx: 0,
  ty: 0,
  rotationDeg: 0,
  rotateXDeg: 0,
  rotateYDeg: 0,
  perspective: 0,
  scale: 1,
  opacity: 1,
  brightness: 1,
  shadowEdge: 1,
  shadowOpacity: 0,
};

/** Append the pose table of a slide along a path: a row for every sample of `timing`. */
function pushPathTable(
  tables: number[],
  p: SlidePreset,
  path: ArcTable,
  timing: TimingTable,
  widthPx: number,
  heightPx: number,
): void {
  const samples = timing.samples;
  const last = samples.length - 1;
  const from = p.start * path.total;
  const to = p.end * path.total;
  pathPoseAtInto(path, to, _pathPose);
  const endX = _pathPose.x;
  const endY = _pathPose.y;
  const endAngle = _pathPose.angleDeg;
  const rotates = p.autoRotate !== false;
  const offset = typeof p.autoRotate === 'number' ? p.autoRotate : 0;
  // The element turns about its centre; this arm reaches from there to the point kept on the path.
  const armX = (p.alignOrigin.x - 0.5) * widthPx;
  const armY = (p.alignOrigin.y - 0.5) * heightPx;

  const base = tables.length;
  for (let i = 0; i < (last + 1) * PATH_ROW; i++) tables.push(0);

  for (let exiting = 0; exiting < 2; exiting++) {
    // Walk away from the rest end, where the turn is 0, so each sample unwraps against its
    // neighbour: entering rests on the last sample, exiting on the first.
    let turn = 0;
    for (let step = 0; step <= last; step++) {
      const k = exiting === 1 ? step : last - step;
      const eased = samples[k]!;
      const rest = exiting === 1 ? 1 - eased : eased;
      pathPoseAtInto(path, from + (to - from) * rest, _pathPose);
      let rotation = 0;
      if (rotates) {
        const delta = _pathPose.angleDeg - endAngle - turn;
        turn += delta - 360 * Math.round(delta / 360);
        rotation = Math.min(Math.max(turn + offset, -p.rotationLimit), p.rotationLimit);
      }
      const radians = (rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const o = base + k * PATH_ROW + exiting * EXIT_COLUMNS;
      tables[o] = _pathPose.x - endX + armX - (armX * cos - armY * sin);
      tables[o + 1] = _pathPose.y - endY + armY - (armX * sin + armY * cos);
      tables[o + 2] = rotation;
    }
  }
}

/**
 * Compile a live preset, or the live entries of a timeline, for an element of `widthPx` by
 * `heightPx`. `rtl` resolves the `'start'` and `'end'` edges of a slide.
 *
 * In a list every entry runs on its own clock, `t − start`: it sits in its initial pose before
 * that and holds its final pose once it has ended. The entries compose: translations and
 * rotations add; scale, opacity and brightness multiply; the shadow values take the maximum.
 *
 * A slide along a path moves the point `alignOrigin` of the element along the stretch `start`
 * to `end` of the path, measured from that stretch's end, and ignores `from` and `distance`.
 * With `autoRotate` it turns by the angle between the tangent and the tangent at that end, plus
 * the offset when `autoRotate` is a number, clamped to ±`rotationLimit`.
 *
 * Throws a `RangeError` for a width or height that is not a finite number >= 0, a preset that
 * is not live, and whatever `compileTiming` or `buildArcTable` refuse.
 */
export function compileLive(
  input: LivePreset | readonly { start: number; preset: LivePreset }[],
  widthPx: number,
  heightPx: number,
  rtl: boolean,
): CompiledLive {
  if (!Number.isFinite(widthPx) || widthPx < 0 || !Number.isFinite(heightPx) || heightPx < 0) {
    throw new RangeError(
      `compileLive: widthPx and heightPx must be finite numbers >= 0, got ${widthPx} and ${heightPx}`,
    );
  }
  const single = 'kind' in input;
  const entries = single ? [{ start: 0, preset: input }] : input;
  const tablesAt = HEADER + entries.length * ENTRY_STRIDE;
  const records: number[] = [entries.length];
  const tables: number[] = [];
  const timings: TimingTable[] = [];
  let sampleCount = 0;
  let path: ArcTable | null = null;
  let duration = 0;

  for (const entry of entries) {
    // The factories return presets that carry their timing; `LivePreset` alone does not list it.
    const preset = entry.preset as LivePreset & PresetCommon;
    const timing = compileTiming(preset, presetDuration(preset) - (preset.delay ?? 0));
    let kind: number;
    let p0 = 0;
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    if (preset.kind === 'fade') {
      kind = FADE;
      p0 = preset.opacity;
    } else if (preset.kind === 'slide') {
      if (preset.path !== null) {
        kind = PATH_SLIDE;
        const arc = buildArcTable(preset.path);
        path ??= arc;
        p0 = tablesAt + tables.length;
        pushPathTable(tables, preset, arc, timing, widthPx, heightPx);
      } else {
        kind = SLIDE;
        const from = preset.from;
        if (typeof from === 'string') {
          const edge = resolveEdge(from, rtl);
          if (edge === 'right') p0 = preset.distance;
          else if (edge === 'left') p0 = -preset.distance;
          else if (edge === 'bottom') p1 = preset.distance;
          else p1 = -preset.distance;
        } else if ('angle' in from) {
          directionInto(from.angle, _direction);
          p0 = -_direction.x * from.distance;
          p1 = -_direction.y * from.distance;
        } else {
          p0 = from.x;
          p1 = from.y;
        }
      }
    } else if (preset.kind === 'press') {
      kind = PRESS;
      p0 = preset.scale;
      p1 = preset.opacity;
      p2 = preset.brightness;
    } else if (preset.kind === 'emerge' && preset.variant === 'live') {
      kind = EMERGE;
      directionInto(preset.angle, _direction);
      p0 = -_direction.x * preset.distance;
      p1 = -_direction.y * preset.distance;
      p2 = preset.shadow.opacity;
      p3 = preset.shadow.lag;
    } else {
      throw new RangeError(`compileLive: "${preset.kind}" is not a live preset`);
    }

    const start = entry.start + timing.delay;
    records.push(
      kind,
      start,
      timing.duration,
      sampleCount,
      timing.samples.length - 1,
      p0,
      p1,
      p2,
      p3,
    );
    timings.push(timing);
    sampleCount += timing.samples.length;
    duration = Math.max(duration, start + timing.duration);
  }

  const params = new Float32Array(tablesAt + tables.length);
  params.set(records);
  params.set(tables, tablesAt);

  let timing: TimingTable;
  if (single) {
    timing = timings[0]!;
  } else {
    const samples = new Float32Array(sampleCount);
    let at = 0;
    for (const table of timings) {
      samples.set(table.samples, at);
      at += table.samples.length;
    }
    timing = { delay: 0, duration, samples };
  }
  return {
    kind: single ? records[HEADER + KIND]! : LIST,
    params,
    timing,
    path,
    duration,
    uses3d: false,
  };
}

/**
 * The pose at `t` seconds, writing into `out`. `direction` 1 enters, from the away state to
 * rest; -1 exits, from rest to the away state, along the same timing. From `c.duration` on,
 * every entry is in its final pose. `pressT` in 0..1 blends the pose of a press preset in: its
 * scale, opacity and brightness multiply the rest of the pose, and `t` does not move it.
 */
export function livePoseAtInto(
  c: CompiledLive,
  t: number,
  direction: 1 | -1,
  pressT: number,
  out: LivePose,
): LivePose {
  'worklet';
  const params = c.params;
  const samples = c.timing.samples;
  const done = t >= c.duration;
  const count = params[0]!;
  let tx = 0;
  let ty = 0;
  let rotation = 0;
  let scale = 1;
  let opacity = 1;
  let brightness = 1;
  let shadowEdge = 1;
  let shadowOpacity = 0;
  let shadowed = false;

  for (let i = 0; i < count; i++) {
    const o = HEADER + i * ENTRY_STRIDE;
    const kind = params[o + KIND]!;
    if (kind === PRESS) {
      scale *= 1 + (params[o + P0]! - 1) * pressT;
      opacity *= 1 + (params[o + P1]! - 1) * pressT;
      brightness *= 1 + (params[o + P2]! - 1) * pressT;
      continue;
    }

    // Where `t` falls among the entry's samples: sample `index`, and `mix` of the way to the next.
    const last = params[o + LAST]!;
    const duration = params[o + DURATION]!;
    const local = t - params[o + START]!;
    let index = 0;
    let mix = 0;
    // `done` first: the record's times are Float32, so `local` can fall a rounding error short.
    if (done || local >= duration) {
      index = last;
    } else if (local > 0) {
      const position = (local / duration) * last;
      index = Math.floor(position);
      if (index >= last) index = last;
      else mix = position - index;
    }
    const next = index < last ? 1 : 0;

    if (kind === PATH_SLIDE) {
      const row = params[o + P0]! + index * PATH_ROW + (direction === 1 ? 0 : EXIT_COLUMNS);
      const step = next * PATH_ROW;
      const x = params[row]!;
      const y = params[row + 1]!;
      const turn = params[row + 2]!;
      tx += x + (params[row + step]! - x) * mix;
      ty += y + (params[row + step + 1]! - y) * mix;
      rotation += turn + (params[row + step + 2]! - turn) * mix;
      continue;
    }

    const sample = params[o + FIRST]! + index;
    const from = samples[sample]!;
    const eased = from + (samples[sample + next]! - from) * mix;
    const rest = direction === 1 ? eased : 1 - eased;
    const away = 1 - rest;
    if (kind === FADE) {
      opacity *= 1 + (params[o + P0]! - 1) * away;
    } else {
      tx += params[o + P0]! * away;
      ty += params[o + P1]! * away;
      if (kind === EMERGE) {
        const depth = params[o + P2]!;
        const lag = params[o + P3]!;
        let lagged = rest >= 1 ? 1 : 0;
        if (lag < 1) lagged = Math.min(Math.max((rest - lag) / (1 - lag), 0), 1);
        brightness *= 1 - depth * (1 - lagged);
        shadowEdge = shadowed ? Math.max(shadowEdge, rest) : rest;
        shadowOpacity = Math.max(shadowOpacity, depth * away);
        shadowed = true;
      }
    }
  }

  out.tx = tx;
  out.ty = ty;
  out.rotationDeg = rotation;
  out.rotateXDeg = 0;
  out.rotateYDeg = 0;
  out.perspective = 0;
  out.scale = scale;
  out.opacity = opacity;
  out.brightness = brightness;
  out.shadowEdge = shadowEdge;
  out.shadowOpacity = shadowOpacity;
  return out;
}

/**
 * Sample the poses of one direction at `fps` into `out`, as rows of `LIVE_POSE_STRIDE` numbers
 * in {@link LivePose} field order, with no press blended in. Row `i` is the pose at `i / fps`
 * seconds, except the last, which is the pose at `c.duration`. Returns the row count,
 * `ceil(duration × fps) + 1`.
 *
 * Throws a `RangeError` for an `fps` that is not a finite number above 0, or an `out` too short
 * for the rows.
 */
export function sampleLivePosesInto(
  c: CompiledLive,
  direction: 1 | -1,
  fps: number,
  out: Float32Array,
): number {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`sampleLivePosesInto: fps must be a finite number above 0, got ${fps}`);
  }
  // The 1e-9 keeps a product that lands a rounding error above an integer from gaining a row.
  const rows = Math.ceil(c.duration * fps - 1e-9) + 1;
  if (out.length < rows * LIVE_POSE_STRIDE) {
    throw new RangeError(
      `sampleLivePosesInto: out needs ${rows * LIVE_POSE_STRIDE} numbers for ${rows} rows, got ${out.length}`,
    );
  }
  for (let i = 0; i < rows; i++) {
    livePoseAtInto(c, i === rows - 1 ? c.duration : i / fps, direction, 0, _row);
    const o = i * LIVE_POSE_STRIDE;
    out[o] = _row.tx;
    out[o + 1] = _row.ty;
    out[o + 2] = _row.rotationDeg;
    out[o + 3] = _row.rotateXDeg;
    out[o + 4] = _row.rotateYDeg;
    out[o + 5] = _row.perspective;
    out[o + 6] = _row.scale;
    out[o + 7] = _row.opacity;
    out[o + 8] = _row.brightness;
    out[o + 9] = _row.shadowEdge;
    out[o + 10] = _row.shadowOpacity;
  }
  return rows;
}
