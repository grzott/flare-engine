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
import { readAffinity } from './affinity.js';
import type { AllocRow } from './alloc.js';
import type { BenchStats } from './harness.js';
import type { HeapProbeResult } from './heap-probe.js';
import { readPowerScheme } from './power.js';

/**
 * Bumped whenever a capture's shape changes in a way that makes old rows
 * un-foldable with new ones. `--promote` refuses a mixed window rather than
 * aggregating across the change: the first version of this schema had no
 * `maxNs` and always had `p99Ns`, and silently medianing the two together
 * produced a published number that was neither.
 */
export const SCHEMA_VERSION = 2;

export type MicrobenchResult = {
  scenario: string;
  medianNs: number;
  meanNs: number;
  minNs: number;
  maxNs: number;
  opsPerSec: number;
  samples: number;
  innerIters: number;
  /**
   * Present only on rows captured with enough samples for a percentile to mean
   * anything (`P99_MIN_SAMPLES`). Below that the 99th percentile is the top
   * sample under a more authoritative name, so `maxNs` carries it instead.
   */
  p99Ns?: number;
  /**
   * Lowest and highest per-run median across the runs folded into this row.
   * Absent on a single-run capture. This is the run-to-run spread of the
   * medians, not the intra-run sample spread — it answers "how much does this
   * number move if I measure again", which is the only question a regression
   * threshold can be set against.
   */
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
  /** Frames run before measurement started, reaching the allocation plateau. */
  warmupFrames: number;
  /** False when the warm-up budget expired before the heap settled. */
  converged: boolean;
  /** Resident heap at the end of the measured blocks. */
  plateauHeapMB: number;
  /** Measured blocks and their length — the doc states these rather than guessing. */
  blocks: number;
  blockFrames: number;
  /**
   * Per-frame resolution of this row: GC-scheduling noise divided by the block
   * length. A `bytesPerFrame` below it means "under the instrument's
   * resolution", not "zero".
   */
  resolutionBytesPerFrame: number;
  bandMinBytesPerFrame?: number;
  bandMaxBytesPerFrame?: number;
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
  /**
   * Percent of total CPU capacity consumed by OTHER processes while the timed
   * suites ran (B29). Absent on captures taken before this was measured; a
   * window mixing recorded and unrecorded runs is refused by `promote` rather
   * than judged, since "unrecorded" is not "quiet".
   */
  foreignLoadPercent?: number;
  /**
   * Active OS power plan GUID and its (localised) label at capture time. Absent on captures taken
   * before 2026-08-19, and `null`-ish on hosts that cannot report one. Recorded because Windows
   * "Power saver" was measured to make every scenario ~2.5x slower here — see `power.ts`.
   */
  powerSchemeGuid?: string;
  powerSchemeLabel?: string;
  /**
   * CPU affinity the capture ran under, as lower-case hex, plus how many logical processors that
   * selects. Absent on captures taken before 2026-08-20, and on hosts that cannot report one.
   * Recorded because an unpinned capture on a hybrid P+E host was measured to alternate between
   * two states run to run — see `affinity.ts`.
   */
  affinityMask?: string;
  affinityCpus?: number;
  /** Physical cores / logical processors the host reports, so `affinityMask` can be interpreted. */
  hostPhysicalCores?: number;
  hostLogicalCpus?: number;
};

export type MicrobenchReport = Provenance & {
  /** Absent on pre-2026-07-29 captures; treated as version 1. */
  schemaVersion?: number;
  generated: string;
  runtime: string;
  platform: string;
  /**
   * The `__DEV__` configuration the capture ran under. Load-bearing provenance,
   * not trivia: an undeclared `__DEV__` costs ~270 ns per guarded evaluation
   * under JSC and inflates the render rows ~7x (see dev-flag.ts).
   */
  devFlag?: 'true' | 'false' | 'undeclared';
  /** Number of independent capture runs folded in; absent on a single-run capture. */
  runs?: number;
  /** `generated` of every run folded in, oldest first. */
  aggregatedFrom?: string[];
  suites: MicrobenchSuite[];
  heap: MicrobenchHeap[];
  /** Exact-integer draw-path counters. Absent on pre-schema-2 captures. */
  alloc?: AllocRow[];
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

export function statsToResult(s: BenchStats): MicrobenchResult {
  const out: MicrobenchResult = {
    scenario: s.name,
    medianNs: s.nsPerOp.median,
    meanNs: s.nsPerOp.mean,
    minNs: s.nsPerOp.min,
    maxNs: s.nsPerOp.max,
    opsPerSec: s.opsPerSec,
    samples: s.samples,
    innerIters: s.innerIters,
  };
  if (s.nsPerOp.p99 !== undefined) out.p99Ns = s.nsPerOp.p99;
  return out;
}

export function heapToResult(h: HeapProbeResult): MicrobenchHeap {
  return {
    name: h.name,
    iterations: h.iterations,
    deltaBytes: h.deltaBytes,
    bytesPerFrame: h.bytesPerFrame,
    warmupFrames: h.warmupFrames,
    converged: h.converged,
    plateauHeapMB: h.plateauHeapMB,
    blocks: h.blocks,
    blockFrames: h.blockFrames,
    resolutionBytesPerFrame: h.resolutionBytesPerFrame,
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));

export function srcDir(): string {
  return HERE;
}

export function benchmarksDir(): string {
  return resolve(HERE, '..');
}

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
  const scheme = readPowerScheme();
  const affinity = readAffinity();
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
    ...(scheme === null ? {} : { powerSchemeGuid: scheme.guid, powerSchemeLabel: scheme.label }),
    ...(affinity === null
      ? {}
      : {
          affinityMask: affinity.mask,
          affinityCpus: affinity.selected,
          hostPhysicalCores: affinity.physical,
          hostLogicalCpus: affinity.logical,
        }),
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

/**
 * Reads the append-only run log. `malformed` counts lines that failed to parse
 * — a crash mid-append can leave a partial final line, and a caller promoting a
 * baseline must refuse rather than quietly aggregate whatever survived.
 */
export function readHistory(): { rows: MicrobenchReport[]; malformed: number } {
  let raw: string;
  try {
    raw = readFileSync(historyFile(), 'utf8');
  } catch {
    return { rows: [], malformed: 0 };
  }
  const rows: MicrobenchReport[] = [];
  let malformed = 0;
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      rows.push(JSON.parse(line) as MicrobenchReport);
    } catch {
      malformed++;
    }
  }
  return { rows, malformed };
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
