/**
 * Node-native Playwright driver for bench-web.
 *
 * Why this is a separate plain `.mjs` file run by `node`, not folded into `scripts/run.ts`:
 * Playwright cannot launch Chromium under the Bun runtime on this platform. `chromium.launch()`
 * spawns the browser process fine (`<launched> pid=...`), but the `--remote-debugging-pipe`
 * handshake Playwright's pipe transport depends on never completes, because it relies on Node
 * child-process stdio semantics Bun does not match on Windows — probed directly, same machine,
 * same Playwright install: Node v22.14.0 launched in ~318ms, Bun v1.3.11 timed out inside
 * `node_modules/playwright-core/lib/coreBundle.js`. `scripts/run.ts` still runs under Bun — it
 * needs `Bun.serve` + HTML-import bundling for the dev server, which Node cannot do without a
 * separate bundler dependency — so it spawns *this* file as a genuine `node` child process, and
 * only this child ever calls `chromium.launch()`. Do not fold this back into `run.ts` or change
 * its `node` invocation back to `bun`; that reintroduces the 180s launch timeout.
 *
 * Talks to its parent purely through argv in and a JSON file out: no TypeScript, no workspace
 * package imports, nothing beyond the `playwright` devDependency already installed at the
 * workspace root (resolves via normal Node module resolution from this file's location).
 *
 * Usage: node browser-driver.mjs <pageUrl> <configJson> <outFile>
 *   pageUrl:    the bench-web dev server URL (`scripts/server.ts`, started by the Bun parent).
 *   configJson: JSON-encoded { headless, launchArgs, waitTimeoutMs, viewport } — sourced from
 *               `../playwright.config.ts` by the Bun parent (single source of truth for those
 *               values) and passed through here as plain data, never re-declared.
 *   outFile:    path this script writes `{ results, browserName, browserVersion }` to on success.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** @typedef {{ name: string, samples: number, p50Ms: number, p95Ms: number, p99Ms: number }} ScenarioResult */
/** @typedef {{ headless: boolean, launchArgs: string[], waitTimeoutMs: number, viewport: { width: number, height: number } }} DriverConfig */

async function main() {
  const [, , url, configJson, outFile] = process.argv;
  if (!url || !configJson || !outFile) {
    throw new Error('usage: node browser-driver.mjs <pageUrl> <configJson> <outFile>');
  }
  /** @type {DriverConfig} */
  const config = JSON.parse(configJson);

  const browser = await chromium.launch({ headless: config.headless, args: config.launchArgs });
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    page.on('console', (msg) => console.error(`[page] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[page error] ${err.message}`));

    await page.goto(url);
    await page.waitForFunction(() => window.__BENCH_DONE__ === true, undefined, {
      timeout: config.waitTimeoutMs,
    });

    const error = await page.evaluate(() => window.__BENCH_ERROR__ ?? null);
    if (error !== null) throw new Error(`bench-web run failed in-page: ${error}`);

    /** @type {ScenarioResult[]} */
    const results = await page.evaluate(() => window.__BENCH_RESULTS__ ?? []);

    const payload = {
      results,
      browserName: chromium.name(),
      browserVersion: browser.version(),
    };
    await writeFile(outFile, JSON.stringify(payload), 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
