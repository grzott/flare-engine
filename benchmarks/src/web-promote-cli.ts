/**
 * `bun run bench:web:promote -- --lane <cpu-raster|gpu|android> [--runs N]`
 *
 * Folds the last N captures of one web lane's append-only history into that lane's published
 * baseline, replacing a single-run figure with a median-of-medians plus the observed spread band.
 * Refusals live in `web-promote.ts`; this file is only I/O and argument handling.
 *
 * The lane's `payload` / `coldStart` sections (CPU-raster only) are carried over from the newest
 * capture untouched: they are file-size and load-time measurements, not per-run timings, so folding
 * them would imply a run-to-run variance they do not have.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resultsDir, writeFileAtomic } from './results.js';
import { aggregateWebRuns, groupCaptures, type WebPromoteRow } from './web-promote.js';

const LANES = {
  'cpu-raster': { history: 'web-history.ndjson', baseline: 'web.json' },
  gpu: { history: 'web-gpu-history.ndjson', baseline: 'web-gpu.json' },
  android: { history: 'web-android-history.ndjson', baseline: 'web-android.json' },
} as const;

type LaneName = keyof typeof LANES;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message: string): never {
  console.error(`\nbench:web:promote: ${message}\n`);
  process.exit(1);
}

const laneArg = arg('--lane');
if (laneArg === undefined || !(laneArg in LANES)) {
  fail(`--lane must be one of ${Object.keys(LANES).join(', ')}, got ${String(laneArg)}`);
}
const lane = laneArg as LaneName;
const wanted = Number(arg('--runs') ?? 5);
if (!Number.isFinite(wanted) || wanted < 2) {
  fail(`--runs must be at least 2 (a fold of one run is the single-run figure it replaces)`);
}

const { history, baseline } = LANES[lane];
const historyPath = resolve(resultsDir(), history);

let rows: WebPromoteRow[];
try {
  rows = readFileSync(historyPath, 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as WebPromoteRow);
} catch (err) {
  fail(`cannot read ${historyPath} — ${err instanceof Error ? err.message : String(err)}`);
}

const captures = groupCaptures(rows).slice(-wanted);
console.log(`bench:web:promote: ${lane} — folding ${captures.length} capture(s) from ${history}`);

const outcome = aggregateWebRuns(captures);
if (!outcome.ok) {
  console.error(`\nbench:web:promote: REFUSED — ${outcome.problems.length} problem(s):\n`);
  for (const p of outcome.problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

for (const w of outcome.warnings) console.warn(`bench:web:promote: WARNING — ${w}`);

const newest = captures[captures.length - 1] as WebPromoteRow[];
const head = newest[0] as WebPromoteRow;
const baselinePath = resolve(resultsDir(), baseline);

// Provenance comes from the newest capture in the window; `generated` is that capture's own stamp,
// never the promote time — the same rule the node lane follows.
const existing = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
  payload?: unknown;
  coldStart?: unknown;
};

const provenanceOf = (r: WebPromoteRow): Record<string, unknown> => {
  const { kind, name, p50Ms, p95Ms, p99Ms, samples, opsPerBatch, batchMs, frameDeltaMs, ...rest } =
    r;
  return rest;
};

const rendered = outcome.rows.map((row, i) => ({
  ...provenanceOf(newest[i] as WebPromoteRow),
  kind: 'render' as const,
  name: row.name,
  samples: row.samples,
  p50Ms: row.p50Ms,
  p95Ms: row.p95Ms,
  p99Ms: row.p99Ms,
  bandMinMs: row.bandMinMs,
  bandMaxMs: row.bandMaxMs,
  runs: row.runs,
  opsPerBatch: row.opsPerBatch,
  batchMs: (newest[i] as WebPromoteRow).batchMs,
  frameDeltaMs: (newest[i] as WebPromoteRow).frameDeltaMs,
  unit: 'ms' as const,
}));

const out = {
  schemaVersion: 1 as const,
  generated: head.capturedAt,
  render: rendered,
  ...(existing.payload === undefined ? {} : { payload: existing.payload }),
  ...(existing.coldStart === undefined ? {} : { coldStart: existing.coldStart }),
};

writeFileAtomic(baselinePath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`bench:web:promote: wrote ${baselinePath} (${outcome.runs} runs folded)\n`);
console.log(['scenario', 'p50Ms', 'band'].join('\t'));
for (const r of outcome.rows) {
  console.log(
    [r.name, r.p50Ms.toFixed(3), `${r.bandMinMs.toFixed(3)}–${r.bandMaxMs.toFixed(3)}`].join('\t'),
  );
}
