/**
 * The shape this dashboard renders.
 *
 * Deliberately narrower than `benchmarks/src/results.ts`: that module is the
 * capture's own schema and carries fields no page reads. These types describe
 * what the UI actually requires, and `schema.ts` enforces them at build time —
 * so a field being optional here is a statement that the dashboard copes
 * without it, not a hedge against not knowing.
 */

export type MicrobenchResult = {
  scenario: string;
  medianNs: number;
  meanNs: number;
  minNs: number;
  /** Absent on captures older than result schema v2. */
  maxNs?: number;
  /** Only present when the row was captured with >= 100 samples. */
  p99Ns?: number;
  opsPerSec: number;
  samples: number;
  innerIters: number;
  /** Lowest and highest per-run median folded into this row; absent on a single-run capture. */
  bandMinNs?: number;
  bandMaxNs?: number;
};

export type MicrobenchSuite = {
  title: string;
  results: MicrobenchResult[];
};

export type MicrobenchHeap = {
  name: string;
  iterations: number;
  deltaBytes: number;
  bytesPerFrame: number;
  /** Frames run before measurement began, reaching the allocation plateau. */
  warmupFrames: number;
  /** False when the warm-up budget expired before the heap settled. */
  converged: boolean;
  plateauHeapMB: number;
  /**
   * Per-frame resolution of this row. A `bytesPerFrame` below it means "under
   * the instrument's resolution", never "zero" — required, because rendering a
   * sub-resolution reading as a plain number is how GC noise acquired red and
   * green bars on this page.
   */
  resolutionBytesPerFrame: number;
  bandMinBytesPerFrame?: number;
  bandMaxBytesPerFrame?: number;
};

export type MicrobenchReport = {
  schemaVersion: number;
  generated: string;
  runtime: string;
  platform: string;
  cpuModel?: string;
  gitSha?: string;
  devFlag?: string;
  /** Percent of the machine busy with other processes during the capture. */
  foreignLoadPercent?: number;
  runs?: number;
  suites: MicrobenchSuite[];
  heap: MicrobenchHeap[];
};

export type DeviceLoad = {
  label: string;
  entities?: number;
  particles?: number;
  fps: number[];
};

export type DeviceRun = {
  device: string;
  os: string;
  notes?: string;
  loads: DeviceLoad[];
};

export type DeviceReport = {
  generated: string;
  /** Set when the capture can no longer be refreshed; `staleReason` says why. */
  stale?: boolean;
  staleReason?: string;
  devices: DeviceRun[];
};

/**
 * The web lane's provenance schema: `{ commit, host, runtime, appVersion, unit }` plus browser
 * identity, present on every record below — never only on an enclosing envelope. `runtime` is
 * always the literal `'web-swiftshader'`: these are software-rasterized (SwiftShader,
 * `--disable-gpu`) numbers, not GPU-backed frame costs, and that string is what stops this lane
 * ever mixing into the node lane's `runtime: "Bun x.y.z"` series.
 */
export type WebProvenance = {
  commit: string;
  host: string;
  runtime: 'web-swiftshader';
  appVersion: string;
  browserName: string;
  browserVersion: string;
  capturedAt: string;
};

export type WebRenderResult = WebProvenance & {
  kind: 'render';
  name: string;
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  unit: 'ms';
};

export type WebPayloadResult = WebProvenance & {
  kind: 'payload';
  name: string;
  bytes: number;
  unit: 'bytes';
};

export type WebNetworkProfile = {
  downloadThroughputBytesPerSec: number;
  uploadThroughputBytesPerSec: number;
  latencyMs: number;
};

export type WebColdStartResult = WebProvenance & {
  kind: 'coldStart';
  name: string;
  ms: number;
  unit: 'ms';
  /** Present only on the throttled variants — null on the untouched-network pair. */
  network: WebNetworkProfile | null;
};

export type WebReport = {
  schemaVersion: number;
  generated: string;
  render: WebRenderResult[];
  payload: WebPayloadResult[];
  coldStart: WebColdStartResult[];
};
