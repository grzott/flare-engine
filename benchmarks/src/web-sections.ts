/**
 * Renders the Web (CanvasKit) sections of `docs/references/benchmarks.md`.
 *
 * **Why these are generated rather than hand-written.** `benchmarks.md` is machine-owned — the
 * generator rewrites it wholesale on every `bun run bench:md`. The web numbers were originally
 * hand-appended into that file, which meant the first routine node-lane recapture after they
 * landed silently deleted all of them (payload table, cold start, and both render suites, ~150
 * lines). The section's own text warned it was hand-maintained; a warning is not a guard. Bringing
 * them under the same generator gives the file exactly one owner, which is what makes the deletion
 * impossible rather than merely discouraged.
 *
 * Prose lives here for the same reason it lives in `index.ts` for the node sections: the caveats
 * are part of the published claim, and a table without them invites exactly the misreadings these
 * paragraphs exist to prevent.
 *
 * A lane with no capture file on disk renders an explicit "not captured" note rather than being
 * skipped, so a missing lane reads as missing instead of as never having existed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resultsDir } from './results.js';

type WebRenderRow = {
  readonly kind: string;
  readonly name: string;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly samples: number;
  readonly opsPerBatch: number;
  readonly bandMinMs?: number;
  readonly bandMaxMs?: number;
  readonly runs?: number;
  readonly commit: string;
  readonly runtime: string;
  readonly host: string;
  readonly appVersion: string;
  readonly browserName: string;
  readonly browserVersion: string;
  readonly rendererString?: string;
  readonly device?: {
    readonly model: string;
    readonly codename: string;
    readonly soc: string;
    readonly androidRelease: string;
  };
};

type WebNamedValue = { readonly name: string; readonly bytes?: number; readonly ms?: number };

type WebCaptureFile = {
  readonly generated: string;
  readonly render: readonly WebRenderRow[];
  readonly payload?: readonly WebNamedValue[];
  readonly coldStart?: readonly WebNamedValue[];
};

function loadWebCapture(file: string): WebCaptureFile | null {
  try {
    return JSON.parse(readFileSync(resolve(resultsDir(), file), 'utf8')) as WebCaptureFile;
  } catch {
    return null;
  }
}

const renderRows = (c: WebCaptureFile): WebRenderRow[] =>
  c.render.filter((r) => r.kind === 'render');

function fmtBytes(b: number): string {
  return `${b.toLocaleString('en-US')} B (${(b / 1048576).toFixed(2)} MB)`;
}

/** Date only: the capture's own timestamp, never the render time. */
const day = (iso: string): string => iso.slice(0, 10);

function renderTable(rows: readonly WebRenderRow[], lines: string[]): void {
  lines.push('| Scenario | p50 | Spread across runs | p95 | p99 | Ops/batch |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    const band =
      r.bandMinMs === undefined || r.bandMaxMs === undefined
        ? 'single run'
        : `${r.bandMinMs.toFixed(3)} – ${r.bandMaxMs.toFixed(3)} ms`;
    lines.push(
      `| ${r.name} | ${r.p50Ms.toFixed(3)} ms | ${band} | ${r.p95Ms.toFixed(3)} ms | ` +
        `${r.p99Ms.toFixed(3)} ms | ${r.opsPerBatch} |`,
    );
  }
  lines.push('');
}

function ratioRange(rows: readonly WebRenderRow[], against: Map<string, number>): string {
  const v = rows
    .map((r) => {
      const base = against.get(r.name);
      return base === undefined ? null : r.p50Ms / base;
    })
    .filter((x): x is number => x !== null);
  if (v.length === 0) return 'not comparable';
  return `${Math.min(...v).toFixed(1)}x-${Math.max(...v).toFixed(1)}x`;
}

