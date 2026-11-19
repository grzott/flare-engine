export const UI_FX_ENTRY = 'core';

export {
  directionInto,
  type Edge,
  type OriginSpec,
  resolveEdge,
  resolveOriginInto,
  type Vec2Out,
} from './core/conventions';
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
