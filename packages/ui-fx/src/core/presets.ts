import type { Edge, OriginSpec } from './conventions';
import { resolveSpring, springSettleTime, type TimingInput } from './timing';

/**
 * A motion path in element pixels: `cubic` is groups of 8 numbers (p0, c1, c2, p3), `points` is
 * x, y pairs joined by a Catmull-Rom spline, `svg` is SVG path data.
 */
export type PathSpec =
  | { cubic: readonly number[] }
  | { points: readonly number[]; curviness?: number }
  | { svg: string };

/** Fields every preset accepts: its timing, and what plays instead under reduced motion. */
export interface PresetCommon extends TimingInput {
  reduceMotion?: 'system' | 'always' | 'never';
  fallback?: LivePreset;
}

/** `opacity` is the away state: enter animates from it to 1, exit from 1 to it. */
export interface FadePreset {
  kind: 'fade';
  opacity: number;
}

export interface SlidePreset {
  kind: 'slide';
  from: Edge | { angle: number; distance: number } | { x: number; y: number };
  distance: number;
  path: PathSpec | null;
  alignOrigin: { x: number; y: number };
  autoRotate: boolean | number;
  rotationLimit: number;
  start: number;
  end: number;
}

export interface PressPreset {
  kind: 'press';
  scale: number;
  opacity: number;
  brightness: number;
}

export interface EmergePreset {
  kind: 'emerge';
  variant: 'live' | 'shader';
  angle: number;
  softness: number;
  falloff: 'linear' | 'smoothstep' | 'exp';
  distance: number;
  shadow: { color: string; opacity: number; lag: number; blur: number; length: number };
  sheen: { width: number; intensity: number; color: string; delay: number } | null;
}

export interface FragmentSpec {
  pattern: 'grid' | 'jittered-grid' | 'triangles' | 'radial-glass' | 'cells';
  count: number;
  cell: number;
  distribution: 'uniform' | 'normal' | 'inverse-normal' | 'exponential';
  focus: OriginSpec;
  deviation: number;
  jitter: number;
  anisotropy: { x: number; y: number };
  gap: number;
  rotation: number;
  seed: number;
  subdivide: { depth: number; chance: number; select: 'near-impact' | 'small' | 'random' } | null;
}

/** `radius` is in element diagonals, `strength` in px/s; a negative strength pulls. */
export interface ForceSpec {
  kind: 'radial' | 'directional' | 'vortex' | 'implode';
  origin: OriginSpec;
  radius: number;
  strength: number;
  falloff: 'none' | 'linear' | 'inverse-square' | 'smoothstep';
  angle: number;
  spread: number;
}

/** `duration` is the time the release front takes to cross the element. */
export interface ReleaseSpec {
  order: 'radial' | 'sweep' | 'random';
  duration: number;
  softness: number;
  timingRandomness: number;
  angle: number;
}

export interface PhysicsSpec {
  gravity: number;
  gravityAngle: number;
  drag: number;
  angularDrag: number;
  spin: number;
  randomness: number;
  massVariance: number;
  depth: number;
  collide: 'none' | 'floor' | 'bounds';
}

/** `opacity` and `scale` are `[at birth, at death]`; `fadeStart` is a fraction of the lifetime. */
export interface LifeSpec {
  opacity: [number, number];
  scale: [number, number];
  lifetime: number;
  lifetimeVariance: number;
  fadeStart: number;
}

/** How a fragment preset plays as an enter (assemble-in). */
export type FragmentReverse = 'rewind' | 'home' | 'spring-home';

export interface ShatterPreset {
  kind: 'shatter';
  fragment: FragmentSpec;
  forces: readonly ForceSpec[];
  release: ReleaseSpec;
  physics: PhysicsSpec;
  life: LifeSpec;
  reverse: FragmentReverse;
  maxFragments: number;
}

