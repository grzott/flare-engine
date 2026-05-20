export { type DebugStats, StatsTracker } from './stats.js';

export { TimeControl } from './time-control.js';

export {
  type OverlayFlags,
  type DebugRect,
  type DebugCircle,
  type DebugLine,
  type DebugDrawCommand,
  DebugOverlay,
} from './overlay.js';

export { type FpsWidget, type FpsWidgetOptions, createFpsWidget } from './fps-widget.js';

export {
  type FrameBudgetLimits,
  type FrameBudgetSnapshot,
  type FrameBudgetHandle,
  createFrameBudget,
} from './frame-budget.js';

export { type BootEntry, type BootTraceHandle, createBootTrace } from './boot-trace.js';

export {
  type PerfSectionStats,
  type PerfCounterStats,
  type PerfReport,
  type PerfRecorderHandle,
  createPerfRecorder,
} from './perf-recorder.js';

export { PERF_BENCH_TAG, emitPerfReport } from './perf-output.js';
