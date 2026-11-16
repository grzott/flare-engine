import { resolve } from 'node:path';
import { applyBenchDevFlag } from './dev-flag.js';
import { integrationBenches } from './integration.bench.js';
import { particlesBenches } from './particles.bench.js';
import { particlesDrawBenches } from './particles-draw.bench.js';
import { renderBenches } from './render.bench.js';
import { renderSystemBenches } from './render-system.bench.js';
import { benchmarksDir, srcDir } from './results.js';

/**
 * Bench-order probe for the coloured sprite path.
 *
 * `particles.draw` is the only row that draws coloured sprites, and in a full
 * capture it runs after every suite that draws uncoloured ones. This probe
 * measures the row twice, each time in fresh processes: alone, and after the
 * four suites that drive `SpriteBatch` and the frame renderer without colours.
 * A coloured path that is robust to that mix reads the same in both.
 *
 * It is a script and not a `bun test`, because it asserts on timings: a shared
 * CI runner cannot hold a 15% band, and a timing gate that flakes is deleted
 * rather than read. Run it on a quiet machine: `bun run bench:order`.
 */

export type OrderMode = 'alone' | 'after-render';

/** How far an after-render reading may sit from the alone median. */
export const ORDER_TOLERANCE_PERCENT = 15;
export const DEFAULT_ORDER_RUNS = 5;

export type OrderRow = {
  afterNs: number;
  /** Signed distance from the alone median; positive is slower. */
  deltaPercent: number;
  within: boolean;
};

export type OrderVerdict = {
  ok: boolean;
  aloneMedianNs: number;
  rows: OrderRow[];
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Every after-render reading is held against the median of the alone readings.
 * Empty input is a failure, not a pass: a probe that measured nothing must not
 * report that the two orders agree.
 */
export function judgeOrder(
  aloneNs: readonly number[],
  afterNs: readonly number[],
  tolerancePercent = ORDER_TOLERANCE_PERCENT,
): OrderVerdict {
  if (aloneNs.length === 0 || afterNs.length === 0) {
    return { ok: false, aloneMedianNs: Number.NaN, rows: [] };
  }
  const aloneMedianNs = median(aloneNs);
  const rows = afterNs.map((ns) => {
    const deltaPercent = ((ns - aloneMedianNs) / aloneMedianNs) * 100;
    return { afterNs: ns, deltaPercent, within: Math.abs(deltaPercent) <= tolerancePercent };
  });
  return { ok: rows.every((r) => r.within), aloneMedianNs, rows };
}

/** One reading of the `particles.draw` row, in this process, in nanoseconds per op. */
export function measureOrder(mode: OrderMode): number {
  applyBenchDevFlag();
  if (mode === 'after-render') {
    // The order `index.ts` runs them in.
    particlesBenches();
    renderBenches();
    integrationBenches();
    renderSystemBenches();
  }
  const row = particlesDrawBenches()[0];
  if (row === undefined) throw new Error('[order-probe] particlesDrawBenches returned no rows');
  return row.nsPerOp.median;
}

function spawnReading(mode: OrderMode): number {
  const proc = Bun.spawnSync(['bun', 'run', resolve(srcDir(), 'order-probe.ts'), '--mode', mode], {
    cwd: benchmarksDir(),
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const line = proc.stdout.toString().trim().split('\n').pop() ?? '';
  const ns = Number(line);
  if (!proc.success || !Number.isFinite(ns) || ns <= 0) {
    throw new Error(`[order-probe] ${mode} child exited ${proc.exitCode} and printed "${line}"`);
  }
  return ns;
}

function us(ns: number): string {
  return `${(ns / 1000).toFixed(1)} us`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const modeArg = argv[argv.indexOf('--mode') + 1];
  if (argv.includes('--mode')) {
    if (modeArg !== 'alone' && modeArg !== 'after-render') {
      console.error(`[order-probe] unknown --mode "${modeArg}" (expected alone or after-render)`);
      process.exit(2);
    }
    console.log(String(measureOrder(modeArg)));
    process.exit(0);
  }

  const parsedRuns = Number.parseInt(argv[argv.indexOf('--runs') + 1] ?? '', 10);
  const runs =
    argv.includes('--runs') && Number.isFinite(parsedRuns) && parsedRuns > 0
      ? parsedRuns
      : DEFAULT_ORDER_RUNS;

  // Interleaved, so a drift in machine load lands on both orders alike.
  const alone: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < runs; i++) {
    alone.push(spawnReading('alone'));
    after.push(spawnReading('after-render'));
  }

  const verdict = judgeOrder(alone, after);
  console.log(`particles.draw alone:        ${alone.map(us).join('  ')}`);
  console.log(`particles.draw after render: ${after.map(us).join('  ')}`);
  console.log(`alone median: ${us(verdict.aloneMedianNs)}`);
  for (const r of verdict.rows) {
    const sign = r.deltaPercent >= 0 ? '+' : '';
    console.log(
      `  after render ${us(r.afterNs).padStart(10)}  ${sign}${r.deltaPercent.toFixed(1)}%  ${r.within ? 'ok' : 'OUTSIDE'}`,
    );
  }
  const passed = verdict.rows.filter((r) => r.within).length;
  console.log(
    `${passed} of ${verdict.rows.length} after-render readings within ${ORDER_TOLERANCE_PERCENT}% of alone`,
  );
  process.exit(verdict.ok ? 0 : 1);
}
