import type { PerfReport } from './perf-recorder.js';

export const PERF_BENCH_TAG = '[perf-bench]';

export function emitPerfReport(report: PerfReport): void {
  console.log(`${PERF_BENCH_TAG} ${JSON.stringify(report)}`);
}
