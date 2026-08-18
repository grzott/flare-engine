import type { WebRenderResult } from '../lib/types';

/**
 * One web lane's render table. Shared by all three lanes (CPU-raster, desktop GPU, on-device
 * Android) so a column added for one is added for every one — the alternative, three pasted tables,
 * is how a lane ends up quietly missing the column that makes its numbers checkable.
 *
 * **Ops/batch is that column.** Each figure is a measurement window divided by the repetitions that
 * filled it, and `p50 x ops` reconstructs the window. Before 2026-08-18 the sampler derived cost
 * from vsync-locked `requestAnimationFrame` deltas, so every published figure was an integer
 * multiple of the display refresh interval and the cheapest rows reported the refresh rate itself.
 * Showing the window is what makes that failure visible rather than invisible.
 */
export function WebRenderTable({ rows }: { rows: readonly WebRenderResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-left">
            <th className="py-2 pr-4 font-medium">Scenario</th>
            <th className="py-2 pr-4 font-medium text-right">p50</th>
            <th className="py-2 pr-4 font-medium text-right">Spread</th>
            <th className="py-2 pr-4 font-medium text-right">p95</th>
            <th className="py-2 pr-4 font-medium text-right">p99</th>
            <th className="py-2 pr-4 font-medium text-right">Ops/batch</th>
            <th className="py-2 font-medium text-right">Runs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="py-2 pr-4 text-slate-200">{r.name}</td>
              <td className="py-2 pr-4 text-right font-mono text-amber-300">
                {r.p50Ms.toFixed(3)} ms
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                {r.bandMinMs.toFixed(3)} – {r.bandMaxMs.toFixed(3)}
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-300">
                {r.p95Ms.toFixed(3)} ms
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-300">
                {r.p99Ms.toFixed(3)} ms
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-400 text-xs">
                {r.opsPerBatch}
              </td>
              <td className="py-2 text-right font-mono text-slate-400 text-xs">{r.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
