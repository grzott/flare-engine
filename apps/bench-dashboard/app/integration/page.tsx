import { getMicrobenchReport } from '../lib/data';
import { fmtOps, fmtTime } from '../lib/units';

function BytesBar({ bytes }: { bytes: number }) {
  const abs = Math.abs(bytes);
  const kb = (abs / 1024).toFixed(1);
  const positive = bytes >= 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 rounded-full ${positive ? 'bg-red-500/70' : 'bg-green-500/70'}`}
        style={{ width: `${Math.min(100, (abs / 50000) * 100).toFixed(1)}%` }}
      />
      <span className={`font-mono text-xs ${positive ? 'text-red-400' : 'text-green-400'}`}>
        {positive ? '+' : '-'}
        {kb} KB/frame
      </span>
    </div>
  );
}

export default function IntegrationPage() {
  const { suites, heap } = getMicrobenchReport();
  const suite = suites.find((s) => s.title === 'Integration');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Integration Benchmarks</h1>
        <p className="mt-1 text-sm text-slate-500">Full-engine frame time and heap allocation</p>
      </div>

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
                  <th className="py-2 pr-4 font-medium text-right">Min</th>
                  <th className="py-2 pr-4 font-medium text-right">p99</th>
                  <th className="py-2 font-medium text-right">Ops/sec</th>
                </tr>
              </thead>
              <tbody>
                {suite.results.map((r) => {
                  const median = fmtTime(r.medianNs);
                  const min = fmtTime(r.minNs);
                  const p99 = fmtTime(r.p99Ns);
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
                      <td className="py-2 pr-4 text-right font-mono text-slate-300">
                        {min.value}
                        <span className="text-slate-500 text-xs ml-0.5">{min.unit}</span>
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
          Heap Delta
        </h2>
        {heap.length === 0 ? (
          <p className="text-slate-500 text-sm">No heap data recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-left">
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium text-right">Iterations</th>
                  <th className="py-2 pr-4 font-medium text-right">Total delta</th>
                  <th className="py-2 font-medium">Bytes/frame</th>
                </tr>
              </thead>
              <tbody>
                {heap.map((h) => (
                  <tr key={h.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 pr-4 text-slate-200">{h.name}</td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-300">
                      {h.iterations.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                      {(h.deltaBytes / 1024 / 1024).toFixed(2)} MB
                    </td>
                    <td className="py-3 pr-4 min-w-48">
                      <BytesBar bytes={h.bytesPerFrame} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
