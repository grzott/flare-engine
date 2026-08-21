/**
 * Provenance + the web lane's append-only history record, following the convention
 * `benchmarks/src/results.ts` already established for the node lane: an append-only ndjson (one
 * JSON object per line, never rewritten) plus a committed "latest capture" baseline JSON the
 * dashboard reads through a package export.
 *
 * Deliberately a *separate* file (`web-history.ndjson`), not an append to the node lane's
 * `history.ndjson`: that file's only reader, `benchmarks/src/index.ts`'s `--promote`, does
 * `readHistory().rows.slice(-wanted)` and treats every row as a `MicrobenchReport` — no runtime
 * discriminant check. A web-lane row landing in the last N entries would silently corrupt a
 * promote (or crash reading `.suites` on a shape that has none). Keeping the files apart makes
 * that failure mode structurally impossible rather than merely unlikely.
 *
 * Every record carries the full provenance schema the spec requires —
 * `{ commit, host, runtime, appVersion, unit }` — directly on itself rather than only on an
 * enclosing envelope, the same way each node-lane `MicrobenchResult` is self-contained inside its
 * report. `runtime` is one of two literals — `'web-cpu-raster'` (the offscreen `MakeSurface`
 * lane) or `'web-gpu'` (the on-screen WebGL lane, `apps/bench-web/src/runner.ts`'s `createGpuTarget`)
 * — never a bare `'web'`: that is what lets the dashboard tell this lane apart from the node
 * lane's `runtime: "Bun x.y.z"` rows, and what stops the two web sub-lanes ever mixing into one
 * incomparable series. GPU records additionally carry `rendererString` — the `UNMASKED_RENDERER_WEBGL`
 * string read back from the page — because a GPU figure without the GPU named is not reproducible.
 *
 * The GPU lane writes to its own files (`web-gpu.json` / `web-gpu-history.ndjson`), never merged
 * into the CPU-raster series above: the two measure different pipelines and are not comparable
 * row-for-row the way two CPU-raster captures are.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { readAffinity } from '@flare-engine/benchmarks/affinity';
import { readPowerScheme } from '@flare-engine/benchmarks/power';
import type { ScenarioResult } from '../src/runner.js';
import type { NetworkProfile, PayloadByte } from './payload.js';

/** `web-cpu-raster` = the offscreen `CanvasKit.MakeSurface` lane (no `<canvas>`/WebGL, CPU-backed
 *  by construction). `web-gpu` = the on-screen WebGL lane via `@flare-engine/render-web`. */
export type WebRuntimeLabel = 'web-cpu-raster' | 'web-gpu' | 'web-android-gpu';

/** Hardware identity for the on-device lane, read from `getprop` at capture time rather than
 *  typed in — a capture must name the phone it actually ran on, never the one anyone intended.
 *  Absent on both desktop lanes. */
/**
 * Device thermal state either side of a capture. `status` is Android's own throttling level
 * (0 = NONE ... 6 = SHUTDOWN) from `dumpsys thermalservice`; battery temperature is the continuous
 * signal beside it, because status is a step function that reads 0 right up until it does not.
 * `null` means the device did not report the value — distinct from reporting zero.
 */
export type AndroidThermal = {
  readonly statusBefore: number | null;
  readonly statusAfter: number | null;
  readonly batteryTempCBefore: number | null;
  readonly batteryTempCAfter: number | null;
};

export type AndroidDeviceInfo = {
  /** `ro.product.model`, e.g. "Pixel 7". */
  readonly model: string;
  /** `ro.product.device` board codename, e.g. "panther". */
  readonly codename: string;
  /** `ro.soc.model`, e.g. "GS201". */
  readonly soc: string;
  /** `ro.build.version.release`. */
  readonly androidRelease: string;
};

export type Provenance = {
  readonly commit: string;
  readonly host: string;
  readonly runtime: WebRuntimeLabel;
  readonly appVersion: string;
  readonly browserName: string;
  readonly browserVersion: string;
  readonly capturedAt: string;
  /** Present only on `web-android-gpu` records. */
  readonly device?: AndroidDeviceInfo;
  /** Present only on `web-android-gpu` records. */
  readonly thermal?: AndroidThermal;
  /** `UNMASKED_RENDERER_WEBGL` (or the best available fallback) — present only on `web-gpu`
   *  records. A GPU number without the GPU named is not reproducible. */
  readonly rendererString?: string;
  /** Host machine conditions, on the lanes where the host is what is being measured. Absent on
   *  `web-android-gpu`, where the phone is the subject and `device` + `thermal` carry this
   *  instead. Recorded because the node lane published ~2.5x-wrong numbers for three months with
   *  nothing able to say what power plan they were taken under. */
  readonly powerSchemeGuid?: string;
  readonly powerSchemeLabel?: string;
  readonly affinityMask?: string;
  readonly affinityCpus?: number;
};

