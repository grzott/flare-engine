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

/**
 * Android's own throttling state (`0` = NONE ... `6` = SHUTDOWN) plus battery temperature in
 * degrees C. Both read without root on a retail device.
 *
 * Thermal status is the load-bearing one: it is the OS reporting whether it is currently throttling,
 * which is the on-device analogue of the node lane's foreign-CPU-load guard. Battery temperature is
 * recorded alongside as a continuous signal, because status is a coarse step function that stays at
 * 0 right up until it does not.
 */
function readThermal(serial) {
  const dump = adb(serial, ['shell', 'dumpsys', 'thermalservice']);
  const statusMatch = /Thermal Status:\s*(\d+)/.exec(dump);
  const battery = adb(serial, ['shell', 'dumpsys', 'battery']);
  const tempMatch = /temperature:\s*(-?\d+)/.exec(battery);
  return {
    // `null` rather than a fallback number: "not reported" and "reported as not throttling" are
    // different claims, and a fold that cannot tell them apart would accept an unmeasured device.
    thermalStatus: statusMatch?.[1] === undefined ? null : Number(statusMatch[1]),
    batteryTempC: tempMatch?.[1] === undefined ? null : Number(tempMatch[1]) / 10,
  };
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

  const thermalBefore = readThermal(serial);
  console.error(
    `[android] thermal before: status=${thermalBefore.thermalStatus} battery=${thermalBefore.batteryTempC}C`,
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
    const thermalAfter = readThermal(serial);
    console.error(
      `[android] thermal after:  status=${thermalAfter.thermalStatus} battery=${thermalAfter.batteryTempC}C`,
    );
    await writeFile(
      outFile,
      JSON.stringify({
        results,
        browserName: 'chrome-android',
        browserVersion: version,
        rendererString,
        device,
        thermal: {
          statusBefore: thermalBefore.thermalStatus,
          statusAfter: thermalAfter.thermalStatus,
          batteryTempCBefore: thermalBefore.batteryTempC,
          batteryTempCAfter: thermalAfter.batteryTempC,
        },
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
