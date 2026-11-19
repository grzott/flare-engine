export const UI_FX_ENTRY = 'core';

export {
  directionInto,
  type Edge,
  type OriginSpec,
  resolveEdge,
  resolveOriginInto,
  type Vec2Out,
} from './core/conventions';
export { createFractureCache } from './core/fracture/cache';
export { cellGridFor } from './core/fracture/cells';
export { clipPolygonToUnitInto } from './core/fracture/clip';
export { generateFracture } from './core/fracture/generate';
export { packShardsInto } from './core/fracture/pack';
export type { FractureCache, FractureMesh, ShardPacking } from './core/fracture/types';
export {
  type CompiledLive,
  compileLive,
  LIVE_POSE_STRIDE,
  type LivePose,
  livePoseAtInto,
  sampleLivePosesInto,
} from './core/live';
export { initFragmentsInto, packPhysicsInto } from './core/motion/init';
export {
  A0,
  ADRAG,
  CX,
  DELAY,
  DEPTH,
  DRAG,
  FADE_START,
  FRAG_STRIDE,
  GX,
  GY,
  HX,
  HY,
  LIFE,
  MASS,
  OMEGA,
  OMEGA0,
  OP0,
  OP1,
  PHYS_LEN,
  REVERSE_MODE,
  SC0,
  SC1,
  SRC,
  TOTAL,
  VX,
  VY,
  VZ,
  ZETA,
} from './core/motion/layout';
export { type FragmentPose, fragmentPoseInto } from './core/motion/pose';
export {
  type ArcTable,
  buildArcTable,
  type PathPose,
  pathPoseAtInto,
} from './core/path/arc-table';
export { parseSvgPath } from './core/path/svg';
export {
  type Placement,
  type PlacementOptions,
  placeFloatingInto,
  type RectLike,
} from './core/placement';
export {
  type DeepPartial,
  type DisintegratePreset,
  type DustPreset,
  disintegrate,
  dust,
  type EmergePreset,
  emerge,
  type FadePreset,
  type FlarePreset,
  type ForceSpec,
  type FragmentPresetOptions,
  type FragmentReverse,
  type FragmentSpec,
  fade,
  type IsUnion,
  isSnapshotPreset,
  type LifeSpec,
  type LivePreset,
  liveFallbackOf,
  type PathSpec,
  type PhysicsSpec,
  type PresetCommon,
  type PresetOptions,
  type PressPreset,
  presetDuration,
  press,
  type ReleaseSpec,
  type ShatterPreset,
  type SlidePreset,
  type SnapshotPreset,
  shatter,
  slide,
} from './core/presets';
export { createStream, nextUnit, type PrngStream } from './core/prng';
export { createPresetRegistry, type PresetRef, type PresetRegistry } from './core/registry';
export {
  delay,
  type FlareTimeline,
  liveEntries,
  parallel,
  sequence,
  snapshotEntry,
  stagger,
  type TimelineEntry,
} from './core/timeline';
export {
  compileTiming,
  type EasingName,
  type EasingSpec,
  type ResolvedSpring,
  resolveSpring,
  type SpringSpec,
  springSettleTime,
  springStepAt,
  type TimingInput,
  type TimingTable,
  timingAt,
  timingToCssLinear,
} from './core/timing';
export { layoutToastStackInto, type ToastStackOptions } from './core/toast-layout';
