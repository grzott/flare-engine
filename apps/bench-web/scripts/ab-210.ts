/**
 * #210 A/B runner: `bun run bench:web:ab210`. Measures how `loadCanvasKit` hands canvaskit-wasm
 * its wasm (`src/wasm-arm.ts` names the three arms) on the cpu-raster lane. Runbook: `AB-210.md`.
 *
 * Each round runs every arm once, ABC ABC ABC, so slow machine drift spreads across all arms. One
 * arm step is a full cpu-raster render-suite capture, then the cold-start driver twice: once as the
 * lane runs it (a fresh browser context), once in a fresh on-disk profile, which is the only shape
 * in which arm `url-cached` can be served from the HTTP cache (see `coldstart-driver.mjs`).
 *
 * Rows go to `results/ab-210.ndjson` (gitignored with `results/`) and nowhere else. This script
 * never calls `history.ts`'s writers, so nothing lands in `web-history.ndjson`, a `*-latest.json`
 * sidecar or a published baseline. `run.ts` refuses to run while an A/B env var is set.
 *
 * Pinning: this script refuses to start unpinned on a hybrid CPU and prints the pinned command,
 * rather than relaunching itself. The owner already runs every capture through
 * `cmd //c "start /affinity FFFF /b /wait ..."`. A self-relaunch would rebuild that quoting from
 * inside Bun, which `benchmarks/scripts/bench-pinned.mjs` documents failing three ways, and
 * refusing means an unpinned run cannot happen silently. The mask the run actually got is
 * recorded on every row.
 *
 * Flags: `--rounds N` (default 3); `--report` prints the table from the existing file and exits.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { judgeAffinity, readAffinity } from '@flare-engine/benchmarks/affinity';
import { judgePowerScheme, readPowerScheme } from '@flare-engine/benchmarks/power';
import { WASM_ARMS, type WasmArm } from '../src/wasm-arm.js';
import {
  type AbRow,
  COLD_START_PROFILES,
  type ColdStartProfile,
  formatReport,
  interleave,
  parseAbRows,
  readAbFields,
} from './ab-210-report.js';
import { classifyHostLoad, sampleHostLoad } from './capture.js';
import { collectHostAndCommit } from './history.js';
import { runColdStartDriver, runRenderSuiteDriver, validateScenarioNames } from './run.js';
import { startServer } from './server.js';

const RESULTS_DIR = `${import.meta.dir}/../results`;
const RESULTS_FILE = `${RESULTS_DIR}/ab-210.ndjson`;
const PINNED_COMMAND = 'cmd //c "start /affinity FFFF /b /wait bun run bench:web:ab210"';

function parseArgs(argv: readonly string[]): { readonly report: boolean; readonly rounds: number } {
  let rounds = 3;
  const i = argv.indexOf('--rounds');
  if (i !== -1) {
    rounds = Number(argv[i + 1]);
    if (!Number.isInteger(rounds) || rounds < 1) {
      throw new Error(`bench-web ab210: --rounds needs a positive integer, got ${argv[i + 1]}`);
    }
  }
  return { report: argv.includes('--report'), rounds };
}

function readRows(): AbRow[] {
  return existsSync(RESULTS_FILE) ? parseAbRows(readFileSync(RESULTS_FILE, 'utf8')) : [];
}

function append(rows: readonly AbRow[]): void {
  if (rows.length === 0) return;
  appendFileSync(RESULTS_FILE, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
}

/** Refuses an unpinned, power-saving or busy host before anything is measured. */
async function preflight(): Promise<void> {
  const affinity = judgeAffinity(readAffinity());
  if (affinity.kind === 'refuse') {
    throw new Error(
      'bench-web ab210: REFUSING to start unpinned on a hybrid CPU: P-core and E-core states move\n' +
        '  a cpu-raster row by up to 1.57x run to run. From the repo root, run:\n' +
        `    ${PINNED_COMMAND}`,
    );
  }
  const power = judgePowerScheme(readPowerScheme());
  if (power.kind === 'refuse') throw new Error(`bench-web ab210: REFUSING: ${power.message}`);
  if (power.kind === 'warn') console.warn(`bench-web ab210: WARNING: ${power.message}`);

  const load = classifyHostLoad(await sampleHostLoad(2000));
  console.log(`bench-web ab210: ${load.reason}`);
  if (load.level === 'busy' && process.env.BENCH_WEB_ALLOW_BUSY !== '1') {
    throw new Error(
      `bench-web ab210: REFUSING: ${load.reason}. Close what is running and retry, or set ` +
        'BENCH_WEB_ALLOW_BUSY=1 knowing the numbers then describe a loaded machine.',
    );
  }
}

type StepContext = {
  readonly runId: string;
  readonly arm: WasmArm;
  readonly round: number;
  readonly serverUrl: string;
  readonly provenance: ReturnType<typeof collectHostAndCommit>;
  readonly rawPath: string;
};

function errorRow(ctx: StepContext, step: string, err: unknown): AbRow {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`bench-web ab210: ${ctx.arm} round ${ctx.round} ${step} FAILED: ${message}`);
  return {
    ab: 210,
    runId: ctx.runId,
    arm: ctx.arm,
    round: ctx.round,
    capturedAt: new Date().toISOString(),
    kind: 'error',
    step,
    message,
  };
}

