/**
 * Headless driver: serves the bench-web page, drives it with Playwright/Chromium via a Node child
 * process, and writes render-suite result records with full provenance on every record. Two
 * modes, selected by `BENCH_WEB_MODE` (see `parseMode`):
 *
 *  - `cpu-raster` (default): the 18-scenario render suite, CanvasKit WASM payload bytes, and
 *    cold-start-to-first-frame (plain + throttled 4G) — unchanged from before GPU mode existed.
 *  - `gpu`: the render suite only, against a real on-screen WebGL surface. Payload and cold-start
 *    are skipped in this mode — both are backend-agnostic (payload) or defined in terms of the
 *    CPU-raster surface by construction (cold-start), so re-running them under a GPU label would
 *    duplicate the CPU-raster numbers, not add new ones. Results land in their own files
 *    (`web-gpu.json` / `web-gpu-history.ndjson`), never merged into the CPU-raster series.
 *
 * `chromium.launch()` itself does not happen in this (Bun) process — see
 * `scripts/browser-driver.mjs`'s header for the full why. In short: Playwright's Chromium pipe
 * transport does not complete under Bun on this platform, so this file only starts the dev server
 * (needs `Bun.serve` + HTML-import bundling, Bun-only) and spawns the driver as a real `node`
 * child; only that child launches the browser. `scripts/coldstart-driver.mjs` is a second such
 * child, for the cold-start lane (cpu-raster mode only) — see its header for why it is a separate
 * driver rather than a mode flag on `browser-driver.mjs`.
 *
 * Repeatability controls:
 *  - `cpu-raster` renders through an offscreen `CanvasKit.MakeSurface` — see src/runner.ts —
 *    which is CPU-backed by construction and removes GPU driver/compositor variance outright.
 *  - `gpu` renders through a real `<canvas>` + WebGL surface (`src/runner.ts`'s `createGpuTarget`,
 *    `@flare-engine/render-web`) and must NOT pass `--disable-gpu` — see playwright.config.ts.
 *    `browser-driver.mjs` verifies the reported renderer is not a software fallback before this
 *    file ever writes a record, so a broken GPU launch fails loudly instead of silently
 *    publishing a SwiftShader number under a `web-gpu` label.
 *  - Chromium launch flags in both modes disable the timer/rAF throttling headless Chromium
 *    applies to windows it treats as backgrounded/occluded, which would otherwise corrupt
 *    rAF-delta timing — see playwright.config.ts.
 *  - What remains uncontrollable (host CPU/GPU, thermal state, Chromium build) is recorded on
 *    every result record instead, under the provenance schema `{commit, host, runtime, appVersion,
 *    unit}` plus `browserName` / `browserVersion` / `capturedAt` (and `rendererString` for GPU
 *    records) — see scripts/history.ts.
 */
import { mkdirSync, rmSync } from 'node:fs';
import config, { type BenchMode, launchArgsForMode } from '../playwright.config.js';
import { RENDER_SCENARIO_NAMES, type ScenarioResult } from '../src/runner.js';
import {
  allRecords,
  appendGpuHistory,
  appendHistory as appendWebHistory,
  buildProvenance,
  buildWebCapture,
  buildWebGpuCapture,
  type ColdStartEntry,
  collectHostAndCommit,
  readAppVersion,
  toColdStartRecords,
  toPayloadRecords,
  toRenderRecords,
  writeGpuWebBaseline,
  writeWebBaseline,
} from './history.js';
import { FOUR_G_PROFILE, measureCanvasKitPayload } from './payload.js';
import { startServer } from './server.js';

/** Labels the CPU-raster lane's result records — an offscreen, CPU-backed `MakeSurface` (see
 *  src/runner.ts), never a bare `'web'`. GPU records use `RUNTIME_LABEL_GPU` instead. */
const RUNTIME_LABEL = 'web-cpu-raster';
const RUNTIME_LABEL_GPU = 'web-gpu';

/** Selects the render mode: `BENCH_WEB_MODE=gpu bun run scripts/run.ts` (or the `bench:web:gpu`
 *  package.json script) for the on-screen WebGL lane. Unset, or `cpu-raster` explicitly, keeps
 *  `bun run bench:web`'s existing behaviour unchanged. */