export type RenderHistoryRecord = Provenance & {
  readonly kind: 'render';
  readonly name: string;
  readonly samples: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  /** Median repetitions per measured batch. */
  readonly opsPerBatch: number;
  /** Median measured wall time per batch. Recorded so a reader can reconstruct the window each
   *  per-op figure was divided out of — the check that catches a clock-quantized reading. */
  readonly batchMs: number;
  /** Median rAF delta across a batch: the frame-budget diagnostic, never the timing source. */
  readonly frameDeltaMs: number;
  readonly unit: 'ms';
};

export type PayloadHistoryRecord = Provenance & {
  readonly kind: 'payload';
  readonly name: string;
  readonly bytes: number;
  readonly unit: 'bytes';
};

export type ColdStartEntry = {
  readonly name: string;
  readonly ms: number;
  /** Present only on the throttled variants. */
  readonly network: NetworkProfile | null;
};

export type ColdStartHistoryRecord = Provenance & {
  readonly kind: 'coldStart';
  readonly name: string;
  readonly ms: number;
  readonly unit: 'ms';
  readonly network: NetworkProfile | null;
};

export type WebHistoryRecord = RenderHistoryRecord | PayloadHistoryRecord | ColdStartHistoryRecord;

export type WebCapture = {
  readonly schemaVersion: 1;
  readonly generated: string;
  readonly render: readonly RenderHistoryRecord[];
  readonly payload: readonly PayloadHistoryRecord[];
  readonly coldStart: readonly ColdStartHistoryRecord[];
};

function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..', '..');
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

/** Mirrors `benchmarks/src/results.ts`'s `collectProvenance` shape (short git SHA, no literal
 *  hostname — this repo goes public and a machine name adds nothing the CPU model does not
 *  already say), but under the field names the web provenance schema specifies. */
export function collectHostAndCommit(): {
  commit: string;
  host: string;
  powerSchemeGuid?: string;
  powerSchemeLabel?: string;
  affinityMask?: string;
  affinityCpus?: number;
} {
  const sha = gitOutput(['rev-parse', '--short=12', 'HEAD']);
  const cpuModel = cpus()[0]?.model.trim() ?? 'unknown';
  // Reused from the node lane rather than reimplemented: two independent readings of the same
  // machine state that could quietly disagree is the defect these fields exist to prevent.
  const scheme = readPowerScheme();
  const affinity = readAffinity();
  return {
    commit: sha ?? 'unknown',
    host: `${process.platform} ${process.arch} (${cpuModel})`,
    ...(scheme === null ? {} : { powerSchemeGuid: scheme.guid, powerSchemeLabel: scheme.label }),
    ...(affinity === null ? {} : { affinityMask: affinity.mask, affinityCpus: affinity.selected }),
  };
}

/** Reads the engine's lockstep version straight off `@flare-engine/render-web`'s package.json —
 *  never hardcoded — the same package.json Bun's workspace resolution already installs for this
 *  app's own `@flare-engine/render-web` dependency. */
export async function readAppVersion(): Promise<string> {
  const pkgPath = resolve(repoRoot(), 'packages', 'render-web', 'package.json');
  const pkg = (await Bun.file(pkgPath).json()) as { version?: unknown };
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new Error(`bench-web: ${pkgPath} has no readable "version" field`);
  }
  return pkg.version;
}

export function buildProvenance(input: {
  commit: string;
  host: string;
  runtime: WebRuntimeLabel;
  appVersion: string;
  browserName: string;
  browserVersion: string;
  capturedAt: string;
  rendererString?: string;
  device?: AndroidDeviceInfo;
  thermal?: AndroidThermal;
  powerSchemeGuid?: string;
  powerSchemeLabel?: string;
  affinityMask?: string;
  affinityCpus?: number;
}): Provenance {
  return { ...input };
}

export function toRenderRecords(
  results: readonly ScenarioResult[],
  p: Provenance,
): RenderHistoryRecord[] {
  return results.map((r) => ({
    ...p,
    kind: 'render',
    name: r.name,
    samples: r.samples,
    p50Ms: r.p50Ms,
    p95Ms: r.p95Ms,
    p99Ms: r.p99Ms,
    opsPerBatch: r.opsPerBatch,
    batchMs: r.batchMs,
    frameDeltaMs: r.frameDeltaMs,
    unit: 'ms',
  }));
}

export function toPayloadRecords(
  bytes: readonly PayloadByte[],
  p: Provenance,
): PayloadHistoryRecord[] {
  return bytes.map((b) => ({ ...p, kind: 'payload', name: b.name, bytes: b.bytes, unit: 'bytes' }));
}

export function toColdStartRecords(
  entries: readonly ColdStartEntry[],
  p: Provenance,
): ColdStartHistoryRecord[] {
  return entries.map((e) => ({
    ...p,
    kind: 'coldStart',
    name: e.name,
    ms: e.ms,
    unit: 'ms',
    network: e.network,
  }));
}