/** The loader must report the arm it was asked for; anything else is a stale bundle or a fallback. */
function armMismatch(arm: WasmArm, taken: string | null): string | null {
  if (taken === arm) return null;
  return taken === null
    ? 'the page loader wrote no __FLARE_WASM_ARM_TAKEN, so the bundled render-web has no #210 ' +
        'switch. Its dist/ is stale: run through the root script, which builds dependencies first'
    : `the loader took '${taken}', not '${arm}'`;
}

async function renderStep(ctx: StepContext, hostLoadPct: number): Promise<AbRow[]> {
  const env = { ...process.env, BENCH_WEB_WASM_ARM: ctx.arm };
  const payload = await runRenderSuiteDriver('cpu-raster', ctx.serverUrl, ctx.rawPath, env);
  validateScenarioNames(payload.results.map((r) => r.name));
  const ab = readAbFields(payload);
  const mismatch = armMismatch(ctx.arm, ab.wasmArmTaken);
  if (mismatch !== null) return [errorRow(ctx, 'render', mismatch)];

  const capturedAt = new Date().toISOString();
  const { commit, host, affinityMask, powerSchemeLabel } = ctx.provenance;
  return payload.results.map((r) => ({
    ab: 210,
    runId: ctx.runId,
    arm: ctx.arm,
    round: ctx.round,
    capturedAt,
    kind: 'render',
    name: r.name,
    samples: r.samples,
    p50Ms: r.p50Ms,
    p95Ms: r.p95Ms,
    p99Ms: r.p99Ms,
    commit,
    host,
    affinityMask,
    powerSchemeLabel,
    browserVersion: payload.browserVersion,
    hostLoadPct,
    ...ab,
  }));
}

async function coldStartStep(
  ctx: StepContext,
  profile: ColdStartProfile,
  hostLoadPct: number,
): Promise<AbRow[]> {
  const env = { ...process.env, BENCH_WEB_WASM_ARM: ctx.arm, BENCH_WEB_COLDSTART_PROFILE: profile };
  const payload = await runColdStartDriver(ctx.serverUrl, ctx.rawPath, env);
  const capturedAt = new Date().toISOString();
  const { commit, host, affinityMask, powerSchemeLabel } = ctx.provenance;
  const rows: AbRow[] = [];
  for (const entry of payload.coldStart) {
    const ab = readAbFields(entry);
    const mismatch = armMismatch(ctx.arm, ab.wasmArmTaken);
    if (mismatch !== null) return [errorRow(ctx, `coldStart ${profile} ${entry.name}`, mismatch)];
    rows.push({
      ab: 210,
      runId: ctx.runId,
      arm: ctx.arm,
      round: ctx.round,
      capturedAt,
      kind: 'coldStart',
      profile,
      name: entry.name,
      ms: entry.ms,
      commit,
      host,
      affinityMask,
      powerSchemeLabel,
      browserVersion: payload.browserVersion,
      hostLoadPct,
      ...ab,
    });
  }
  return rows;
}

async function main(): Promise<void> {
  const { report, rounds } = parseArgs(process.argv.slice(2));
  if (report) {
    console.log(formatReport(readRows()));
    return;
  }

  await preflight();
  mkdirSync(RESULTS_DIR, { recursive: true });
  const provenance = collectHostAndCommit();
  const runId = new Date().toISOString();
  const schedule = interleave(WASM_ARMS, rounds);
  const rawPath = `${RESULTS_DIR}/.ab-210-driver-raw.json`;
  const server = startServer();
  console.log(
    `bench-web ab210: server up at ${server.url}; ${schedule.length} arm step(s), ` +
      `commit ${provenance.commit}, affinity ${provenance.affinityMask ?? 'unrecorded'}; ` +
      `writing ${RESULTS_FILE}`,
  );

  let failures = 0;
  try {
    for (const [i, { arm, round }] of schedule.entries()) {
      console.log(`\nbench-web ab210: [${i + 1}/${schedule.length}] round ${round}, arm ${arm}`);
      const ctx: StepContext = { runId, arm, round, serverUrl: server.url, provenance, rawPath };
      const hostLoadPct = await sampleHostLoad(2000);
      const level = classifyHostLoad(hostLoadPct);
      if (level.level !== 'quiet') console.warn(`bench-web ab210: WARNING: ${level.reason}`);

      const steps: [string, () => Promise<AbRow[]>][] = [
        ['render', () => renderStep(ctx, hostLoadPct)],
        ...COLD_START_PROFILES.map((p): [string, () => Promise<AbRow[]>] => [
          `coldStart ${p}`,
          () => coldStartStep(ctx, p, hostLoadPct),
        ]),
      ];
      for (const [name, run] of steps) {
        let rows: AbRow[];
        try {
          rows = await run();
        } catch (err) {
          rows = [errorRow(ctx, name, err)];
        }
        failures += rows.filter((r) => r.kind === 'error').length;
        append(rows);
      }
    }
  } finally {
    rmSync(rawPath, { force: true });
    server.stop();
  }

  console.log(`\n${formatReport(readRows())}`);
  if (failures > 0) {
    console.error(
      `\nbench-web ab210: ${failures} step(s) failed; their error rows are in the file.`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