function parseMode(): BenchMode {
  const raw = process.env.BENCH_WEB_MODE;
  if (raw === undefined || raw === 'cpu-raster') return 'cpu-raster';
  if (raw === 'gpu') return 'gpu';
  throw new Error(
    `bench-web: BENCH_WEB_MODE must be "cpu-raster" or "gpu", got ${JSON.stringify(raw)}`,
  );
}

/** Cold-start navigations are short (single CanvasKit load, not the 18-scenario suite) — a wait
 *  this long past a real hang means a real failure, not slow-but-working. */
const COLD_START_WAIT_TIMEOUT_MS = 45_000;

type RenderDriverPayload = {
  readonly results: ScenarioResult[];
  readonly browserName: string;
  readonly browserVersion: string;
  /** `null` in `cpu-raster` mode (there is no GPU to name); the page's `UNMASKED_RENDERER_WEBGL`
   *  reading in `gpu` mode. */
  readonly rendererString: string | null;
};

type ColdStartDriverPayload = {
  readonly coldStart: readonly ColdStartEntry[];
  readonly browserName: string;
  readonly browserVersion: string;
};

/** Runs a `node <driverPath> <url> <configJson> <rawPath>` child and returns its JSON payload —
 *  the shared shape both `browser-driver.mjs` and `coldstart-driver.mjs` follow. */
