import {
  assertPublishable,
  freshnessOf,
  getWebReport,
  STALE_FAIL_DAYS,
  STALE_WARN_DAYS,
} from '../lib/data';
import { fmtBytes, fmtMs } from '../lib/units';

/**
 * The web (CanvasKit) lane — deliberately its own page, not folded into `/micro`, so the
 * SwiftShader banner below is the first thing a reader sees before any number. These are
 * software-rasterized figures (Chromium headless, `--disable-gpu`), not GPU-backed frame costs;
 * see `runtime: "web-swiftshader"` on every record. Valid for relative comparison (scaling
 * curves, batching strategy, effect cost) — not for predicting real-device fps.
 */
export default function WebPage() {
  const report = getWebReport();
  assertPublishable(report);
  const { render, payload, coldStart } = report;
  const provenance = render[0] ?? payload[0] ?? coldStart[0];
  const { level, ageDays } = freshnessOf(report.generated);
  const days = Math.max(0, Math.floor(ageDays));

  const tone =
    level === 'stale'
      ? 'border-red-500/50 bg-red-500/10 text-red-200'
      : level === 'warn'
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
        : 'border-slate-800 bg-slate-900/60 text-slate-400';

  const defaultRaw = payload.find((p) => p.name === 'canvaskit.default.raw');
  const defaultGzip = payload.find((p) => p.name === 'canvaskit.default.gzip');
  const fullRaw = payload.find((p) => p.name === 'canvaskit.full.raw');
  const fullGzip = payload.find((p) => p.name === 'canvaskit.full.gzip');

  const cold = coldStart.find((c) => c.name === 'coldStart.cold');
  const warm = coldStart.find((c) => c.name === 'coldStart.warm');
  const cold4g = coldStart.find((c) => c.name === 'coldStart.cold4g');
  const warm4g = coldStart.find((c) => c.name === 'coldStart.warm4g');
  const profile = cold4g?.network ?? warm4g?.network;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Web (CanvasKit)</h1>
        <p className="mt-1 text-sm text-slate-500">Render suite, WASM payload, and cold start</p>
      </div>

      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-1">
        <p className="text-sm font-semibold text-amber-200">
          Software-rasterized (SwiftShader), not GPU-backed
        </p>
        <p className="text-xs text-amber-200/80">
          Every number on this page runs Chromium headless with <code>--disable-gpu</code>, forcing
          CPU (SwiftShader) rasterization — the reproducible, driver-independent baseline, not a
          real-world frame cost. Valid for relative comparison (scaling curves, clustered vs.
          interleaved batching, effect cost); not valid for &quot;what fps will a user see&quot;.
          Real GPU-backed device numbers are a separate, future lane.
        </p>
      </div>

      {provenance && (
        <div className={`rounded-lg border p-4 space-y-3 ${tone}`}>
          <p className="text-sm font-medium">
            {level === 'stale'
              ? `Stale: captured ${days} days ago (limit ${STALE_FAIL_DAYS}).`
              : level === 'warn'
                ? `Ageing: captured ${days} days ago (re-capture at ${STALE_WARN_DAYS}+ days).`
                : `Captured ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}.`}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            {(
              [
                [
                  'Captured',
                  new Date(report.generated).toISOString().slice(0, 16).replace('T', ' '),
                ],
                ['Commit', provenance.commit],
                ['Runtime', provenance.runtime],
                ['Host', provenance.host],
                ['Engine version', provenance.appVersion],
                ['Browser', `${provenance.browserName} ${provenance.browserVersion}`],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-mono text-slate-300 break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
          CanvasKit WASM payload
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="py-2 pr-4 font-medium">Variant</th>
                <th className="py-2 pr-4 font-medium text-right">Raw</th>
                <th className="py-2 font-medium text-right">Gzipped</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 pr-4 text-slate-200">default</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-300">
                  {defaultRaw ? fmtBytes(defaultRaw.bytes) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-slate-300">
                  {defaultGzip ? fmtBytes(defaultGzip.bytes) : '—'}
                </td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 pr-4 text-slate-200">full</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-300">
                  {fullRaw ? fmtBytes(fullRaw.bytes) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-slate-300">
                  {fullGzip ? fmtBytes(fullGzip.bytes) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Read straight off the installed <code>canvaskit-wasm</code> package on disk (raw = file
          size, gzipped = <code>gzip -c | wc -c</code>) — never hardcoded.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
          Cold start to first rendered frame
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="py-2 pr-4 font-medium">Cache</th>
                <th className="py-2 pr-4 font-medium text-right">Plain network</th>
                <th className="py-2 font-medium text-right">Throttled 4G</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 pr-4 text-slate-200">cold</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-300">
                  {cold ? fmtMs(cold.ms) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-amber-300">
                  {cold4g ? fmtMs(cold4g.ms) : '—'}
                </td>
              </tr>
              <tr className="border-b border-slate-800/50">
                <td className="py-2 pr-4 text-slate-200">warm</td>
                <td className="py-2 pr-4 text-right font-mono text-slate-300">
                  {warm ? fmtMs(warm.ms) : '—'}
                </td>
                <td className="py-2 text-right font-mono text-slate-300">
                  {warm4g ? fmtMs(warm4g.ms) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {profile && (
          <p className="text-xs text-slate-500">
            4G throttle profile (Chrome DevTools Protocol{' '}
            <code>Network.emulateNetworkConditions</code>, a flare-engine-defined profile, not an
            external tool&apos;s preset): download{' '}
            {((profile.downloadThroughputBytesPerSec * 8) / (1024 * 1024)).toFixed(1)} Mbit/s,
            upload {((profile.uploadThroughputBytesPerSec * 8) / (1024 * 1024)).toFixed(1)} Mbit/s,
            latency {profile.latencyMs} ms.
          </p>
        )}
        <p className="text-xs text-slate-500">
          &quot;First rendered frame&quot; = the first <code>surface.flush()</code> after CanvasKit
          loads, on an off-screen CPU-raster surface (there is no on-screen{' '}
          <code>&lt;canvas&gt;</code>, so browser paint/composite timings do not apply). Measured
          directly that headless Chromium does not serve this WASM fetch from its HTTP disk cache in
          this harness — even for two back-to-back same-page fetches — which is why the throttled
          cold/warm pair reads nearly identical: both pay the full download. Do not read that as
          &quot;repeat visits get no benefit on a real 4G connection&quot; — that is a property of
          this measurement harness, not of browsers in general.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
          Render suite ({render.length} scenarios)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="py-2 pr-4 font-medium">Scenario</th>
                <th className="py-2 pr-4 font-medium text-right">p50</th>
                <th className="py-2 pr-4 font-medium text-right">p95</th>
                <th className="py-2 pr-4 font-medium text-right">p99</th>
                <th className="py-2 font-medium text-right">Samples</th>
              </tr>
            </thead>
            <tbody>
              {render.map((r) => (
                <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 pr-4 text-slate-200">{r.name}</td>
                  <td className="py-2 pr-4 text-right font-mono text-amber-300">
                    {r.p50Ms.toFixed(3)} ms
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-300">
                    {r.p95Ms.toFixed(3)} ms
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-300">
                    {r.p99Ms.toFixed(3)} ms
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400 text-xs">{r.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Same scenario set as the node lane&apos;s Render suite (see{' '}
          <a href="/micro" className="underline hover:text-slate-300">
            Microbench
          </a>
          ), bound here to real CanvasKit instead of a counting Skia stub — the two are comparable
          in shape, not in magnitude, because they measure different pipelines under different
          runtimes.
        </p>
      </section>
    </div>
  );
}
