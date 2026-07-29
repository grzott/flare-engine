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
  warmupFrames?: number;
  converged?: boolean;
  plateauHeapMB?: number;
};

export type MicrobenchReport = {
  schemaVersion?: number;
  generated: string;
  runtime: string;
  platform: string;
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
  devices: DeviceRun[];
};
