import { freshnessOf, STALE_FAIL_DAYS, STALE_WARN_DAYS } from '../lib/data';
import type { MicrobenchReport } from '../lib/types';

/**
 * Provenance and staleness, on every page.
 *
 * Two of the three published perf surfaces in this repo went stale without
 * anyone noticing, for months. The generated markdown now carries its capture
 * date under every table for exactly that reason; this is the same rule applied
 * to the dashboard, which previously showed a bare `generated` string on one
 * page and nothing at all on the others.
 *
 * The date alone was never enough — nobody subtracts dates while reading a
 * chart — so the age is computed and coloured.
 */
export function CaptureBanner({ report }: { report: MicrobenchReport }) {
  const { ageDays, level } = freshnessOf(report.generated);
  const days = Math.max(0, Math.floor(ageDays));

  const tone =
    level === 'stale'
      ? 'border-red-500/50 bg-red-500/10 text-red-200'
      : level === 'warn'
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
        : 'border-slate-800 bg-slate-900/60 text-slate-400';

  const headline =
    level === 'stale'
      ? `Stale: captured ${days} days ago (limit ${STALE_FAIL_DAYS}). These numbers may not describe the current engine.`
      : level === 'warn'
        ? `Ageing: captured ${days} days ago (re-capture at ${STALE_WARN_DAYS}+ days).`
        : `Captured ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}.`;

  const facts = [
    ['Captured', new Date(report.generated).toISOString().slice(0, 16).replace('T', ' ')],
    ['Commit', report.gitSha ?? 'unrecorded'],
    ['Runs folded', report.runs === undefined ? 'single run' : String(report.runs)],
    ['Runtime', report.runtime],
    ['Platform', report.platform],
    ['CPU', report.cpuModel ?? 'unrecorded'],
    ['__DEV__', report.devFlag ?? 'unrecorded'],
    [
      'Foreign load',
      report.foreignLoadPercent === undefined
        ? 'unrecorded'
        : `${report.foreignLoadPercent.toFixed(1)}%`,
    ],
  ] as const;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${tone}`}>
      <p className="text-sm font-medium">{headline}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-mono text-slate-300 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">
        Every number on this page comes from the committed baseline captured at the time above — not
        from the moment this page was built.
      </p>
    </div>
  );
}