export function renderWebSections(lines: string[]): void {
  const cpu = loadWebCapture('web.json');
  const gpu = loadWebCapture('web-gpu.json');
  const android = loadWebCapture('web-android.json');

  lines.push('## Web (CanvasKit)');
  lines.push('');

  if (cpu === null && gpu === null && android === null) {
    lines.push(
      'No web captures on disk. Run `bun run bench:web` (and `bench:web:gpu` / `bench:web:android`) in `apps/bench-web`.',
    );
    lines.push('');
    return;
  }

  lines.push(
    'Three lanes over the same 18 render scenarios (frozen in `scenario-contract.ts`), bound to real CanvasKit through `@flare-engine/render-web` instead of the node lane\'s counting Skia stub: **CPU-raster** renders through an offscreen `CanvasKit.MakeSurface`, CPU-backed by construction, which is the driver-independent baseline a CI runner can also produce; **GPU** renders through a real on-screen `<canvas>` + WebGL surface on this desktop; **Android device** runs that same on-screen path on a USB-attached phone. Every record carries `runtime: "web-cpu-raster"`, `"web-gpu"` or `"web-android-gpu"`, never a bare `"web"`, and each lane writes its own results and history files, so they can never be folded into one series.',
  );
  lines.push('');
  lines.push(
    "> **Measurement correction, 2026-08-18 — every web number published before this date was wrong.** The original sampler ran the work once per `requestAnimationFrame` callback and took the frame-to-frame delta as its sample. rAF is vsync-locked, so that delta can only ever be an integer multiple of the display refresh interval, which made every reported figure `k x 16.667 ms / innerIters` for integer `k`. All 36 rows across both lanes were such multiples. **13 of the 18 GPU rows sat at exactly k = 1** — they reported the display's refresh rate and nothing whatsoever about the engine. Work cheaper than one refresh interval was invisible to that clock by construction. The sampler now brackets the work with `performance.now()` and uses rAF only to schedule batches, and grows each batch until it fills a ~20 ms window — long enough that Chrome's 100 us Spectre clamp on `performance.now()` is noise — instead of running a fixed `innerIters` count that was sized for the node bench against a counting stub. Every lane below was captured on the corrected instrument. **Nothing below is comparable to a web capture published before 2026-08-18.**",
  );
  lines.push('');
  lines.push(
    "**Both GPU lanes measure CPU-side submission cost, not GPU execution time.** WebGL and CanvasKit calls queue work and return — `GrDirectContext.flush()` submits, it does not wait — so a clock bracket captures everything the CPU does to build and hand off the frame and none of what the GPU then does with it. Reading true GPU time from page script needs `EXT_disjoint_timer_query_webgl2` (generally not exposed) or a forced `finish()`/`readPixels` sync, which distorts the number by serializing the pipeline. Submission cost is in any case the figure a consumer's frame budget contends with on the main thread.",
  );
  lines.push('');
  lines.push(
    'The **Ops/batch** column is the honesty check: it is how many repetitions filled the measurement window, so `p50 x ops` reconstructs that window. A row whose `p50` equals `refresh / ops` is the failure mode described above, and this column makes it visible rather than invisible.',
  );
  lines.push('');
  lines.push(
    "Sources: `web.json` / `web-gpu.json` / `web-android.json` (folded baseline per lane) with matching `*-history.ndjson` files, each lane kept separate from the node lane's `history.ndjson` so its rows can never land inside `bench:promote`'s blind `rows.slice(-N)` window. Capture with `bun run bench:web`, `bench:web:gpu` or `bench:web:android` in `apps/bench-web`, then fold with `bun run bench:web:promote -- --lane <lane> --runs N` in `benchmarks`. **Every figure below is a median-of-medians across the runs stated in its header, with the observed spread beside it** — the fold refuses a window whose captures disagree on commit, runtime, browser, renderer or phone, one the device was thermally throttling through, or one where two or more runs sit more than 10% from the folded median.",
  );
  lines.push('');

  if (cpu !== null && cpu.payload !== undefined && cpu.payload.length > 0) {
    const pb = (n: string): number => cpu.payload?.find((p) => p.name === n)?.bytes ?? 0;
    lines.push('### CanvasKit WASM payload');
    lines.push('');
    lines.push(
      'Read straight off the installed `canvaskit-wasm` package on disk (raw = file size, gzip = `gzip -c <file> | wc -c`) — never hardcoded.',
    );
    lines.push('');
    lines.push('| Variant | Raw | Gzipped |');
    lines.push('|---|---:|---:|');
    lines.push(
      `| default | ${fmtBytes(pb('canvaskit.default.raw'))} | ${fmtBytes(pb('canvaskit.default.gzip'))} |`,
    );
    lines.push(
      `| full | ${fmtBytes(pb('canvaskit.full.raw'))} | ${fmtBytes(pb('canvaskit.full.gzip'))} |`,
    );
    lines.push('');
    lines.push(
      "`apps/bench-web` serves the `full` binary (needed for the render suite's effect coverage); `default` is the smaller number a production integration that skips those features would ship.",
    );
    lines.push('');
  }

  if (cpu !== null && cpu.coldStart !== undefined && cpu.coldStart.length > 0) {
    const cs = (n: string): number => cpu.coldStart?.find((c) => c.name === n)?.ms ?? 0;
    lines.push('### Cold start to first rendered frame');
    lines.push('');
    lines.push(
      '"First rendered frame" = the first `surface.flush()` after CanvasKit finishes loading, on the off-screen CPU-raster surface the render suite itself uses — there is no on-screen `<canvas>` here, so browser paint/composite timings (FCP etc.) do not apply.',
    );
    lines.push('');
    lines.push('| Cache | Plain network | Throttled 4G |');
    lines.push('|---|---:|---:|');
    lines.push(
      `| cold | ${cs('coldStart.cold').toFixed(1)} ms | ${(cs('coldStart.cold4g') / 1000).toFixed(2)} s |`,
    );
    lines.push(
      `| warm | ${cs('coldStart.warm').toFixed(1)} ms | ${(cs('coldStart.warm4g') / 1000).toFixed(2)} s |`,
    );
    lines.push('');
    lines.push(
      "4G throttle profile (Chrome DevTools Protocol `Network.emulateNetworkConditions`, a flare-engine-defined profile stated here for reproducibility — not a copy of any external tool's preset): **download 4 Mbit/s (524288 B/s), upload 3 Mbit/s (393216 B/s), latency 20 ms**.",
    );
    lines.push('');
    lines.push(
      'The throttled cold/warm pair reads nearly identical. Measured directly (via CDP `Network.responseReceived.fromDiskCache`) that headless Chromium does not serve this WASM fetch from its HTTP disk cache in this harness — true even for two back-to-back same-page fetches with no navigation at all, despite a `Cache-Control: public, max-age=31536000, immutable` response header — so both throttled rows pay the full download. Read that as a property of this headless measurement harness, not as "repeat visits get no benefit on a real 4G connection"; the untouched pair\'s warm speedup (from V8\'s WASM compile cache and local file-read caching, not HTTP caching) is the more representative signal.',
    );
    lines.push('');
  }

  const cpuByName = new Map<string, number>();

  if (cpu !== null) {
    const rows = renderRows(cpu);
    for (const r of rows) cpuByName.set(r.name, r.p50Ms);
    const m = rows[0];
    lines.push('### Render suite — CPU-raster');
    lines.push('');
    if (m !== undefined) {
      lines.push(
        `_Captured: ${day(cpu.generated)} · Median of ${m.runs ?? 1} run(s) · Commit: ${m.commit} · Runtime: ${m.runtime} · Host: ${m.host} · Engine version: ${m.appVersion} · Browser: ${m.browserName} ${m.browserVersion}_`,
      );
      lines.push('');
    }
    lines.push(
      "Comparable to the node [Render](#render) suite in **shape**, not in **magnitude** — different pipeline, different runtime. CanvasKit's software rasterizer does real per-pixel work the node lane's counting stub never performs.",
    );
    lines.push('');
    renderTable(rows, lines);
  }

  const gpuByName = new Map<string, number>();

  if (gpu !== null) {
    const rows = renderRows(gpu);
    for (const r of rows) gpuByName.set(r.name, r.p50Ms);
    const m = rows[0];
    lines.push('### Render suite — desktop GPU');
    lines.push('');
    if (m !== undefined) {
      lines.push(
        `_Captured: ${day(gpu.generated)} · Median of ${m.runs ?? 1} run(s) · Commit: ${m.commit} · Runtime: ${m.runtime} · Host: ${m.host} · Engine version: ${m.appVersion} · Browser: ${m.browserName} ${m.browserVersion} · Renderer: \`${m.rendererString ?? 'unrecorded'}\`_`,
      );
      lines.push('');
    }
    lines.push(
      'Headless Chromium does **not** default to hardware acceleration — with no GPU-related launch flags it silently reports SwiftShader for `UNMASKED_RENDERER_WEBGL` even without `--disable-gpu` — so `playwright.config.ts` pins `--use-angle=d3d11` for this mode, and `browser-driver.mjs` refuses to write a result whose reported renderer still matches `/swiftshader/i`. The renderer string above (`WEBGL_debug_renderer_info`) is the proof this capture used the host GPU.',
    );
    lines.push('');
    renderTable(rows, lines);

    const head = cpuByName.get('render.flush   1000 sprites / 1 atlas');
    const headG = gpuByName.get('render.flush   1000 sprites / 1 atlas');
    if (head !== undefined && headG !== undefined) {
      lines.push(
        `\`render.flush 1000 sprites / 1 atlas\` costs **${headG.toFixed(3)} ms** submitting on the GPU path against **${head.toFixed(3)} ms** rasterizing on the CPU path — a factor of **${(head / headG).toFixed(0)}x** on this one desktop machine. Read that as "CanvasKit's software rasterizer is enormously more expensive than handing the same frame to a GPU driver", not as a figure that generalizes to other hardware or to a mobile GPU.`,
      );
      lines.push('');
    }
    lines.push(
      'The three `render.sort` rows touch neither surface — pure JS array sorting — and read close to one another across both lanes, as expected. **Under the old sampler they read *identically*, and an earlier version of this document credited that to the shared code path. The real cause was that both lanes pinned those rows to the vsync floor.** Freed of it they differ slightly, which is ordinary run-to-run variation on identical work.',
    );
    lines.push('');
  }

  if (android !== null) {
    const rows = renderRows(android);
    const m = rows[0];
    const d = m?.device;
    lines.push('### Render suite — Android device (on-device GPU)');
    lines.push('');
    if (m !== undefined) {
      const dev =
        d === undefined
          ? 'device unrecorded'
          : `${d.model} (${d.codename}, ${d.soc}, Android ${d.androidRelease})`;
      lines.push(
        `_Captured: ${day(android.generated)} · Median of ${m.runs ?? 1} run(s) · Commit: ${m.commit} · Runtime: ${m.runtime} · Device: ${dev} · Engine version: ${m.appVersion} · Browser: ${m.browserName} ${m.browserVersion} · Renderer: \`${m.rendererString ?? 'unrecorded'}\`_`,
      );
      lines.push('');
    }
    lines.push(
      'The same 18 scenarios on real phone hardware, through the identical on-screen `<canvas>` + WebGL path as the desktop GPU lane, so the submission-cost caveat above applies here too.',
    );
    lines.push('');
    lines.push(
      "`bun run bench:web:android` starts the bench server on the host, opens `adb reverse tcp:<port> tcp:<port>` so `localhost:<port>` on the phone resolves back to it, then attaches to the phone's Chrome over its `@chrome_devtools_remote` socket via `adb forward` + `connectOverCDP`. Chrome is **attached to, never launched** — `playwright._android`'s `launchBrowser()` hangs against retail Chrome on this device, and the browser belongs to whoever is holding the phone. The driver refuses to write a capture whose `UNMASKED_RENDERER_WEBGL` reads as a software rasterizer, the same guard the desktop GPU lane uses. Hardware identity comes from `getprop` at capture time, so a row names the phone it actually ran on. Requirements: exactly one authorised device in `adb devices` (the lane refuses zero and refuses to guess between several), USB debugging accepted, screen unlocked throughout.",
    );
    lines.push('');
    renderTable(rows, lines);

    const flush = rows.filter((r) => r.name.startsWith('render.flush'));
    const sort = rows.filter((r) => r.name.startsWith('render.sort'));
    if (gpuByName.size > 0) {
      lines.push(
        `The phone costs **${ratioRange(flush, gpuByName)}** of the desktop's submission time on the flush scenarios and **${ratioRange(sort, gpuByName)}** on \`render.sort\`. That split is the informative part: \`render.sort\` is pure JS with no surface involved, so it isolates raw single-thread JS throughput, where this SoC lands close to a desktop i9. The flush rows add real driver and GPU-submission work, and that is where the gap widens. Neither figure is a frame-rate prediction — it is main-thread cost per operation, which is what a frame budget on this device actually contends with.`,
      );
      lines.push('');
    }
    lines.push(
      "Caveat on repeatability: the phone is thermally and governor-managed in ways the desktop is not. The fold reads Android's own throttling state (`dumpsys thermalservice`) either side of every capture and **refuses any window in which the device reported throttling**, or in which the status was not reported at all — unrecorded is not the same claim as not-throttling. Battery temperature is recorded beside it (23.4 -> 25.7 C across the five folded runs) but deliberately **not** gated: no throttled capture has ever been measured with this instrument, so any drift threshold would be invented rather than calibrated. Nothing here pins the CPU/GPU governor.",
    );
    lines.push('');
  }
}
