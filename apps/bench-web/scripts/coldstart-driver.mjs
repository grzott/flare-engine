/**
 * Node-native Playwright driver for the cold-start-to-first-frame measurement.
 *
 * A sibling of `browser-driver.mjs`, not a fold-in: that file polls a single long-running page
 * through the full 18-scenario render suite, while this one needs four short, independent
 * navigations (cache cold/warm × throttle off/on) each requiring its own browser context and, for
 * the throttled pair, a CDP session applying network conditions *before* navigation. Forcing both
 * shapes through one driver would make the render-suite path harder to read for no shared benefit
 * — see `browser-driver.mjs`'s header for why only a real `node` child may call
 * `chromium.launch()` at all; that constraint applies here too.
 *
 * "Cold cache" = a brand-new `browser.newContext()` (Playwright isolates cache per context, so
 * the first navigation in a fresh context has never seen these assets). "Warm cache" = a second
 * `page.goto()` of the same URL in that same context right after, so the same page/session
 * carries the applied throttle (if any) into the second navigation automatically.
 *
 * Measured directly (via CDP `Network.responseReceived.fromDiskCache`) that headless Chromium
 * does not serve the second navigation's WASM fetch from its HTTP disk cache in this harness —
 * true even for two `fetch()` calls back-to-back on the *same* page with no navigation in between,
 * despite a `Cache-Control: public, max-age=31536000, immutable` response header. This is reported
 * as-is rather than papered over: it is why the throttled cold/warm pair below comes out nearly
 * identical (both pay the full download), while the untouched pair still shows a real warm-up gap
 * from non-network effects (V8's WASM compile cache, OS file-read cache for the local dev server).
 * Do not read the throttled numbers as "repeat visits get no benefit on a real 4G connection" —
 * that is a property of this measurement harness, not of browsers in general.
 *
 * #210 A/B, both off unless set (`scripts/ab-210.ts` sets them; `run.ts` refuses to run with either):
 *  - `BENCH_WEB_WASM_ARM` appends `?wasmArm=` to the page URL and adds `wasmArmTaken` +
 *    `wasmRequests` to each entry (`ab-210-wasm-requests.mjs`).
 *  - `BENCH_WEB_COLDSTART_PROFILE=persistent` gives each cold/warm pair a fresh on-disk profile
 *    (`launchPersistentContext` on a new temp dir) instead of `browser.newContext()`. Still cold:
 *    the profile is empty. Probed 2026-11-12 on Chromium 156: a `newContext()` cache never keeps
 *    the 8,242,911-byte `canvaskit.wasm` (a second same-URL fetch reaches the server again), while
 *    it keeps a 4,000,000-byte body, and a fresh on-disk profile keeps the full wasm. That fits a
 *    per-entry size cap in the in-memory cache, and explains the "disk cache does not engage"
 *    paragraph above.
 *
 * Usage: node coldstart-driver.mjs <pageUrl> <configJson> <outFile>
 *   pageUrl:    the bench-web dev server's `/cold-start` URL.
 *   configJson: JSON-encoded { headless, launchArgs, waitTimeoutMs, viewport, fourGProfile } —
 *               fourGProfile is `FOUR_G_PROFILE` from `scripts/payload.ts`, passed through as
 *               plain data (single source of truth stays in the Bun parent).
 *   outFile:    path this script writes `{ coldStart, browserName, browserVersion }` to.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { readWasmArmTaken, watchWasmRequests } from './ab-210-wasm-requests.mjs'; // #210 A/B

// #210 A/B
const WASM_ARM = process.env.BENCH_WEB_WASM_ARM ?? null;
const PROFILE = process.env.BENCH_WEB_COLDSTART_PROFILE ?? 'context';
if (PROFILE !== 'context' && PROFILE !== 'persistent') {
  throw new Error(
    `BENCH_WEB_COLDSTART_PROFILE must be "context" or "persistent", got "${PROFILE}"`,
  );
}

/** #210 A/B: a fresh, empty cache either way — see the header for why `persistent` exists. */
async function openColdContext(browser, config) {
  if (PROFILE === 'context') {
    const context = await browser.newContext({ viewport: config.viewport });
    return { context, close: () => context.close() };
  }
  const dir = await mkdtemp(join(tmpdir(), 'flare-ab210-profile-'));
  const context = await chromium.launchPersistentContext(dir, {
    headless: config.headless,
    args: config.launchArgs,
    viewport: config.viewport,
  });
  return {
    context,
    close: async () => {
      await context.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** @typedef {{ downloadThroughputBytesPerSec: number, uploadThroughputBytesPerSec: number, latencyMs: number }} NetworkProfile */
/** @typedef {{ headless: boolean, launchArgs: string[], waitTimeoutMs: number, viewport: { width: number, height: number }, fourGProfile: NetworkProfile }} DriverConfig */

/** Waits for the cold-start page to finish, on whatever page/context is passed in. */
async function measureOnce(page, waitTimeoutMs) {
  await page.waitForFunction(() => window.__COLDSTART_DONE__ === true, undefined, {
    timeout: waitTimeoutMs,
  });
  const { ms, error } = await page.evaluate(() => ({
    ms: window.__COLDSTART_MS__ ?? null,
    error: window.__COLDSTART_ERROR__ ?? null,
  }));
  if (error !== null) throw new Error(`bench-web cold-start failed in-page: ${error}`);
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new Error('bench-web cold-start: page finished without a finite __COLDSTART_MS__');
  }
  return ms;
}

async function measureColdThenWarm(browser, url, config, throttle) {
  const { context, close } = await openColdContext(browser, config); // #210 A/B
  try {
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error(`[cold-start page error] ${err.message}`));

    // #210 A/B: one session carries both the throttle and the wasm counting.
    const cdp = throttle || WASM_ARM !== null ? await context.newCDPSession(page) : null;
    const wasmRequests = WASM_ARM === null ? null : await watchWasmRequests(cdp);
    const abFields = async () =>
      wasmRequests === null
        ? {}
        : { wasmArmTaken: await readWasmArmTaken(page), wasmRequests: wasmRequests.take() };

    if (throttle) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: config.fourGProfile.latencyMs,
        downloadThroughput: config.fourGProfile.downloadThroughputBytesPerSec,
        uploadThroughput: config.fourGProfile.uploadThroughputBytesPerSec,
      });
    }

    await page.goto(url);
    const coldMs = await measureOnce(page, config.waitTimeoutMs);
    const coldAb = await abFields();

    // A second navigation, not `page.reload()`: a real "reload" gesture forces Chromium to
    // revalidate every sub-resource regardless of freshness, which would make "warm" measure the
    // same thing as "cold" even in a harness where the disk cache does engage.
    await page.goto(url);
    const warmMs = await measureOnce(page, config.waitTimeoutMs);
    const warmAb = await abFields();

    return { coldMs, warmMs, coldAb, warmAb };
  } finally {
    await close();
  }
}

