import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, totalmem } from 'node:os';
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

/**
 * Machine + code fingerprint of a capture. Optional because baselines captured
 * before provenance existed still have to render; every new capture sets all of
 * them. Cross-machine comparison of rows with differing `cpuModel` or `runtime`
 * is not meaningful — automation must key on these, not just on the date.
 *
 * Deliberately excludes hostname: this repo goes public, and the machine name
 * adds nothing the CPU model does not already say.
 */
export type Provenance = {
  cpuModel?: string;
  cpuCount?: number;
  totalMemMB?: number;
  gitSha?: string;
  gitDirty?: boolean;
};

export type MicrobenchReport = Provenance & {
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

export function repoRoot(): string {
  return resolve(HERE, '..', '..');
}

export function baselineFile(): string {
  return resolve(resultsDir(), 'microbench.json');
}

export function historyFile(): string {
  return resolve(resultsDir(), 'history.ndjson');
}

export function benchmarksDocFile(): string {
  return resolve(repoRoot(), 'docs', 'references', 'benchmarks.md');
}

function gitOutput(args: string[]): string | null {
  try {
    const proc = Bun.spawnSync(['git', ...args], {
      cwd: repoRoot(),
      stdout: 'pipe',
      stderr: 'ignore',
    });
    if (!proc.success) return null;
    return proc.stdout.toString().trim();
  } catch {
    return null;
  }
}

export function collectProvenance(): Provenance {
  const cores = cpus();
  const sha = gitOutput(['rev-parse', '--short=12', 'HEAD']);
  // Scoped to what can actually change a measurement. An unscoped probe would
  // see this run's own history.ndjson append and report every capture after the
  // first as dirty, turning the flag into noise.
  const status = gitOutput(['status', '--porcelain', '--', 'packages', 'benchmarks/src']);
  return {
    cpuModel: cores[0]?.model.trim() ?? 'unknown',
    cpuCount: cores.length,
    totalMemMB: Math.round(totalmem() / (1024 * 1024)),
    gitSha: sha ?? 'unknown',
    gitDirty: status === null ? false : status.length > 0,
  };
}

/**
 * Overwrites the committed baseline. Only ever called behind an explicit
 * `--write-baseline`: the baseline is the comparison reference for every future
 * run, so a plain capture must not be able to destroy it as a side effect.
 */
export function writeMicrobenchJson(report: MicrobenchReport): string {
  const dir = resultsDir();
  mkdirSync(dir, { recursive: true });
  const file = baselineFile();
  writeFileAtomic(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export function readMicrobenchJson(): MicrobenchReport | null {
  try {
    return JSON.parse(readFileSync(baselineFile(), 'utf8')) as MicrobenchReport;
  } catch {
    return null;
  }
}

/** Append-only run log. Every capture lands here; nothing ever rewrites a row. */
export function appendHistoryRow(report: MicrobenchReport): string {
  const dir = resultsDir();
  mkdirSync(dir, { recursive: true });
  const file = historyFile();
  appendFileSync(file, `${JSON.stringify(report)}\n`, 'utf8');
  return file;
}

/**
 * Writes via a temp file + rename so an interrupted or crashing run can never
 * leave a truncated published doc behind (a shell `>` redirection truncates the
 * target at spawn, minutes before the first byte of output exists).
 */
export function writeFileAtomic(file: string, contents: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, contents, 'utf8');
    renameSync(tmp, file);
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}
