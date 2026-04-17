export type MicrobenchResult = {
  scenario: string;
  medianNs: number;
  meanNs: number;
  minNs: number;
  p99Ns: number;
  opsPerSec: number;
  samples: number;
  innerIters: number;
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
};

export type MicrobenchReport = {
  generated: string;
  runtime: string;
  platform: string;
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
