import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchStats } from './harness.js';
import type { HeapDeltaResult } from './integration.bench.js';

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

export function statsToResult(s: BenchStats): MicrobenchResult {
  return {
    scenario: s.name,
    medianNs: s.nsPerOp.median,
    meanNs: s.nsPerOp.mean,
    minNs: s.nsPerOp.min,
    p99Ns: s.nsPerOp.p99,
    opsPerSec: s.opsPerSec,
    samples: s.samples,
    innerIters: s.innerIters,
  };
}

export function heapToResult(h: HeapDeltaResult): MicrobenchHeap {
  return {
    name: h.name,
    iterations: h.iterations,
    deltaBytes: h.deltaBytes,
    bytesPerFrame: h.bytesPerFrame,
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));

export function resultsDir(): string {
  return resolve(HERE, '..', 'results');
}

export function writeMicrobenchJson(report: MicrobenchReport): string {
  const dir = resultsDir();
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'microbench.json');
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return file;
}
