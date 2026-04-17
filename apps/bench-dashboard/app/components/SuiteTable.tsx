import type { MicrobenchSuite } from '../lib/types';
import { fmtOps, fmtTime } from '../lib/units';

type SuiteTableProps = {
  suite: MicrobenchSuite;
};

export function SuiteTable({ suite }: SuiteTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-left">
            <th className="py-2 pr-4 font-medium">Scenario</th>
            <th className="py-2 pr-4 font-medium text-right">Median</th>
            <th className="py-2 pr-4 font-medium text-right">Mean</th>
            <th className="py-2 pr-4 font-medium text-right">Min</th>
            <th className="py-2 pr-4 font-medium text-right">p99</th>
            <th className="py-2 font-medium text-right">Ops/sec</th>
          </tr>
        </thead>
        <tbody>
          {suite.results.map((r) => {
            const median = fmtTime(r.medianNs);
            const mean = fmtTime(r.meanNs);
            const min = fmtTime(r.minNs);
            const p99 = fmtTime(r.p99Ns);
            return (
              <tr key={r.scenario} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 pr-4 text-slate-200">{r.scenario}</td>
                <td className="py-2 pr-4 text-right font-mono text-amber-300">
                  {median.value}
                  <span className="text-slate-500 text-xs ml-0.5">{median.unit}</span>
                </td>
                <td className="py-2 pr-4 text-right font-mono text-slate-300">
                  {mean.value}
                  <span className="text-slate-500 text-xs ml-0.5">{mean.unit}</span>
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
  );
}
