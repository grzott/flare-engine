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
 * report. `runtime` is fixed to `'web-swiftshader'` on every record: that is what lets the
 * dashboard tell this lane apart from the node lane's `runtime: "Bun x.y.z"` rows without the two
 * ever being able to mix into one incomparable series.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { ScenarioResult } from '../src/runner.js';
import type { NetworkProfile, PayloadByte } from './payload.js';

export type Provenance = {
  readonly commit: string;
  readonly host: string;
  readonly runtime: 'web-swiftshader';
  readonly appVersion: string;
  readonly browserName: string;
  readonly browserVersion: string;
  readonly capturedAt: string;
};

export type RenderHistoryRecord = Provenance & {
  readonly kind: 'render';
  readonly name: string;
  readonly samples: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
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
export function collectHostAndCommit(): { commit: string; host: string } {
  const sha = gitOutput(['rev-parse', '--short=12', 'HEAD']);
  const cpuModel = cpus()[0]?.model.trim() ?? 'unknown';
  return {
    commit: sha ?? 'unknown',
    host: `${process.platform} ${process.arch} (${cpuModel})`,
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
  appVersion: string;
  browserName: string;
  browserVersion: string;
  capturedAt: string;
}): Provenance {
  return { ...input, runtime: 'web-swiftshader' };
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