async function runNodeDriver<T>(
  driverPath: string,
  url: string,
  configJson: string,
  rawPath: string,
): Promise<T> {
  const proc = Bun.spawn({
    cmd: ['node', driverPath, url, configJson, rawPath],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bench-web: node ${driverPath} exited with code ${exitCode}`);
  }
  return JSON.parse(await Bun.file(rawPath).text()) as T;
}

async function runRenderSuiteDriver(
  mode: BenchMode,
  serverUrl: string,
  rawPath: string,
): Promise<RenderDriverPayload> {
  const driverPath = `${import.meta.dir}/browser-driver.mjs`;
  const configJson = JSON.stringify({
    headless: config.headless,
    launchArgs: launchArgsForMode(mode),
    waitTimeoutMs: config.waitTimeoutMs,
    viewport: config.viewport,
    mode,
  });
  return runNodeDriver<RenderDriverPayload>(driverPath, serverUrl, configJson, rawPath);
}

async function runColdStartDriver(
  serverUrl: string,
  rawPath: string,
): Promise<ColdStartDriverPayload> {
  const driverPath = `${import.meta.dir}/coldstart-driver.mjs`;
  const configJson = JSON.stringify({
    headless: config.headless,
    launchArgs: config.launchArgs,
    waitTimeoutMs: COLD_START_WAIT_TIMEOUT_MS,
    viewport: config.viewport,
    fourGProfile: FOUR_G_PROFILE,
  });
  return runNodeDriver<ColdStartDriverPayload>(
    driverPath,
    `${serverUrl}cold-start`,
    configJson,
    rawPath,
  );
}

function validateScenarioNames(gotNames: readonly string[]): void {
  const wantNames = [...RENDER_SCENARIO_NAMES];
  if (JSON.stringify(gotNames) !== JSON.stringify(wantNames)) {
    throw new Error(
      `bench-web: result payload does not match RENDER_SCENARIO_NAMES.\n` +
        `  got:  ${JSON.stringify(gotNames)}\n` +
        `  want: ${JSON.stringify(wantNames)}`,
    );
  }
}

async function runGpuMode(server: { readonly url: string }, renderRawPath: string): Promise<void> {
  const render = await runRenderSuiteDriver('gpu', server.url, renderRawPath);
  validateScenarioNames(render.results.map((r) => r.name));
  if (render.rendererString === null) {
    throw new Error('bench-web: gpu mode produced no renderer string');
  }

  const { commit, host } = collectHostAndCommit();
  const appVersion = await readAppVersion();
  const capturedAt = new Date().toISOString();
  const provenance = buildProvenance({
    commit,
    host,
    runtime: RUNTIME_LABEL_GPU,
    appVersion,
    browserName: render.browserName,
    browserVersion: render.browserVersion,
    capturedAt,
    rendererString: render.rendererString,
  });

  const capture = buildWebGpuCapture({
    generated: capturedAt,
    render: toRenderRecords(render.results, provenance),
  });

  const outPath = `${import.meta.dir}/../results/web-gpu-bench.json`;
  await Bun.write(outPath, `${JSON.stringify(capture, null, 2)}\n`);
  const historyFile = appendGpuHistory(capture.render);
  const baselineFile = writeGpuWebBaseline(capture);

  console.log(
    `\nbench-web: ${capture.render.length} scenario(s), runtime=${RUNTIME_LABEL_GPU} ` +
      `(real GPU frame cost — hardware acceleration confirmed), renderer="${provenance.rendererString}", ` +
      `${provenance.browserName} ${provenance.browserVersion}, commit ${commit}\n`,
  );
  console.log(['scenario', 'samples', 'p50Ms', 'p95Ms', 'p99Ms'].join('\t'));
  for (const r of capture.render) {
    console.log(
      [r.name, r.samples, r.p50Ms.toFixed(3), r.p95Ms.toFixed(3), r.p99Ms.toFixed(3)].join('\t'),
    );
  }
  console.log(`\nbench-web: wrote ${outPath}`);
  console.log(`bench-web: appended ${capture.render.length} record(s) to ${historyFile}`);
  console.log(`bench-web: wrote ${baselineFile}`);
}

async function runCpuRasterMode(
  server: { readonly url: string },
  renderRawPath: string,
  coldStartRawPath: string,
): Promise<void> {
  const render = await runRenderSuiteDriver('cpu-raster', server.url, renderRawPath);
  validateScenarioNames(render.results.map((r) => r.name));

  console.log('bench-web: measuring CanvasKit WASM payload bytes…');
  const payloadBytes = measureCanvasKitPayload();

  console.log('bench-web: measuring cold start (plain + throttled 4G)…');
  const coldStart = await runColdStartDriver(server.url, coldStartRawPath);

  const { commit, host } = collectHostAndCommit();
  const appVersion = await readAppVersion();
  const capturedAt = new Date().toISOString();
  const provenance = buildProvenance({
    commit,
    host,
    runtime: RUNTIME_LABEL,
    appVersion,
    browserName: render.browserName,
    browserVersion: render.browserVersion,
    capturedAt,
  });

  const capture = buildWebCapture({
    generated: capturedAt,
    render: toRenderRecords(render.results, provenance),
    payload: toPayloadRecords(payloadBytes, provenance),
    coldStart: toColdStartRecords(coldStart.coldStart, provenance),
  });

  const outPath = `${import.meta.dir}/../results/web-bench.json`;
  await Bun.write(outPath, `${JSON.stringify(capture, null, 2)}\n`);

  const historyFile = appendWebHistory(allRecords(capture));
  const baselineFile = writeWebBaseline(capture);

  console.log(
    `\nbench-web: ${capture.render.length} scenario(s), runtime=${RUNTIME_LABEL} ` +
      `(CPU-backed raster surface — CanvasKit.MakeSurface by construction, not a GPU-backed ` +
      `number), ${provenance.browserName} ${provenance.browserVersion}, commit ${commit}\n`,
  );
  console.log(['scenario', 'samples', 'p50Ms', 'p95Ms', 'p99Ms'].join('\t'));
  for (const r of capture.render) {
    console.log(
      [r.name, r.samples, r.p50Ms.toFixed(3), r.p95Ms.toFixed(3), r.p99Ms.toFixed(3)].join('\t'),
    );
  }
  console.log('\npayload bytes:');
  for (const p of capture.payload) console.log(`  ${p.name}\t${p.bytes}`);
  console.log('\ncold start (ms):');
  for (const c of capture.coldStart) console.log(`  ${c.name}\t${c.ms.toFixed(1)}`);

  console.log(`\nbench-web: wrote ${outPath}`);
  console.log(
    `bench-web: appended ${capture.render.length + capture.payload.length + capture.coldStart.length} record(s) to ${historyFile}`,
  );
  console.log(`bench-web: wrote ${baselineFile}`);
}

async function main(): Promise<void> {
  const mode = parseMode();
  const server = startServer();
  console.log(`bench-web: server up at ${server.url} (mode=${mode})`);

  const outDir = `${import.meta.dir}/../results`;
  mkdirSync(outDir, { recursive: true });
  const renderRawPath = `${outDir}/.web-bench-driver-raw.json`;
  const coldStartRawPath = `${outDir}/.web-bench-coldstart-raw.json`;

  try {
    if (mode === 'gpu') {
      await runGpuMode(server, renderRawPath);
    } else {
      await runCpuRasterMode(server, renderRawPath, coldStartRawPath);
    }
  } finally {
    rmSync(renderRawPath, { force: true });
    rmSync(coldStartRawPath, { force: true });
    server.stop();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