export interface DisintegratePreset {
  kind: 'disintegrate';
  fragment: FragmentSpec;
  forces: readonly ForceSpec[];
  release: ReleaseSpec;
  physics: PhysicsSpec;
  life: LifeSpec;
  reverse: FragmentReverse;
  maxFragments: number;
}

export interface DustPreset {
  kind: 'dust';
  sweepAngle: number;
  noiseScale: number;
  noiseAmount: number;
  softness: number;
  edgeWidth: number;
  edgeColor: string;
  spread: number;
  grainsAtFront: number;
  seed: number;
}

/** Presets that animate the live element's own style. */
export type LivePreset =
  | FadePreset
  | SlidePreset
  | PressPreset
  | (EmergePreset & { variant: 'live' });

/** Presets that hide the element and animate a capture of it. */
export type SnapshotPreset =
  | ShatterPreset
  | DisintegratePreset
  | DustPreset
  | (EmergePreset & { variant: 'shader' });

export type FlarePreset = (LivePreset | SnapshotPreset) & PresetCommon;

/** `true` when `T` is a union; `DeepPartial` uses it to leave union-typed fields whole. */
export type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/**
 * Options for a preset factory. Plain nested objects are optional key by key and merge over the
 * defaults; a list takes partial elements, each merged over the default element; anything typed
 * as a union (`from`, `focus`, `sheen`, …) or a tuple is given whole and replaces the default.
 */
export type DeepPartial<T> =
  IsUnion<T> extends true
    ? T
    : T extends readonly unknown[]
      ? number extends T['length']
        ? readonly DeepPartial<T[number]>[]
        : T
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

/** What a preset factory accepts: any part of the preset, plus the common fields. */
export type PresetOptions<P> = DeepPartial<Omit<P, 'kind'>> & PresetCommon;

const SHARD_CAP = 300;
const CELL_CAP = 3000;

function check(
  name: string,
  field: string,
  value: number,
  min: number,
  max: number,
  integer = false,
): void {
  // Number.isFinite also turns away non-numbers that the comparisons would coerce.
  if (
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  ) {
    return;
  }
  let wanted: string;
  if (max !== Number.POSITIVE_INFINITY) {
    wanted = `${integer ? 'an integer in' : 'in'} ${min}..${max}`;
  } else if (min !== Number.NEGATIVE_INFINITY) {
    wanted = `${integer ? 'an integer' : 'a finite number'} >= ${min}`;
  } else {
    wanted = integer ? 'an integer' : 'a finite number';
  }
  throw new RangeError(`${name}: ${field} must be ${wanted}, got ${value}`);
}

const checkFinite = (name: string, field: string, value: number): void =>
  check(name, field, value, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);

const checkMin0 = (name: string, field: string, value: number): void =>
  check(name, field, value, 0, Number.POSITIVE_INFINITY);

const checkUnit = (name: string, field: string, value: number): void =>
  check(name, field, value, 0, 1);

function checkOrigin(name: string, field: string, origin: OriginSpec): void {
  if (typeof origin === 'string') return;
  checkFinite(name, `${field}.x`, origin.x);
  checkFinite(name, `${field}.y`, origin.y);
}

/** `base` with every defined key of `over` on top. */
function merge<T extends object>(base: T, over: Partial<T> | undefined): T {
  const out = { ...base };
  if (over === undefined) return out;
  for (const key of Object.keys(over) as (keyof T)[]) {
    const value = over[key];
    if (value !== undefined) out[key] = value as T[keyof T];
  }
  return out;
}

/**
 * A deeply frozen copy without `undefined` keys. Already-frozen objects are kept as they are, so
 * a preset passed as `fallback` keeps its identity, and nothing the caller owns gets frozen.
 */
function frozenCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = frozenCopy(entry);
  }
  return Object.freeze(out) as T;
}

/**
 * The validated common fields. A spring sets its own duration, so the default duration and easing
 * apply only without one.
 */
