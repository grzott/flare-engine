#!/usr/bin/env bun
/**
 * check-perf — the Track A hard gate (docs/plans/perf-measurement-2026-07.md
 * §4, §11.5).
 *
 * Track A is the half of the perf story that can fail a PR outright: exact
 * integers that do not depend on machine speed. Wall-clock is Track B — it gets
 * recorded and dashboarded, never hard-gated, because a shared runner swings
 * ±50% and a gate that cries wolf gets deleted.
 *
 * What it reconciles against `.perf-baseline.json`:
 *
 *   1. Draw-path counters — allocations, draw calls per flush, batch runs,
 *      transform writes — measured live by the benchmarks' alloc suite against
 *      a counting Skia stub. Fail-closed in both directions: an empty baseline
 *      fails, a scenario with no key fails, a key with no scenario fails, and
 *      an IMPROVEMENT fails too (it is still a change to a published claim).
 *   2. Published bundle bytes per package (`--bytes`) — ceilings rather than
 *      exact equality, since every legitimate edit moves the byte count.
 *   3. The rubber-stamp guard — a change that edits both `.perf-baseline.json`
 *      and a package's shipped `src` must add a dated `reviews` entry saying
 *      what moved.
 *
 * The freshness half of the gate is its own script: check-perf-freshness.mjs.
 *
 * Usage:
 *   bun scripts/check-perf.mjs                  # counters + review guard (~2 s)
 *   bun scripts/check-perf.mjs --bytes          # + pack all 41 packages (~60 s)
 *   bun scripts/check-perf.mjs --write          # record measured counters
 *   bun scripts/check-perf.mjs --write --bytes  # + create/tighten ceilings
 *
 * `--write` never RAISES a ceiling. Creating a missing one and tightening one
 * that has gone slack are both safe; raising a ceiling to admit a regression is
 * the exact move the review guard exists to catch, so it stays a hand edit.
 *
 * Requires built dists (`bun run build`) — it measures what ships, not src.
 * Exit codes: 0 = green · 1 = gate failed · 2 = setup error.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, gitLines } from './lib/git.mjs';
import {
  declaredEntryPoints,
  discoverPublishTargets,
  REPO_ROOT,
  withPackedTarball,
} from './lib/pack.mjs';
import {
  assertSelftest,
  CEILING_HEADROOM,
  COUNTER_FIELDS,
  reconcileBytes,
  reconcileCounters,
  reconcileReviews,
  STALE_CEILING_RATIO,
} from './lib/perf-gate.mjs';

const BASELINE_PATH = join(REPO_ROOT, '.perf-baseline.json');

const argv = process.argv.slice(2);
const withBytes = argv.includes('--bytes');
const write = argv.includes('--write');

assertSelftest('check-perf');

// --- Baseline ----------------------------------------------------------------

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (err) {
  console.error(`\ncheck-perf: cannot read .perf-baseline.json — ${err.message}\n`);
  process.exit(2);
}

// --- Counters ----------------------------------------------------------------

let allocRows;
try {
  ({ allocRows } = await import('../benchmarks/src/alloc.js'));
} catch (err) {
  console.error(
    `\ncheck-perf: cannot load the counter suite — ${err.message}\n` +
      'This gate measures built dists. Run `bun run build` first.\n',
  );
  process.exit(2);
}

const rows = allocRows();
const counterProblems = write ? [] : reconcileCounters(rows, baseline.counters);

// --- Published bytes ---------------------------------------------------------

const measurePackages = () => {
  const work = mkdtempSync(join(tmpdir(), 'flare-perf-'));
  try {
    return discoverPublishTargets().map((target) => {
      const result = withPackedTarball({ name: target.name, dir: target.dir }, work, ({ meta }) => {
        if (!Number.isInteger(meta.size)) {
          return { ok: false, reason: 'npm pack reported no tarball size' };
        }
        // Same unbuilt-dist guard the tarball audit uses: an unbuilt package
        // packs manifest+README+LICENSE+NOTICE, weighs ~2 KB, and would sail
        // under every ceiling.
        const manifest = JSON.parse(readFileSync(join(target.dir, 'package.json'), 'utf8'));
        const shipped = new Set((meta.files ?? []).map((f) => f.path));
        const missing = declaredEntryPoints(manifest).find((p) => !shipped.has(p));
        if (missing) {
          return {
            ok: false,
            reason: `tarball missing declared entry "${missing}" (dist not built? run: bun run build)`,
          };
        }
        return { ok: true, bytes: meta.size, unpackedBytes: meta.unpackedSize ?? 0 };
      });
      return { name: target.name, ...result };
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};

let measurements = [];
let byteProblems = [];
let byteWarnings = [];
if (withBytes) {
  console.log(`check-perf: packing ${discoverPublishTargets().length} packages…`);
  measurements = measurePackages();
  if (!write) {
    ({ problems: byteProblems, warnings: byteWarnings } = reconcileBytes(
      measurements,
      baseline.bundleBytes,
    ));
  } else {
    // A pack failure is fatal even in --write mode: recording a ceiling from an
    // unbuilt package bakes in a limit nothing can ever exceed.
    for (const m of measurements) {
      if (!m.ok) byteProblems.push(`package "${m.name}" failed to pack — ${m.reason}`);
    }
  }
}

// --- Rubber-stamp guard ------------------------------------------------------

const resolveBaseRef = () => {
  const env = process.env.FLARE_PERF_BASE_REF?.trim();
  if (env && !/^0+$/.test(env) && git('rev-parse', '--verify', '--quiet', `${env}^{commit}`)) {
    return env;
  }
  return git('rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}') ? 'HEAD~1' : null;
};

const changedPaths = (baseRef) => {
  const set = new Set();
  const add = (p) => {
    const clean = p.trim().replace(/\\/g, '/');
    if (clean) set.add(clean);
  };
  if (baseRef) for (const f of gitLines('diff', '--name-only', baseRef, 'HEAD')) add(f);
  // `-uall` expands untracked directories: without it git collapses a brand-new
  // `packages/foo/src/` to the directory alone and the src test misses it.
  for (const line of gitLines('status', '--porcelain', '-uall')) {
    const path = line.slice(3);
    // Renames arrive as "old -> new"; the destination is what changed.
    add(path.includes(' -> ') ? path.slice(path.indexOf(' -> ') + 4) : path);
  }
  return [...set];
};

const baseRef = resolveBaseRef();
const changed = changedPaths(baseRef);
const baselineTouched = changed.includes('.perf-baseline.json');
const srcTouched = changed.some((p) => /^packages\/[^/]+\/src\//.test(p));

let oldReviews = [];
if (baseRef && baselineTouched) {
  try {
    oldReviews = JSON.parse(git('show', `${baseRef}:.perf-baseline.json`)).reviews ?? [];
  } catch {
    oldReviews = [];
  }
}
const reviewProblems = write
  ? []
  : reconcileReviews({
      baselineTouched,
      srcTouched,
      oldReviews,
      newReviews: baseline.reviews,
    });

// --- Write mode --------------------------------------------------------------

if (write) {
  if (byteProblems.length > 0) {
    console.error('\ncheck-perf --write: FAILED — refusing to record from a broken pack:');
    for (const p of byteProblems) console.error(`  - ${p}`);
    console.error('');
    process.exit(1);
  }

  const counters = {};
  for (const row of rows) {
    if (row.problems.length > 0) {
      console.error(
        `\ncheck-perf --write: FAILED — scenario "${row.scenario}" does not satisfy its own ` +
          `in-bench expectation:\n  - ${row.problems.join('\n  - ')}\n\n` +
          'Recording a counter the bench itself calls wrong would publish the bug as the ' +
          'baseline.\n',
      );
      process.exit(1);
    }
    const entry = {};
    for (const field of COUNTER_FIELDS) entry[field] = row[field];
    counters[row.scenario] = entry;
  }
  baseline.counters = counters;

  if (withBytes) {
    const next = { ...(baseline.bundleBytes ?? {}) };
    const stamp = git('log', '-1', '--format=%cs') || '1970-01-01';
    let created = 0;
    let tightened = 0;
    for (const m of measurements) {
      const ceiling = Math.ceil(m.bytes * CEILING_HEADROOM);
      const existing = next[m.name];
      if (existing === undefined) {
        next[m.name] = { ceiling, measured: m.bytes, measuredAt: stamp };
        created++;
      } else if (m.bytes < existing.ceiling * STALE_CEILING_RATIO) {
        next[m.name] = { ceiling, measured: m.bytes, measuredAt: stamp };
        tightened++;
      } else {
        next[m.name] = { ...existing, measured: m.bytes, measuredAt: stamp };
      }
    }
    // Drop ceilings for packages that no longer publish.
    const live = new Set(measurements.map((m) => m.name));
    for (const name of Object.keys(next)) if (!live.has(name)) delete next[name];
    baseline.bundleBytes = next;
    console.log(
      `check-perf --write: ${created} ceiling(s) created, ${tightened} tightened, ` +
        `${measurements.length - created - tightened} left alone (raising is a hand edit).`,
    );
  }

  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(
    `check-perf --write: recorded ${rows.length} counter scenario(s) to .perf-baseline.json.`,
  );
  process.exit(0);
}

// --- Report ------------------------------------------------------------------

const problems = [...counterProblems, ...byteProblems, ...reviewProblems];

for (const w of byteWarnings) console.warn(`check-perf: WARN — ${w}`);

if (problems.length > 0) {
  console.error('\ncheck-perf: FAILED\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nIf a counter moved on purpose, record it: `bun scripts/check-perf.mjs --write`, and ' +
      'add a dated line to `reviews` in .perf-baseline.json saying why.\n',
  );
  process.exit(1);
}

const scope = withBytes
  ? `${rows.length} counter scenario(s), ${measurements.length} package size(s)`
  : `${rows.length} counter scenario(s)`;
console.log(`check-perf: OK — ${scope} match the committed baseline.`);
process.exit(0);
