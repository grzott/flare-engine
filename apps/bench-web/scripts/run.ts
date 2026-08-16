/**
 * Headless driver: serves the bench-web page, drives it with Playwright/Chromium via a Node child
 * process, and writes one software-rasterized result record per Render-suite scenario.
 *
 * `chromium.launch()` itself does not happen in this (Bun) process — see
 * `scripts/browser-driver.mjs`'s header for the full why. In short: Playwright's Chromium pipe
 * transport does not complete under Bun on this platform, so this file only starts the dev server
 * (needs `Bun.serve` + HTML-import bundling, Bun-only) and spawns the driver as a real `node`
 * child; only that child launches the browser.
 *
 * Repeatability controls:
 *  - The page renders through a CPU-raster CanvasKit surface (no WebGL) — see src/runner.ts —
 *    which removes GPU driver/compositor variance outright rather than merely controlling for it.
 *  - Chromium launch flags below disable the timer/rAF throttling headless Chromium applies to
 *    windows it treats as backgrounded/occluded, which would otherwise corrupt rAF-delta timing,
 *    and force software rasterization (`--disable-gpu`) for a driver-independent baseline — see
 *    playwright.config.ts for that tradeoff and why every record here is labelled accordingly.
 *  - What remains uncontrollable (host CPU, thermal state, Chromium build) is recorded on every
 *    result record instead: `browserName` / `browserVersion` / `capturedAt`.
 */
import { mkdirSync, rmSync } from 'node:fs';
import config from '../playwright.config.js';
import { RENDER_SCENARIO_NAMES, type ScenarioResult } from '../src/runner.js';
import { startServer } from './server.js';

/** Labels every result record as software-rasterized (SwiftShader, via Chromium's
 *  `--disable-gpu`) rather than a bare `'web'` — see playwright.config.ts. GPU-backed numbers are
 *  a separate, complementary lane (the future real-browser device matrix); conflating the two
 *  would misrepresent real-world frame cost. */
const RUNTIME_LABEL = 'web-swiftshader';

type OutputRecord = ScenarioResult & {
  readonly runtime: typeof RUNTIME_LABEL;
  readonly browserName: string;
  readonly browserVersion: string;
  readonly capturedAt: string;
};

type DriverPayload = {
  readonly results: ScenarioResult[];
  readonly browserName: string;
  readonly browserVersion: string;
};

/** Runs `scripts/browser-driver.mjs` under a real `node` binary and returns its JSON payload —
 *  see that file's header for why `node` and not `bun`. */
async function runBrowserDriver(url: string, rawPath: string): Promise<DriverPayload> {
  const driverPath = `${import.meta.dir}/browser-driver.mjs`;
  const configJson = JSON.stringify({
    headless: config.headless,
    launchArgs: config.launchArgs,
    waitTimeoutMs: config.waitTimeoutMs,
    viewport: config.viewport,
  });
  const proc = Bun.spawn({
    cmd: ['node', driverPath, url, configJson, rawPath],
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bench-web: node browser-driver.mjs exited with code ${exitCode}`);
  }
  return JSON.parse(await Bun.file(rawPath).text()) as DriverPayload;
}

async function main(): Promise<void> {
  const server = startServer();
  console.log(`bench-web: server up at ${server.url}`);

  const outDir = `${import.meta.dir}/../results`;
  mkdirSync(outDir, { recursive: true });
  const rawPath = `${outDir}/.web-bench-driver-raw.json`;

  try {
    const payload = await runBrowserDriver(server.url, rawPath);

    const gotNames = payload.results.map((r) => r.name);
    const wantNames = [...RENDER_SCENARIO_NAMES];
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames)) {
      throw new Error(
        `bench-web: result payload does not match RENDER_SCENARIO_NAMES.\n` +
          `  got:  ${JSON.stringify(gotNames)}\n` +
          `  want: ${JSON.stringify(wantNames)}`,
      );
    }

    const capturedAt = new Date().toISOString();
    const records: OutputRecord[] = payload.results.map((r) => ({
      ...r,
      runtime: RUNTIME_LABEL,
      browserName: payload.browserName,
      browserVersion: payload.browserVersion,
      capturedAt,
    }));

    const outPath = `${outDir}/web-bench.json`;
    await Bun.write(outPath, `${JSON.stringify(records, null, 2)}\n`);

    console.log(
      `\nbench-web: ${records.length} scenario(s), runtime=${RUNTIME_LABEL} ` +
        `(software-rasterized — SwiftShader via --disable-gpu, not a GPU-backed number), ` +
        `${payload.browserName} ${payload.browserVersion}\n`,
    );
    console.log(['scenario', 'samples', 'p50Ms', 'p95Ms', 'p99Ms'].join('\t'));
    for (const r of records) {
      console.log(
        [r.name, r.samples, r.p50Ms.toFixed(3), r.p95Ms.toFixed(3), r.p99Ms.toFixed(3)].join('\t'),
      );
    }
    console.log(`\nbench-web: wrote ${outPath}`);
  } finally {
    rmSync(rawPath, { force: true });
    server.stop();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