function commonOf(
  name: string,
  opts: PresetCommon,
  defaultDuration?: number,
  defaultEasing?: TimingInput['easing'],
): PresetCommon {
  const { spring, delay, fallback } = opts;
  let duration = opts.duration;
  let easing = opts.easing;
  if (spring !== undefined) {
    if (duration !== undefined || easing !== undefined) {
      throw new RangeError(
        `${name}: a spring sets its own duration; do not combine it with duration or easing`,
      );
    }
    resolveSpring(spring);
  } else {
    duration ??= defaultDuration;
    easing ??= defaultEasing;
  }
  if (duration !== undefined) checkMin0(name, 'duration', duration);
  if (delay !== undefined) checkMin0(name, 'delay', delay);
  if (fallback !== undefined && isSnapshotPreset(fallback)) {
    throw new RangeError(`${name}: fallback must be a live preset`);
  }
  return { duration, easing, spring, delay, reduceMotion: opts.reduceMotion, fallback };
}

/** Fade between opacity 1 and the away `opacity`. Defaults: `opacity 0`, `duration 0.25`. */
export function fade(opts: PresetOptions<FadePreset> = {}): FadePreset & PresetCommon {
  const opacity = opts.opacity ?? 0;
  checkUnit('fade', 'opacity', opacity);
  return frozenCopy({ kind: 'fade', opacity, ...commonOf('fade', opts, 0.25) });
}

const SLIDE_ALIGN_ORIGIN = { x: 0.5, y: 0.5 };

/**
 * Slide in from an edge, a direction of travel or a pixel offset, optionally along a path.
 * Defaults: from the `'bottom'` edge, `distance 48`, `duration 0.35`, `easing 'easeOutCubic'`, no
 * path.
 */
export function slide(opts: PresetOptions<SlidePreset> = {}): SlidePreset & PresetCommon {
  const from = opts.from ?? 'bottom';
  const distance = opts.distance ?? 48;
  const alignOrigin = merge(SLIDE_ALIGN_ORIGIN, opts.alignOrigin);
  const autoRotate = opts.autoRotate ?? false;
  const rotationLimit = opts.rotationLimit ?? 180;
  const start = opts.start ?? 0;
  const end = opts.end ?? 1;

  if (typeof from !== 'string') {
    if ('angle' in from) {
      checkFinite('slide', 'from.angle', from.angle);
      checkMin0('slide', 'from.distance', from.distance);
    } else {
      checkFinite('slide', 'from.x', from.x);
      checkFinite('slide', 'from.y', from.y);
    }
  }
  checkMin0('slide', 'distance', distance);
  checkFinite('slide', 'alignOrigin.x', alignOrigin.x);
  checkFinite('slide', 'alignOrigin.y', alignOrigin.y);
  if (typeof autoRotate === 'number') checkFinite('slide', 'autoRotate', autoRotate);
  checkMin0('slide', 'rotationLimit', rotationLimit);
  checkFinite('slide', 'start', start);
  checkFinite('slide', 'end', end);

  return frozenCopy({
    kind: 'slide',
    from,
    distance,
    path: opts.path ?? null,
    alignOrigin,
    autoRotate,
    rotationLimit,
    start,
    end,
    ...commonOf('slide', opts, 0.35, 'easeOutCubic'),
  });
}

/** The pressed-in pose. Defaults: `scale 0.96`, `opacity 1`, `brightness 1`, `duration 0.12`. */
export function press(opts: PresetOptions<PressPreset> = {}): PressPreset & PresetCommon {
  const scale = opts.scale ?? 0.96;
  const opacity = opts.opacity ?? 1;
  const brightness = opts.brightness ?? 1;
  checkMin0('press', 'scale', scale);
  checkUnit('press', 'opacity', opacity);
  checkMin0('press', 'brightness', brightness);
  return frozenCopy({
    kind: 'press',
    scale,
    opacity,
    brightness,
    ...commonOf('press', opts, 0.12),
  });
}

