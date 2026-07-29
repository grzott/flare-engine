#!/usr/bin/env bun
/**
 * check-perf-freshness — the keystone canary (B24, docs/plans/
 * perf-measurement-2026-07.md §11.5).
 *
 * Every other perf gate answers "are the numbers good?". This one answers the
 * question that actually went wrong: **are the numbers still about this code?**
 * The repo published April's microbench through three months of render changes;
 * nothing was lying, the capture had simply stopped describing HEAD and no gate
 * could tell.
 *
 * It compares by REACHABILITY, not by date: for each suite, are there commits
 * touching the sources that suite measures between the capture's commit and
 * HEAD? A capture from sixty days ago against untouched sources still describes
 * HEAD exactly; a capture from this morning against a source edited since does
 * not. Age is a proxy, and it is the wrong one. (Age is separately enforced
 * where it belongs — `bench:md` refuses to render a doc from a baseline older
 * than 30 days.)
 *
 * The measured-source set is the transitive workspace closure of each suite's
 * direct imports, computed from package.json at run time. A hand-written list
 * would be wrong within a release: `render` pulls `math`, so a `math` commit
 * stales every render number, and nobody remembers that in review.
 *
 * `benchmarks/src` stales EVERY suite: if the instrument changed, the numbers
 * were taken by a different instrument. PERF-4a is the precedent — a corrected
 * bench moved the headline render row from 486 µs to 55.6 µs without a single
 * line of engine code changing.
 *
 * Escape hatch: `FLARE_PERF_ALLOW_STALE=1` (env, not a flag — flags get eaten
 * at the bun/turbo boundary). It must be typed on purpose; CI never sets it.
 *
 * Exit codes: 0 = fresh · 1 = stale · 2 = setup error.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dirtyPaths, git, gitOk } from './lib/git.mjs';
import { REPO_ROOT, workspaceClosure } from './lib/pack.mjs';
import { assertSelftest, reconcileFreshness } from './lib/perf-gate.mjs';

const BASELINE_PATH = join(REPO_ROOT, '.perf-baseline.json');
const CAPTURE_PATH = join(REPO_ROOT, 'benchmarks', 'results', 'microbench.json');
const DOC_PATH = join(REPO_ROOT, 'docs', 'references', 'benchmarks.md');

assertSelftest('check-perf-freshness');

const readJson = (path, label) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`\ncheck-perf-freshness: cannot read ${label} — ${err.message}\n`);
    process.exit(2);
  }
};

const baseline = readJson(BASELINE_PATH, '.perf-baseline.json');
const capture = readJson(CAPTURE_PATH, 'benchmarks/results/microbench.json');

const fail = (lines) => {
  console.error('\ncheck-perf-freshness: STALE — the published numbers no longer describe HEAD\n');
  for (const l of lines) console.error(`  - ${l}`);
  console.error(
    '\nRe-capture and re-publish:\n' +
      // `bench`, not `bench:baseline`: the latter is --write-baseline and would
      // overwrite the tracked baseline with a single-run capture on every one of
      // the five runs. Plain `bench` appends to history; promote folds it.
      '  bun run bench            (x5, from a clean tree — appends history)\n' +
      '  bun run bench:promote\n' +
      '  bun run bench:md\n' +
      '\nTo proceed anyway (knowing the doc is wrong): set FLARE_PERF_ALLOW_STALE=1.\n' +
      '  PowerShell:  $env:FLARE_PERF_ALLOW_STALE=1; bun run check:perf-freshness\n',
  );
  process.exit(1);
};

// --- Provenance preconditions ------------------------------------------------

const provenance = [];
const sha = capture.gitSha;
if (typeof sha !== 'string' || sha === '' || sha === 'unknown') {
  provenance.push(
    'the capture does not name the commit it measured — a baseline that cannot be located in ' +
      'history cannot be checked against HEAD.',
  );
} else if (!git('rev-parse', '--verify', '--quiet', `${sha}^{commit}`)) {
  provenance.push(
    `the capture names commit ${sha}, which is not in this checkout (shallow clone, or history ` +
      'rewritten since).',
  );
} else if (!gitOk('merge-base', '--is-ancestor', sha, 'HEAD')) {
  provenance.push(
    `the capture's commit ${sha} is not an ancestor of HEAD — it was taken on a different ` +
      'branch, so "changed since" is undefined.',
  );
}
if (capture.gitDirty === true) {
  provenance.push('the capture was taken from a dirty tree — it describes no commit at all.');
}
if (provenance.length > 0) fail(provenance);

// --- Measured-source resolution ----------------------------------------------

const freshness = baseline.freshness;
const suiteTitles = (capture.suites ?? []).map((s) => s.title);
const commitsSince = (paths) =>
  paths.length === 0
    ? []
    : git('log', '--format=%h %s', `${sha}..HEAD`, '--', ...paths)
        .split('\n')
        .filter(Boolean);

/**
 * Uncommitted edits count as staleness too.
 *
 * Committed history alone is not enough for the LOCAL gate: at `/close` the row
 * being closed is still in the working tree, so a commit-only check reports
 * fresh for exactly the change about to invalidate the capture, and the red
 * only appears in CI after the push. That is fails-green in the one place a
 * builder can still act on it cheaply.
 */
