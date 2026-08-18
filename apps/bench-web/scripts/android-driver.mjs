/**
 * Node-native driver for the on-device Android lane.
 *
 * Sibling of `browser-driver.mjs`, and a separate file for the same reason that one exists: it runs
 * under `node`, never Bun (see that file's header — Playwright's Chromium transport does not
 * complete its handshake under Bun on this platform), and it talks to its parent purely through
 * argv in and a JSON file out.
 *
 * **It attaches to Chrome; it does not launch it.** Two consequences follow, and both are
 * deliberate:
 *
 *  - `playwright._android`'s `launchBrowser()` was tried first and hangs indefinitely against
 *    retail Chrome on this device. Chrome already publishes `@chrome_devtools_remote` as an
 *    abstract unix socket whenever USB debugging is on, so `adb forward` + `connectOverCDP` reaches
 *    it directly and is the path that works. Verified against Chrome 151 on a Pixel 7.
 *  - Because the browser belongs to the person holding the phone, this driver closes only the page
 *    it opened. `browser.close()` on a CDP-attached Android target disconnects the session rather
 *    than terminating Chrome — verified directly on this device, the app kept its pid across a
 *    full connect/close cycle — but no attempt is made to close tabs the owner had open.
 *
 * The **host** side of the connection is the caller's problem: `run.ts` must have already run
 * `adb reverse tcp:<port> tcp:<port>` so that `http://localhost:<port>` on the phone resolves to the
 * bench server on this machine. This driver only opens the CDP tunnel it needs and removes it again.
 *
 * Usage: node android-driver.mjs <pageUrl> <configJson> <outFile>
 *   pageUrl:    the bench-web dev server URL as the DEVICE must address it (i.e. via the reverse
 *               tunnel), WITHOUT a `?mode=` query — this script appends `?mode=gpu`, since the
 *               on-device lane is by definition the on-screen WebGL path.
 *   configJson: JSON-encoded { cdpPort, waitTimeoutMs, serial }.
 *   outFile:    path this script writes
 *               `{ results, browserName, browserVersion, rendererString, device }` to on success.
 */
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** @typedef {{ name: string, samples: number, p50Ms: number, p95Ms: number, p99Ms: number, opsPerBatch: number, batchMs: number, frameDeltaMs: number }} ScenarioResult */
/** @typedef {{ cdpPort: number, waitTimeoutMs: number, serial: string }} DriverConfig */

function adb(serial, args) {
  return execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function getprop(serial, key) {
  const value = adb(serial, ['shell', 'getprop', key]).trim();
  if (value === '') throw new Error(`android-driver: getprop ${key} returned nothing`);
  return value;
}

async function main() {
  const [, , url, configJson, outFile] = process.argv;
  if (!url || !configJson || !outFile) {
    throw new Error('usage: node android-driver.mjs <pageUrl> <configJson> <outFile>');
  }
  /** @type {DriverConfig} */
  const config = JSON.parse(configJson);
  const { cdpPort, waitTimeoutMs, serial } = config;

  // Read the hardware identity from the device itself. A capture must name the phone it ran on,
  // not the one anyone believed was plugged in.
  const device = {
    model: getprop(serial, 'ro.product.model'),
    codename: getprop(serial, 'ro.product.device'),
    soc: getprop(serial, 'ro.soc.model'),
    androidRelease: getprop(serial, 'ro.build.version.release'),
  };
  console.error(
    `[android] ${device.model} (${device.codename}, ${device.soc}, Android ${device.androidRelease})`,
  );

  adb(serial, ['forward', `tcp:${cdpPort}`, 'localabstract:chrome_devtools_remote']);

  let browser;
  let page;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, { timeout: 30_000 });
    const context = browser.contexts()[0];
    if (context === undefined) throw new Error('android-driver: Chrome exposed no browser context');

    page = await context.newPage();
    page.on('console', (msg) => console.error(`[page] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[page error] ${err.message}`));

    await page.goto(`${url}?mode=gpu`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => window.__BENCH_DONE__ === true, undefined, {
      timeout: waitTimeoutMs,
    });

    const error = await page.evaluate(() => window.__BENCH_ERROR__ ?? null);
    if (error !== null) throw new Error(`android-driver: bench failed in-page: ${error}`);

    /** @type {ScenarioResult[]} */
    const results = await page.evaluate(() => window.__BENCH_RESULTS__);
    const rendererString = await page.evaluate(() => window.__BENCH_RENDERER__ ?? null);

    if (rendererString === null) {
      throw new Error('android-driver: page reported no WebGL renderer string');
    }
    // Same refusal the desktop GPU lane makes: a software rasterizer must never be published under
    // a label that claims device hardware. On a phone this would mean SwiftShader via Chrome's
    // fallback path rather than the Mali/Adreno driver.
    if (/swiftshader|softwarerasterizer|llvmpipe/i.test(rendererString)) {
      throw new Error(
        `android-driver: renderer "${rendererString}" is a software rasterizer — refusing to ` +
          'write a device capture that did not use the device GPU',
      );
    }

    const version = browser.version();
    await writeFile(
      outFile,
      JSON.stringify({
        results,
        browserName: 'chrome-android',
        browserVersion: version,
        rendererString,
        device,
      }),
      'utf8',
    );
    console.error(`[android] renderer: ${rendererString}`);
  } finally {
    // Close only what this script opened, then drop the CDP session. Verified on-device that this
    // leaves the owner's Chrome running with its pid intact and their tabs untouched.
    if (page !== undefined) await page.close().catch(() => {});
    if (browser !== undefined) await browser.close().catch(() => {});
    try {
      adb(serial, ['forward', '--remove', `tcp:${cdpPort}`]);
    } catch {
      // A leaked forward is noise on the next run, not a reason to fail a good capture.
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