const EMERGE_SHADOW: EmergePreset['shadow'] = {
  color: '#000',
  opacity: 0.6,
  lag: 0.3,
  blur: 8,
  length: 0,
};

/**
 * Rise out of the surface behind a moving shadow edge. `variant 'live'` animates the element's
 * style; `'shader'` is a snapshot effect. Defaults: `variant 'live'`, `angle 135`, `softness 0.4`,
 * `falloff 'smoothstep'`, `distance 12`, `duration 0.45`, no sheen.
 */
export function emerge(opts: PresetOptions<EmergePreset> = {}): EmergePreset & PresetCommon {
  const angle = opts.angle ?? 135;
  const softness = opts.softness ?? 0.4;
  const distance = opts.distance ?? 12;
  const shadow = merge(EMERGE_SHADOW, opts.shadow);
  const sheen = opts.sheen ?? null;

  checkFinite('emerge', 'angle', angle);
  checkUnit('emerge', 'softness', softness);
  checkMin0('emerge', 'distance', distance);
  checkUnit('emerge', 'shadow.opacity', shadow.opacity);
  checkUnit('emerge', 'shadow.lag', shadow.lag);
  checkMin0('emerge', 'shadow.blur', shadow.blur);
  checkMin0('emerge', 'shadow.length', shadow.length);
  if (sheen !== null) {
    checkMin0('emerge', 'sheen.width', sheen.width);
    checkMin0('emerge', 'sheen.intensity', sheen.intensity);
    checkMin0('emerge', 'sheen.delay', sheen.delay);
  }

  return frozenCopy({
    kind: 'emerge',
    variant: opts.variant ?? 'live',
    angle,
    softness,
    falloff: opts.falloff ?? 'smoothstep',
    distance,
    shadow,
    sheen,
    ...commonOf('emerge', opts, 0.45),
  });
}

type FragmentBody = Omit<ShatterPreset, 'kind'>;

const SHATTER_FORCE: ForceSpec = {
  kind: 'radial',
  origin: 'press',
  radius: 1.5,
  strength: 900,
  falloff: 'linear',
  angle: 0,
  spread: 30,
};

const SHATTER_BODY: FragmentBody = {
  fragment: {
    pattern: 'radial-glass',
    count: 40,
    cell: 4,
    distribution: 'uniform',
    focus: 'press',
    deviation: 0.2,
    jitter: 0.5,
    anisotropy: { x: 1, y: 1 },
    gap: 0,
    rotation: 0,
    seed: 1,
    subdivide: null,
  },
  forces: [SHATTER_FORCE],
  release: { order: 'radial', duration: 0.15, softness: 0.5, timingRandomness: 0.2, angle: 90 },
  physics: {
    gravity: 1800,
    gravityAngle: 180,
    drag: 1.2,
    angularDrag: 0.8,
    spin: 360,
    randomness: 0.35,
    massVariance: 0.3,
    depth: 0,
    collide: 'none',
  },
  life: {
    opacity: [1, 0],
    scale: [1, 0.85],
    lifetime: 0.9,
    lifetimeVariance: 0.25,
    fadeStart: 0.55,
  },
  reverse: 'home',
  maxFragments: SHARD_CAP,
};

const DISINTEGRATE_BODY: FragmentBody = {
  ...SHATTER_BODY,
  fragment: { ...SHATTER_BODY.fragment, pattern: 'cells', cell: 4 },
  release: { ...SHATTER_BODY.release, order: 'sweep', angle: 90, duration: 0.5 },
  maxFragments: CELL_CAP,
};