const dirtyLabels = (paths) => dirtyPaths(paths).map((p) => `${p} (uncommitted)`);

const commitsBySuite = {};
const mappingProblems = [];
for (const [title, names] of Object.entries(freshness?.suites ?? {})) {
  const closure = workspaceClosure(names);
  if (closure.unknown.length > 0) {
    mappingProblems.push(
      `freshness maps suite "${title}" to unknown package(s) ${closure.unknown.join(', ')}.`,
    );
    continue;
  }
  const paths = closure.dirs.map((d) => `packages/${d}/src`);
  commitsBySuite[title] = [...commitsSince(paths), ...dirtyLabels(paths)];
}
if (mappingProblems.length > 0) {
  console.error('\ncheck-perf-freshness: FAILED\n');
  for (const p of mappingProblems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

const instrumentPaths = freshness?.instrument ?? [];
const instrumentCommits = [...commitsSince(instrumentPaths), ...dirtyLabels(instrumentPaths)];

// Heap rows are captured by the same run and covered by a suite's mapping; an
// unmapped one would go unwatched, so it is treated as stale.
const heapProblems = [];
for (const row of capture.heap ?? []) {
  const prefix = Object.keys(freshness?.heapSuites ?? {}).find((p) => row.name.startsWith(p));
  if (prefix === undefined) {
    heapProblems.push(`heap row "${row.name}" matches no "freshness.heapSuites" prefix.`);
    continue;
  }
  const title = freshness.heapSuites[prefix];
  if (!(title in commitsBySuite)) {
    heapProblems.push(
      `heap row "${row.name}" maps to suite "${title}", which has no freshness mapping.`,
    );
  }
}

/**
 * The published doc must have been rendered FROM this baseline.
 *
 * Every other check here guards `microbench.json`. But the artefact people read
 * is `docs/references/benchmarks.md`, and it is regenerated by a separate
 * command — so a capture + promote that stopped short of `bun run bench:md`
 * leaves the page showing the previous commit's numbers while the baseline,
 * and every gate over it, is green. That is the original disease with one extra
 * step in front of it.
 */
const docProblems = [];
try {
  const doc = readFileSync(DOC_PATH, 'utf8');
  const stamped = doc.match(/<!--\s*flare-capture:\s*([0-9a-f]+|unrecorded)\s*-->/)?.[1];
  if (stamped === undefined) {
    docProblems.push(
      'docs/references/benchmarks.md carries no capture stamp — it predates the stamp, so it ' +
        'cannot be shown to describe this baseline. Re-render: bun run bench:md',
    );
  } else if (stamped !== sha) {
    docProblems.push(
      `docs/references/benchmarks.md was rendered from capture ${stamped}, but the baseline is ` +
        `${sha} — the published page is showing older numbers. Re-render: bun run bench:md`,
    );
  }
} catch {
  docProblems.push('docs/references/benchmarks.md is missing — re-render: bun run bench:md');
}

const problems = [
  ...reconcileFreshness({ suiteTitles, freshness, commitsBySuite, instrumentCommits }),
  ...heapProblems,
  ...docProblems,
];

if (problems.length > 0) {
  if (process.env.FLARE_PERF_ALLOW_STALE === '1') {
    console.warn('\ncheck-perf-freshness: STALE, overridden by FLARE_PERF_ALLOW_STALE=1\n');
    for (const p of problems) console.warn(`  - ${p}`);
    console.warn('\nThe published benchmarks doc describes older code than HEAD.\n');
    process.exit(0);
  }
  fail(problems);
}

console.log(
  `check-perf-freshness: OK — ${suiteTitles.length} suite(s) captured at ${sha} still describe ` +
    'HEAD (no commits under any measured source since).',
);
process.exit(0);
