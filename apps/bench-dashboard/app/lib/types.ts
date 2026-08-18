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
 * always `'web-cpu-raster'` — an offscreen `CanvasKit.MakeSurface`, CPU-backed by construction,
 * not GPU-backed frame costs — and that string is what stops this lane ever mixing into the node
 * lane's `runtime: "Bun x.y.z"` series. `'web-swiftshader'` is also accepted: it is this same
 * CPU-raster lane's old (factually wrong — SwiftShader is a GL implementation, and this surface
 * never touches GL) label, kept only so already-committed `web.json` / `web-history.ndjson`
 * records captured before the rename still parse. Never emitted by a fresh capture.
 */
/** Every lane's label. `web-swiftshader` is the pre-rename spelling of `web-cpu-raster` and is
 *  accepted only where that lane is expected — see `parseWebProvenance`, which takes the set valid
 *  for the lane being parsed rather than accepting any of these anywhere. */
export type WebRuntimeLabel = 'web-cpu-raster' | 'web-swiftshader' | 'web-gpu' | 'web-android-gpu';

/** Hardware identity, read from `getprop` at capture time. Present only on on-device records. */
export type WebDeviceInfo = {
  model: string;
  codename: string;
  soc: string;
  androidRelease: string;
};

export type WebProvenance = {
  commit: string;
  host: string;
  runtime: WebRuntimeLabel;
  appVersion: string;
  browserName: string;
  browserVersion: string;
  capturedAt: string;
  /** `UNMASKED_RENDERER_WEBGL`. Present on the GPU-backed lanes, absent on CPU-raster. */
  rendererString?: string;
  device?: WebDeviceInfo;
};

export type WebRenderResult = WebProvenance & {
  kind: 'render';
  name: string;
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Median repetitions per measured batch. Required: a row without it predates the 2026-08-18
   *  sampler fix, when web figures were quantized to the display refresh interval and the cheap
   *  rows reported the refresh rate rather than any cost. Such a row must not render. */
  opsPerBatch: number;
  batchMs: number;
  frameDeltaMs: number;
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

/**
 * The desktop-GPU and on-device lanes. Render scenarios only, by design: payload bytes are
 * backend-agnostic and cold start is defined against the CPU-raster surface, so re-running either
 * through a different target would duplicate the CPU-raster figures under a misleading label.
 */
export type WebRenderOnlyReport = {
  schemaVersion: number;
  generated: string;
  render: WebRenderResult[];
};