function fragmentBodyOf(
  name: string,
  base: FragmentBody,
  cap: number,
  opts: PresetOptions<FragmentBody>,
): FragmentBody & PresetCommon {
  const { anisotropy, ...fragmentFlat } = opts.fragment ?? {};
  const fragment: FragmentSpec = {
    ...merge(base.fragment, fragmentFlat),
    anisotropy: merge(base.fragment.anisotropy, anisotropy),
  };
  const forces =
    opts.forces === undefined ? base.forces : opts.forces.map((f) => merge(SHATTER_FORCE, f));
  const release = merge(base.release, opts.release);
  const physics = merge(base.physics, opts.physics);
  const life = merge(base.life, opts.life);
  const maxFragments = opts.maxFragments ?? base.maxFragments;

  check(name, 'fragment.count', fragment.count, 2, SHARD_CAP, true);
  check(name, 'fragment.cell', fragment.cell, 1, 8);
  checkOrigin(name, 'fragment.focus', fragment.focus);
  check(name, 'fragment.deviation', fragment.deviation, 0.01, 0.7);
  checkUnit(name, 'fragment.jitter', fragment.jitter);
  checkMin0(name, 'fragment.anisotropy.x', fragment.anisotropy.x);
  checkMin0(name, 'fragment.anisotropy.y', fragment.anisotropy.y);
  checkMin0(name, 'fragment.gap', fragment.gap);
  checkFinite(name, 'fragment.rotation', fragment.rotation);
  check(name, 'fragment.seed', fragment.seed, 0, 0xffffffff, true);
  if (fragment.subdivide !== null) {
    check(name, 'fragment.subdivide.depth', fragment.subdivide.depth, 0, Infinity, true);
    checkUnit(name, 'fragment.subdivide.chance', fragment.subdivide.chance);
  }

  check(name, 'forces.length', forces.length, 0, 2, true);
  for (let i = 0; i < forces.length; i++) {
    const force = forces[i]!;
    checkOrigin(name, `forces[${i}].origin`, force.origin);
    checkMin0(name, `forces[${i}].radius`, force.radius);
    checkFinite(name, `forces[${i}].strength`, force.strength);
    checkFinite(name, `forces[${i}].angle`, force.angle);
    checkMin0(name, `forces[${i}].spread`, force.spread);
  }

  checkMin0(name, 'release.duration', release.duration);
  checkUnit(name, 'release.softness', release.softness);
  checkUnit(name, 'release.timingRandomness', release.timingRandomness);
  checkFinite(name, 'release.angle', release.angle);

  checkFinite(name, 'physics.gravity', physics.gravity);
  checkFinite(name, 'physics.gravityAngle', physics.gravityAngle);
  checkMin0(name, 'physics.drag', physics.drag);
  checkMin0(name, 'physics.angularDrag', physics.angularDrag);
  checkFinite(name, 'physics.spin', physics.spin);
  checkUnit(name, 'physics.randomness', physics.randomness);
  checkUnit(name, 'physics.massVariance', physics.massVariance);
  checkFinite(name, 'physics.depth', physics.depth);

  for (let i = 0; i < 2; i++) {
    checkUnit(name, `life.opacity[${i}]`, life.opacity[i]!);
    checkMin0(name, `life.scale[${i}]`, life.scale[i]!);
  }
  checkMin0(name, 'life.lifetime', life.lifetime);
  checkUnit(name, 'life.lifetimeVariance', life.lifetimeVariance);
  checkUnit(name, 'life.fadeStart', life.fadeStart);

  check(name, 'maxFragments', maxFragments, 1, cap, true);

  return {
    fragment,
    forces,
    release,
    physics,
    life,
    reverse: opts.reverse ?? base.reverse,
    maxFragments,
    ...commonOf(name, opts),
  };
}

/**
 * Break a capture of the element into shards thrown by up to two forces. Defaults: 40
 * `'radial-glass'` shards around the press point, one radial force of 900 px/s, gravity 1800
 * downward, lifetime 0.9, `reverse 'home'`, `maxFragments 300`.
 *
 * The run length comes from `release` and `life` (see {@link presetDuration}), not `duration`.
 */
