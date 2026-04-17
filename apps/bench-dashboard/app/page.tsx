import { HeadlineCard } from './components/HeadlineCard';
import { getMicrobenchReport } from './lib/data';
import { fmtTime } from './lib/units';

function findResult(
  suites: ReturnType<typeof getMicrobenchReport>['suites'],
  suiteTitle: string,
  scenarioSubstr: string,
) {
  const suite = suites.find((s) => s.title === suiteTitle);
  return suite?.results.find((r) => r.scenario.includes(scenarioSubstr));
}

export default function OverviewPage() {
  const report = getMicrobenchReport();
  const { suites, generated, runtime, platform } = report;

  const ecsStep1k = findResult(suites, 'ECS', '1000 entities');
  const particlesInteg1k = findResult(suites, 'Particles', '1000 integrate-only');
  const renderFlush1k = findResult(suites, 'Render', '1000 sprites / 1 atlas');
  const integFrame1k = findResult(suites, 'Integration', '1000 entities');

  const cards = [
    { result: ecsStep1k, caption: 'ECS step — 1 000 entities' },
    { result: particlesInteg1k, caption: 'Particles integrate — 1 000 alive' },
    { result: renderFlush1k, caption: 'Render flush — 1 000 sprites / 1 atlas' },
    { result: integFrame1k, caption: 'Integration frame — 1 000 entities' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Performance Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generated {generated} &middot; {runtime} &middot; {platform}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ result, caption }) => {
          if (!result) return null;
          const { value, unit } = fmtTime(result.medianNs);
          return <HeadlineCard key={caption} value={value} unit={unit} caption={caption} />;
        })}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-2">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Build metadata
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Runtime</dt>
            <dd className="font-mono text-slate-200">{runtime}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Platform</dt>
            <dd className="font-mono text-slate-200">{platform}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Generated</dt>
            <dd className="font-mono text-slate-200">{generated}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          Reference
        </h2>
        <p className="text-sm text-slate-400">
          Full benchmark report:{' '}
          <a
            href="../../docs/references/benchmarks.md"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            docs/references/benchmarks.md
          </a>
        </p>
      </div>
    </div>
  );
}
