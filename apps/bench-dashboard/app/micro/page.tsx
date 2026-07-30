import { CaptureBanner } from '../components/CaptureBanner';
import { SuiteChart } from '../components/SuiteChart';
import { SuiteTable } from '../components/SuiteTable';
import { assertPublishable, getMicrobenchReport } from '../lib/data';

const SUITE_ORDER = ['ECS', 'Particles', 'Render', 'Physics', 'Integration'];

export default function MicroPage() {
  const report = getMicrobenchReport();
  assertPublishable(report);
  const { suites } = report;

  const ordered = SUITE_ORDER.flatMap((title) => {
    const s = suites.find((x) => x.title === title);
    return s ? [s] : [];
  });
  const rest = suites.filter((s) => !SUITE_ORDER.includes(s.title));
  const all = [...ordered, ...rest];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Microbenchmarks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Per-suite medians with their run-to-run spread
        </p>
      </div>

      <CaptureBanner report={report} />

      {all.map((suite) => (
        <section key={suite.title} className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
            {suite.title}
          </h2>
          <SuiteChart suite={suite} />
          <SuiteTable suite={suite} />
        </section>
      ))}
    </div>
  );
}