export function shatter(opts: PresetOptions<ShatterPreset> = {}): ShatterPreset & PresetCommon {
  return frozenCopy({
    kind: 'shatter',
    ...fragmentBodyOf('shatter', SHATTER_BODY, SHARD_CAP, opts),
  });
}

/**
 * {@link shatter} with grain-sized pieces: `pattern 'cells'` at `cell 4` px, released by a 0.5 s
 * sweep travelling at 90°, `maxFragments 3000`.
 */
export function disintegrate(
  opts: PresetOptions<DisintegratePreset> = {},
): DisintegratePreset & PresetCommon {
  return frozenCopy({
    kind: 'disintegrate',
    ...fragmentBodyOf('disintegrate', DISINTEGRATE_BODY, CELL_CAP, opts),
  });
}

/**
 * Dissolve a capture of the element behind a noisy front. Defaults: `sweepAngle 90`,
 * `noiseScale 24`, `noiseAmount 0.6`, `softness 0.15`, `edgeWidth 0.04`, `edgeColor '#ffffff'`,
 * `spread 48`, `grainsAtFront 0`, `duration 1.2`.
 */
export function dust(opts: PresetOptions<DustPreset> = {}): DustPreset & PresetCommon {
  const sweepAngle = opts.sweepAngle ?? 90;
  const noiseScale = opts.noiseScale ?? 24;
  const noiseAmount = opts.noiseAmount ?? 0.6;
  const softness = opts.softness ?? 0.15;
  const edgeWidth = opts.edgeWidth ?? 0.04;
  const spread = opts.spread ?? 48;
  const grainsAtFront = opts.grainsAtFront ?? 0;
  const seed = opts.seed ?? 1;

  checkFinite('dust', 'sweepAngle', sweepAngle);
  checkMin0('dust', 'noiseScale', noiseScale);
  checkUnit('dust', 'noiseAmount', noiseAmount);
  checkUnit('dust', 'softness', softness);
  checkUnit('dust', 'edgeWidth', edgeWidth);
  checkMin0('dust', 'spread', spread);
  checkMin0('dust', 'grainsAtFront', grainsAtFront);
  check('dust', 'seed', seed, 0, 0xffffffff, true);

  return frozenCopy({
    kind: 'dust',
    sweepAngle,
    noiseScale,
    noiseAmount,
    softness,
    edgeWidth,
    edgeColor: opts.edgeColor ?? '#ffffff',
    spread,
    grainsAtFront,
    seed,
    ...commonOf('dust', opts, 1.2),
  });
}

/** Whether a preset animates a capture of the element rather than the element itself. */
export function isSnapshotPreset(p: LivePreset | SnapshotPreset): p is SnapshotPreset {
  return (
    p.kind === 'shatter' ||
    p.kind === 'disintegrate' ||
    p.kind === 'dust' ||
    (p.kind === 'emerge' && p.variant === 'shader')
  );
}

const DEFAULT_FALLBACK = /* @__PURE__ */ fade({ opacity: 0, duration: 0.15 });

/**
 * The live preset that stands in for `p` under reduced motion or without a snapshot runtime: its
 * own `fallback`, or `fade({ opacity: 0, duration: 0.15 })`.
 */
export function liveFallbackOf(p: FlarePreset): LivePreset {
  return p.fallback ?? DEFAULT_FALLBACK;
}

/**
 * Seconds from trigger to rest, delay included. A spring lasts its settle time. A fragment preset
 * lasts `release.duration + life.lifetime × (1 + life.lifetimeVariance)`, the latest release plus
 * the longest life, whatever its `duration` says.
 */
export function presetDuration(p: FlarePreset): number {
  const delay = p.delay ?? 0;
  if (p.kind === 'shatter' || p.kind === 'disintegrate') {
    return delay + p.release.duration + p.life.lifetime * (1 + p.life.lifetimeVariance);
  }
  if (p.spring !== undefined) return delay + springSettleTime(resolveSpring(p.spring));
  return delay + (p.duration ?? 0);
}
