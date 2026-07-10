export { type BootEntry, type BootTraceHandle, createBootTrace } from './boot-trace.js';
export { createFpsWidget, type FpsWidget, type FpsWidgetOptions } from './fps-widget.js';
export {
  createFrameBudget,
  type FrameBudgetHandle,
  type FrameBudgetLimits,
  type FrameBudgetSnapshot,
} from './frame-budget.js';
export {
  type DebugCircle,
  type DebugDrawCommand,
  type DebugLine,
  DebugOverlay,
  type DebugRect,
  type OverlayFlags,
} from './overlay.js';
export { emitPerfReport, PERF_BENCH_TAG } from './perf-output.js';
export {
  createPerfRecorder,
  type PerfCounterStats,
  type PerfRecorderHandle,
  type PerfReport,
  type PerfSectionStats,
} from './perf-recorder.js';
export { type DebugStats, StatsTracker } from './stats.js';
export { TimeControl } from './time-control.js';
