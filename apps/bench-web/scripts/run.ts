/**
 * Headless driver: serves the bench-web page, drives it with Playwright/Chromium via a Node child
 * process, and writes software-rasterized result records for three lanes — the 18-scenario render
 * suite, the CanvasKit WASM payload bytes, and cold-start-to-first-frame (plain + throttled 4G) —
 * with full provenance on every record.
 *
 * `chromium.launch()` itself does not happen in this (Bun) process — see
 * `scripts/browser-driver.mjs`'s header for the full why. In short: Playwright's Chromium pipe
 * transport does not complete under Bun on this platform, so this file only starts the dev server
 * (needs `Bun.serve` + HTML-import bundling, Bun-only) and spawns the driver as a real `node`
 * child; only that child launches the browser. `scripts/coldstart-driver.mjs` is a second such
 * child, for the cold-start lane — see its header for why it is a separate driver rather than a
 * mode flag on `browser-driver.mjs`.
 *
 * Repeatability controls:
 *  - The page renders through a CPU-raster CanvasKit surface (no WebGL) — see src/runner.ts —
 *    which removes GPU driver/compositor variance outright rather than merely controlling for it.
 *  - Chromium launch flags below disable the timer/rAF throttling headless Chromium applies to
 *    windows it treats as backgrounded/occluded, which would otherwise corrupt rAF-delta timing,
 *    and force software rasterization (`--disable-gpu`) for a driver-independent baseline — see
 *    playwright.config.ts for that tradeoff and why every record here is labelled accordingly.
 *  - What remains uncontrollable (host CPU, thermal state, Chromium build) is recorded on every
 *    result record instead, under the provenance schema `{commit, host, runtime, appVersion,
 *    unit}` plus `browserName` / `browserVersion` / `capturedAt` (see scripts/history.ts).
 */
import { mkdirSync, rmSync } from 'node:fs';
import config from '../playwright.config.js';
import { RENDER_SCENARIO_NAMES, type ScenarioResult } from '../src/runner.js';
import {
  allRecords,
  appendHistory as appendWebHistory,
  buildProvenance,
  buildWebCapture,
  type ColdStartEntry,
  collectHostAndCommit,
  readAppVersion,
  toColdStartRecords,
  toPayloadRecords,
  toRenderRecords,
  writeWebBaseline,
} from './history.js';
import { FOUR_G_PROFILE, measureCanvasKitPayload } from './payload.js';
import { startServer } from './server.js';

/** Labels every result record as software-rasterized (SwiftShader, via Chromium's
 *  `--disable-gpu`) rather than a bare `'web'` — see playwright.config.ts. GPU-backed numbers are
 *  a separate, complementary lane (the future real-browser device matrix); conflating the two
 *  would misrepresent real-world frame cost. */
const RUNTIME_LABEL = 'web-swiftshader';

/** Cold-start navigations are short (single CanvasKit load, not the 18-scenario suite) — a wait
 *  this long past a real hang means a real failure, not slow-but-working. */
const COLD_START_WAIT_TIMEOUT_MS = 45_000;

type RenderDriverPayload = {
  readonly results: ScenarioResult[];
  readonly browserName: string;
  readonly browserVersion: string;
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
  serverUrl: string,
  rawPath: string,
): Promise<RenderDriverPayload> {
  const driverPath = `${import.meta.dir}/browser-driver.mjs`;
  const configJson = JSON.stringify({
    headless: config.headless,
    launchArgs: config.launchArgs,
    waitTimeoutMs: config.waitTimeoutMs,
    viewport: config.viewport,
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

async function main(): Promise<void> {
  const server = startServer();
  console.log(`bench-web: server up at ${server.url}`);

  const outDir = `${import.meta.dir}/../results`;
  mkdirSync(outDir, { recursive: true });
  const renderRawPath = `${outDir}/.web-bench-driver-raw.json`;
  const coldStartRawPath = `${outDir}/.web-bench-coldstart-raw.json`;

  try {
    const render = await runRenderSuiteDriver(server.url, renderRawPath);

    const gotNames = render.results.map((r) => r.name);
    const wantNames = [...RENDER_SCENARIO_NAMES];
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames)) {
      throw new Error(
        `bench-web: result payload does not match RENDER_SCENARIO_NAMES.\n` +
          `  got:  ${JSON.stringify(gotNames)}\n` +
          `  want: ${JSON.stringify(wantNames)}`,
      );
    }

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

    const outPath = `${outDir}/web-bench.json`;
    await Bun.write(outPath, `${JSON.stringify(capture, null, 2)}\n`);

    const historyFile = appendWebHistory(allRecords(capture));
    const baselineFile = writeWebBaseline(capture);

    console.log(
      `\nbench-web: ${capture.render.length} scenario(s), runtime=${RUNTIME_LABEL} ` +
        `(software-rasterized — SwiftShader via --disable-gpu, not a GPU-backed number), ` +
        `${provenance.browserName} ${provenance.browserVersion}, commit ${commit}\n`,
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
