/**
 * `bun run bench:web:promote --lane <cpu-raster|gpu|android> [--runs N] [--refold]`
 *
 * Folds the last N captures of one web lane's append-only history into that lane's published
 * baseline, replacing a single-run figure with a median-of-medians plus the observed spread band.
 * Refusals live in `web-promote.ts`; this file is only I/O and argument handling.
 *
 * **This is the only writer of a published web baseline.** A capture writes a sidecar
 * (`web-latest.json` and friends) and the append-only history; nothing else touches `web.json` /
 * `web-gpu.json` / `web-android.json`. That is what lets the fold refuse a window that brings
 * nothing newer than what is already published — see `judgeWindowRecency`.
 *
 * The lane's `payload` / `coldStart` sections (CPU-raster only) are taken from the newest capture in
 * the folded window, unfolded: they are file-size and load-time measurements, not per-run timings,
 * so folding them would imply a run-to-run variance they do not have.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resultsDir, writeFileAtomic } from './results.js';
import { aggregateWebRuns, groupCaptures, type WebPromoteRow } from './web-promote.js';

/**
 * Every history line, of every kind. `render` lines carry the full `WebPromoteRow`; `payload` and
 * `coldStart` lines carry their own fields, so only the two every kind shares are guaranteed here.
 */
type LaneHistoryLine = Partial<WebPromoteRow> & {
  readonly kind: string;
  readonly capturedAt: string;
};

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

function has(flag: string): boolean {
  return process.argv.includes(flag);
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

const refold = has('--refold');

const { history, baseline } = LANES[lane];
const historyPath = resolve(resultsDir(), history);
const baselinePath = resolve(resultsDir(), baseline);

let lines: LaneHistoryLine[];
try {
  lines = readFileSync(historyPath, 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as LaneHistoryLine);
} catch (err) {
  fail(`cannot read ${historyPath} — ${err instanceof Error ? err.message : String(err)}`);
}

// The published baseline, read before anything is written: its `generated` is what the window has
// to beat. A lane with no baseline yet has nothing to compare against, which is not a refusal.
let existing: { generated?: unknown; payload?: unknown; coldStart?: unknown } = {};
let baselineGeneratedAt: string | null = null;
try {
  existing = JSON.parse(readFileSync(baselinePath, 'utf8')) as typeof existing;
  baselineGeneratedAt = typeof existing.generated === 'string' ? existing.generated : null;
} catch {
  console.log(`bench:web:promote: ${lane} has no readable baseline yet — this is its first fold`);
}

const captures = groupCaptures(lines as readonly WebPromoteRow[]).slice(-wanted);
console.log(`bench:web:promote: ${lane} — folding ${captures.length} capture(s) from ${history}`);

if (refold && baselineGeneratedAt !== null) {
  console.warn(
    'bench:web:promote: WARNING — --refold: not checking this window against the published ' +
      `baseline (${baselineGeneratedAt}). Use this only to re-fold a window that is already ` +
      'published; it is the one flag that can republish old numbers as current.',
  );
}

const outcome = aggregateWebRuns(captures, {
  baselineGeneratedAt: refold ? null : baselineGeneratedAt,
});
if (!outcome.ok) {
  console.error(`\nbench:web:promote: REFUSED — ${outcome.problems.length} problem(s):\n`);
  for (const p of outcome.problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

for (const w of outcome.warnings) console.warn(`bench:web:promote: WARNING — ${w}`);

const newest = captures[captures.length - 1] as WebPromoteRow[];
const head = newest[0] as WebPromoteRow;

// Provenance comes from the newest capture in the window; `generated` is that capture's own stamp,
// never the promote time — the same rule the node lane follows.

/**
 * The non-render sections of the newest folded capture, straight from the history log.
 *
 * They used to be carried over from the previous baseline file, which worked only because a
 * capture rewrote that file itself. Now that a capture writes a sidecar instead, reading them from
 * history is what keeps them current — and the history is the committed evidence, so this needs no
 * gitignored file to exist. Falls back to whatever the baseline already carried.
 */
function sectionOf(kind: string): unknown[] | undefined {
  const picked = lines.filter((l) => l.kind === kind && l.capturedAt === head.capturedAt);
  return picked.length === 0 ? undefined : picked;
}

const payload = sectionOf('payload') ?? existing.payload;
const coldStart = sectionOf('coldStart') ?? existing.coldStart;

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
  ...(payload === undefined ? {} : { payload }),
  ...(coldStart === undefined ? {} : { coldStart }),
};

writeFileAtomic(baselinePath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`bench:web:promote: wrote ${baselinePath} (${outcome.runs} runs folded)\n`);
console.log(['scenario', 'p50Ms', 'band'].join('\t'));
for (const r of outcome.rows) {
  console.log(
    [r.name, r.p50Ms.toFixed(3), `${r.bandMinMs.toFixed(3)}–${r.bandMaxMs.toFixed(3)}`].join('\t'),
  );
}
