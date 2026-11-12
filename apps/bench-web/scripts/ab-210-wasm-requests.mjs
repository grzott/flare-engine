/**
 * #210 A/B: counts how a page got `canvaskit.wasm`, from the Chrome DevTools Protocol, so each A/B
 * row shows whether the glue's fetch went to the network, came from the HTTP cache, or read a
 * `blob:` URL. Used by `browser-driver.mjs` and `coldstart-driver.mjs` only when
 * `BENCH_WEB_WASM_ARM` is set; a normal capture never loads it. Strip with the loader switch.
 */

/** @typedef {{ network: number, cache: number, blob: number }} WasmRequestCounts */

/**
 * Starts counting on `cdp` (a CDP session for the page; pass the throttling session when there is
 * one, so a second session never sits between the page and its network conditions).
 *
 * @param {import('playwright').CDPSession} cdp
 * @returns {Promise<{ take: () => WasmRequestCounts }>} `take` returns the counts since the last
 *   `take` and resets them, so one watcher serves a cold and a warm navigation in turn.
 */
export async function watchWasmRequests(cdp) {
  await cdp.send('Network.enable');
  /** @type {Map<string, { blob: boolean, cache: boolean }>} */
  let seen = new Map();

  cdp.on('Network.requestWillBeSent', (e) => {
    const url = e.request.url;
    const blob = url.startsWith('blob:');
    if (blob || new URL(url).pathname.endsWith('/canvaskit.wasm')) {
      seen.set(e.requestId, { blob, cache: false });
    }
  });
  cdp.on('Network.requestServedFromCache', (e) => {
    const r = seen.get(e.requestId);
    if (r) r.cache = true;
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = seen.get(e.requestId);
    if (r && e.response.fromDiskCache === true) r.cache = true;
  });

  return {
    take() {
      const counts = { network: 0, cache: 0, blob: 0 };
      for (const r of seen.values()) {
        if (r.blob) counts.blob++;
        else if (r.cache) counts.cache++;
        else counts.network++;
      }
      seen = new Map();
      return counts;
    },
  };
}

/**
 * The loader's own record of the path it took (`blob`, `url`, `url-cached` or `fallback`), or
 * `null` when it wrote none, which means the bundled loader has no switch: a stale render-web
 * `dist/`.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string | null>}
 */
export function readWasmArmTaken(page) {
  return page.evaluate(() => window.__FLARE_WASM_ARM_TAKEN ?? null);
}