async function main() {
  const [, , url, configJson, outFile] = process.argv;
  if (!url || !configJson || !outFile) {
    throw new Error('usage: node coldstart-driver.mjs <pageUrl> <configJson> <outFile>');
  }
  /** @type {DriverConfig} */
  const config = JSON.parse(configJson);

  const pageUrl = WASM_ARM === null ? url : `${url}?wasmArm=${encodeURIComponent(WASM_ARM)}`; // #210 A/B
  const browser = await chromium.launch({ headless: config.headless, args: config.launchArgs });
  try {
    const plain = await measureColdThenWarm(browser, pageUrl, config, false);
    const throttled = await measureColdThenWarm(browser, pageUrl, config, true);

    const coldStart = [
      { name: 'coldStart.cold', ms: plain.coldMs, network: null, ...plain.coldAb },
      { name: 'coldStart.warm', ms: plain.warmMs, network: null, ...plain.warmAb },
      {
        name: 'coldStart.cold4g',
        ms: throttled.coldMs,
        network: config.fourGProfile,
        ...throttled.coldAb,
      },
      {
        name: 'coldStart.warm4g',
        ms: throttled.warmMs,
        network: config.fourGProfile,
        ...throttled.warmAb,
      },
    ];

    const payload = { coldStart, browserName: chromium.name(), browserVersion: browser.version() };
    await writeFile(outFile, JSON.stringify(payload), 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
