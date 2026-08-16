import { CaptureBanner } from './components/CaptureBanner';
import { HeadlineCard } from './components/HeadlineCard';
import { assertPublishable, getMicrobenchReport } from './lib/data';
import { requireScenario } from './lib/schema';
import { fmtTime } from './lib/units';

export default function OverviewPage() {
  const report = getMicrobenchReport();
  assertPublishable(report);

  // `requireScenario` throws when a headline row is missing. The previous
  // version silently dropped the card, so a renamed scenario would remove a
  // quarter of this page and leave it looking deliberate (B25).
  const cards = [
    {
      result: requireScenario(report, 'ECS', '1000 entities'),
      caption: 'ECS step — 1 000 entities',
    },
    {
      result: requireScenario(report, 'Particles', '1000 integrate-only'),
      caption: 'Particles integrate — 1 000 alive',
    },
    {
      result: requireScenario(report, 'Render', '1000 sprites / 1 atlas'),
      caption: 'Render flush — 1 000 sprites / 1 atlas',
    },
    {
      result: requireScenario(report, 'Integration', '1000 entities'),
      caption: 'Integration frame — 1 000 entities',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Performance Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Off-device microbenchmarks — median of {report.runs ?? 1} independent run
          {report.runs === 1 ? '' : 's'}
        </p>
      </div>

      <CaptureBanner report={report} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ result, caption }) => {
          const { value, unit } = fmtTime(result.medianNs);
          const band =
            result.bandMinNs === undefined || result.bandMaxNs === undefined
              ? undefined
              : `${fmtTime(result.bandMinNs).value}–${fmtTime(result.bandMaxNs).value} ${fmtTime(result.bandMaxNs).unit}`;
          return (
            <HeadlineCard key={caption} value={value} unit={unit} caption={caption} band={band} />
          );
        })}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          What these numbers are not
        </h2>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>
            Pure JS costs under Bun on one desktop machine — no Skia rasterization, no GPU, no
            bridge, no device.
          </li>
          <li>
            Web/CanvasKit numbers exist on the{' '}
            <a href="/web" className="underline hover:text-slate-300">
              Web
            </a>{' '}
            page, but are software-rasterized (SwiftShader) figures — not GPU-backed frame costs.
          </li>
          <li>
            iOS has never been measured at all. <span className="font-mono">PERFORMANCE.md</span> at
            the repository root lists every unmeasured surface.
          </li>
        </ul>
      </div>
    </div>
  );
}
