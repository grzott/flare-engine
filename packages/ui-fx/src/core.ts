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
  type Placement,
  type PlacementOptions,
  placeFloatingInto,
  type RectLike,
} from './core/placement';
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