export function buildWebCapture(input: {
  generated: string;
  render: readonly RenderHistoryRecord[];
  payload: readonly PayloadHistoryRecord[];
  coldStart: readonly ColdStartHistoryRecord[];
}): WebCapture {
  return { schemaVersion: 1, ...input };
}

export function allRecords(capture: WebCapture): WebHistoryRecord[] {
  return [...capture.render, ...capture.payload, ...capture.coldStart];
}

function writeJsonAtomic(file: string, contents: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, contents, 'utf8');
    renameSync(tmp, file);
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}

export function historyFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web-history.ndjson');
}

export function webBaselineFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web.json');
}

/** The GPU lane's append-only history — a separate file from `historyFilePath()`, per this
 *  module's header: the two runtimes measure different pipelines and must never land in one
 *  series. */
export function gpuHistoryFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web-gpu-history.ndjson');
}

/** The on-device lane's append-only history — its own file, for the same reason the GPU lane has
 *  one: a phone's numbers and a desktop's must never share a series. */
export function androidHistoryFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web-android-history.ndjson');
}

/** The on-device lane's "latest capture" baseline. */
export function androidWebBaselineFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web-android.json');
}

/** The GPU lane's "latest capture" baseline — a separate file from `webBaselineFilePath()`. */
export function gpuWebBaselineFilePath(): string {
  return resolve(repoRoot(), 'benchmarks', 'results', 'web-gpu.json');
}

/** Append-only, matching `appendHistoryRow` in `benchmarks/src/results.ts`'s convention: nothing
 *  here ever rewrites a previously written line. A separate file from that function's — see this
 *  module's header for why. */
export function appendHistory(records: readonly WebHistoryRecord[]): string {
  const file = historyFilePath();
  mkdirSync(dirname(file), { recursive: true });
  const lines = records.map((r) => `${JSON.stringify(r)}\n`).join('');
  appendFileSync(file, lines, 'utf8');
  return file;
}

/** Overwrites the committed "latest capture" the dashboard reads — mirrors `writeMicrobenchJson`
 *  for the node lane. Only the append-only history log accumulates; this file always reflects the
 *  most recent run. */
export function writeWebBaseline(capture: WebCapture): string {
  const file = webBaselineFilePath();
  writeJsonAtomic(file, `${JSON.stringify(capture, null, 2)}\n`);
  return file;
}

/**
 * The GPU lane's capture — render scenarios only. Deliberately narrower than `WebCapture`: GPU
 * mode measures the render path (the thing Task 2 exists to add), not the WASM payload or
 * cold-start lanes, which are backend-agnostic (payload) or defined in terms of the CPU-raster
 * surface by construction (cold-start's "first rendered frame" — see `coldstart-driver.mjs`) and
 * so add nothing new under a GPU target. Re-running them per GPU capture would only duplicate the
 * CPU-raster numbers under a misleading label.
 */
export type WebGpuCapture = {
  readonly schemaVersion: 1;
  readonly generated: string;
  readonly render: readonly RenderHistoryRecord[];
};

export function buildWebGpuCapture(input: {
  generated: string;
  render: readonly RenderHistoryRecord[];
}): WebGpuCapture {
  return { schemaVersion: 1, ...input };
}

/** Append-only, mirroring `appendHistory` for the GPU lane's own file. */
export function appendGpuHistory(records: readonly RenderHistoryRecord[]): string {
  const file = gpuHistoryFilePath();
  mkdirSync(dirname(file), { recursive: true });
  const lines = records.map((r) => `${JSON.stringify(r)}\n`).join('');
  appendFileSync(file, lines, 'utf8');
  return file;
}

/**
 * The on-device lane's capture. Render scenarios only, for the same reason as `WebGpuCapture`:
 * payload bytes are backend-agnostic and cold-start is defined against the CPU-raster surface, so
 * neither gains meaning from being re-run through a phone.
 */
export type WebAndroidCapture = {
  readonly schemaVersion: 1;
  readonly generated: string;
  readonly render: readonly RenderHistoryRecord[];
};

export function buildWebAndroidCapture(input: {
  generated: string;
  render: readonly RenderHistoryRecord[];
}): WebAndroidCapture {
  return { schemaVersion: 1, ...input };
}

/** Append-only, mirroring `appendHistory` for the on-device lane's own file. */
export function appendAndroidHistory(records: readonly RenderHistoryRecord[]): string {
  const file = androidHistoryFilePath();
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, records.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8');
  return file;
}

/** Overwrites the on-device lane's "latest capture" file. */
export function writeAndroidWebBaseline(capture: WebAndroidCapture): string {
  const file = androidWebBaselineFilePath();
  writeJsonAtomic(file, `${JSON.stringify(capture, null, 2)}\n`);
  return file;
}

/** Overwrites the GPU lane's "latest capture" file, mirroring `writeWebBaseline`. */
export function writeGpuWebBaseline(capture: WebGpuCapture): string {
  const file = gpuWebBaselineFilePath();
  writeJsonAtomic(file, `${JSON.stringify(capture, null, 2)}\n`);
  return file;
}
