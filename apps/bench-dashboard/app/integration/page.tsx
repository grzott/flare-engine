import { CaptureBanner } from '../components/CaptureBanner';
import { assertPublishable, getMicrobenchReport } from '../lib/data';
import { fmtOps, fmtTime } from '../lib/units';

export default function IntegrationPage() {
  const report = getMicrobenchReport();
  assertPublishable(report);
  const { suites, heap } = report;
  const suite = suites.find((s) => s.title === 'Integration');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Integration Benchmarks</h1>
        <p className="mt-1 text-sm text-slate-500">Full-engine frame time and heap footprint</p>
      </div>

      <CaptureBanner report={report} />

      {suite && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
            Frame Times
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-left">
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium text-right">Median</th>
                  <th className="py-2 pr-4 font-medium text-right">Spread across runs</th>
                  <th className="py-2 pr-4 font-medium text-right">p99</th>
                  <th className="py-2 font-medium text-right">Ops/sec</th>
                </tr>
              </thead>
              <tbody>
                {suite.results.map((r) => {
                  const median = fmtTime(r.medianNs);
                  const p99 = fmtTime(r.p99Ns);
                  const band =
                    r.bandMinNs === undefined || r.bandMaxNs === undefined
                      ? '—'
                      : `${fmtTime(r.bandMinNs).value} – ${fmtTime(r.bandMaxNs).value} ${fmtTime(r.bandMaxNs).unit}`;
                  return (
                    <tr
                      key={r.scenario}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="py-2 pr-4 text-slate-200">{r.scenario}</td>
                      <td className="py-2 pr-4 text-right font-mono text-amber-300">
                        {median.value}
                        <span className="text-slate-500 text-xs ml-0.5">{median.unit}</span>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                        {band}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-300">
                        {p99.value}
                        <span className="text-slate-500 text-xs ml-0.5">{p99.unit}</span>
                      </td>
                      <td className="py-2 text-right font-mono text-slate-400 text-xs">
                        {fmtOps(r.opsPerSec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
          Heap footprint
        </h2>
        <p className="text-sm text-slate-400">
          Each scenario runs in its own process and warms up until the heap reaches the plateau its
          allocation rate implies, then reports the median per-frame delta with forced GCs at every
          block boundary. Under JSC, <span className="font-mono">heapUsed</span> reports MarkedSpace{' '}
          <em>footprint</em> rather than live bytes, so a delta here is a footprint proxy and cannot
          on its own prove retention — the exact draw-path allocation counters do that.
        </p>
        {heap.length === 0 ? (
          <p className="text-slate-500 text-sm">No heap data recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-left">
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium text-right">Warm-up</th>
                  <th className="py-2 pr-4 font-medium text-right">Frames</th>
                  <th className="py-2 pr-4 font-medium text-right">Per frame</th>
                  <th className="py-2 pr-4 font-medium text-right">Resolution</th>
                  <th className="py-2 pr-4 font-medium text-right">Plateau</th>
                  <th className="py-2 font-medium text-right">Converged</th>
                </tr>
              </thead>
              <tbody>
                {heap.map((h) => {
                  // Below the instrument's resolution is not "zero", and saying
                  // so costs one column. The previous version of this table drew
                  // a red or green bar sized by the raw delta, which coloured GC
                  // scheduling noise as an allocation regression (B2, B25).
                  const subResolution = Math.abs(h.bytesPerFrame) < h.resolutionBytesPerFrame;
                  return (
                    <tr key={h.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2 pr-4 text-slate-200">{h.name}</td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                        {h.warmupFrames.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                        {h.iterations.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-mono ${subResolution ? 'text-slate-400' : 'text-amber-300'}`}
                      >
                        {subResolution
                          ? `< ±${h.resolutionBytesPerFrame.toFixed(0)} B`
                          : `${h.bytesPerFrame.toFixed(0)} B`}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-500 text-xs">
                        ±{h.resolutionBytesPerFrame.toFixed(0)} B
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                        {h.plateauHeapMB.toFixed(2)} MB
                      </td>
                      <td
                        className={`py-2 text-right font-mono text-xs ${h.converged ? 'text-slate-400' : 'text-red-400'}`}
                      >
                        {h.converged ? 'yes' : 'NO'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
