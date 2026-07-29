/**
 * Pure reconciliation logic for the Track A perf gate (docs/plans/
 * perf-measurement-2026-07.md §4, §11.5). No I/O, no git, no npm — every
 * function here takes data and returns problems, so the whole decision surface
 * is testable from `selftest()` without packing a tarball or running a bench.
 *
 * The governing rule is **fail-closed**: absence and emptiness are red, never
 * green. That is the B3 lesson encoded — the previous incarnation of this gate
 * was an empty `{}` that passed everything for three months while a 3x render
 * regression shipped. A check that cannot tell "nothing is wrong" from "nothing
 * was checked" is not a check.
 */

/**
 * The exact integers the draw-path gate reconciles. `frames` is deliberately
 * absent: it is a knob the bench chooses, not a property of the engine.
 */
export const COUNTER_FIELDS = [
  'poolMisses',
  'particleFactoryCalls',
  'cachedFactoryCalls',
  'perFrameFactoryCalls',
  'drawAtlasPerFrame',
  'drawImageRectPerFrame',
  'drawRectPerFrame',
  'xformUnrotatedPerFrame',
  'xformRotatedPerFrame',
];

/** Ceilings sit this far above the measured size when first recorded. */
export const CEILING_HEADROOM = 1.1;

/**
 * A ceiling more than this generous has stopped constraining anything — the
 * package shrank and nobody re-tightened it. Warned, not failed: a loose
 * ceiling is sloppy, but failing on it would punish the person who made things
 * smaller.
 */
export const STALE_CEILING_RATIO = 0.7;

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/**
 * Reconciles measured counter rows against the committed baseline.
 *
 * Mismatches fail in BOTH directions. An improvement is still a change to a
 * published claim: if a batching fix drops `drawAtlasPerFrame` from 1000 to 8,
 * that number is in the benchmarks doc and in the README, and it has to be
 * committed rather than silently absorbed.
 */
export function reconcileCounters(rows, baselineCounters) {
  const problems = [];

  if (baselineCounters === undefined || baselineCounters === null) {
    return ['.perf-baseline.json has no "counters" section — nothing is being gated.'];
  }
  if (typeof baselineCounters !== 'object' || Array.isArray(baselineCounters)) {
    return ['.perf-baseline.json "counters" is not an object.'];
  }
  const keys = Object.keys(baselineCounters);
  if (keys.length === 0) {
    return ['.perf-baseline.json "counters" is empty — an empty baseline gates nothing.'];
  }
  if (rows.length === 0) {
    return ['the counter suite produced no rows — the gate measured nothing.'];
  }

  const measured = new Map(rows.map((r) => [r.scenario, r]));

  for (const key of keys) {
    if (!measured.has(key)) {
      problems.push(
        `baseline names scenario "${key}" but the counter suite did not produce it — ` +
          'a scenario cannot be retired by deleting it from the bench.',
      );
    }
  }

  for (const row of rows) {
    const want = baselineCounters[row.scenario];
    if (want === undefined) {
      problems.push(
        `scenario "${row.scenario}" has no baseline entry — new scenarios must be committed ` +
          'before they can pass (bun scripts/check-perf.mjs --write).',
      );
      continue;
    }

    // The bench carries its own derivation of the expected counts; the baseline
    // carries the committed, diff-visible copy. Both must hold. Editing one to
    // match a regression leaves the other red.
    for (const problem of row.problems ?? []) {
      problems.push(`scenario "${row.scenario}" failed its in-bench expectation — ${problem}`);
    }

    const unknown = Object.keys(want).filter((f) => !COUNTER_FIELDS.includes(f));
    for (const f of unknown) {
      problems.push(`scenario "${row.scenario}" baseline has unknown counter "${f}".`);
    }

    let anyNonZero = false;
    for (const field of COUNTER_FIELDS) {
      const expected = want[field];
      const actual = row[field];
      if (!isInt(expected)) {
        problems.push(
          `scenario "${row.scenario}" baseline counter "${field}" is ${JSON.stringify(expected)}, ` +
            'expected an integer.',
        );
        continue;
      }
      if (expected !== 0) anyNonZero = true;
      if (!isInt(actual)) {
        problems.push(
          `scenario "${row.scenario}" measured "${field}" is ${JSON.stringify(actual)}, ` +
            'expected an integer (a fractional per-frame count means the counter did not ' +
            'divide evenly across frames — the scenario is not in steady state).',
        );
        continue;
      }
      if (actual !== expected) {
        const direction = actual > expected ? 'up' : 'down';
        problems.push(
          `scenario "${row.scenario}" counter "${field}": measured ${actual}, baseline ${expected} ` +
            `(${direction}). Improvements must be committed too.`,
        );
      }
    }

    // Liveness floor: an all-zero row is indistinguishable from a scenario that
    // silently stopped running.
    if (!anyNonZero) {
      problems.push(
        `scenario "${row.scenario}" has no nonzero expected counter — a row of zeroes cannot ` +
          'tell "the hot path allocated nothing" from "the hot path never ran".',
      );
    }
  }

  return problems;
}

/**
 * Reconciles measured published sizes against committed ceilings.
 *
 * Ceilings, not exact equality: every legitimate edit moves the byte count, and
 * a gate that fires on a one-line doc change gets disabled within a week.
 */
export function reconcileBytes(measurements, baselineBytes) {
  const problems = [];
  const warnings = [];

  if (baselineBytes === undefined || baselineBytes === null) {
    return { problems: ['.perf-baseline.json has no "bundleBytes" section.'], warnings };
  }
  if (typeof baselineBytes !== 'object' || Array.isArray(baselineBytes)) {
    return { problems: ['.perf-baseline.json "bundleBytes" is not an object.'], warnings };
  }
  const keys = Object.keys(baselineBytes);
  if (keys.length === 0) {
    return { problems: ['.perf-baseline.json "bundleBytes" is empty.'], warnings };
  }
  if (measurements.length === 0) {
    return { problems: ['no packages were packed — the size gate measured nothing.'], warnings };
  }

  const measured = new Map(measurements.map((m) => [m.name, m]));
  for (const key of keys) {
    if (!measured.has(key)) {
      problems.push(
        `baseline names package "${key}" but it was not packed — it is no longer published, ` +
          'or the pack failed.',
      );
    }
  }

  for (const m of measurements) {
    if (!m.ok) {
      problems.push(`package "${m.name}" failed to pack — ${m.reason}`);
      continue;
    }
    const entry = baselineBytes[m.name];
    if (entry === undefined) {
      problems.push(
        `package "${m.name}" has no byte ceiling — every published package must carry one ` +
          '(bun scripts/check-perf.mjs --write --bytes).',
      );
      continue;
    }
    if (!isInt(entry.ceiling) || entry.ceiling <= 0) {
      problems.push(
        `package "${m.name}" ceiling is ${JSON.stringify(entry.ceiling)}, expected a positive integer.`,
      );
      continue;
    }
    if (m.bytes > entry.ceiling) {
      const over = (((m.bytes - entry.ceiling) / entry.ceiling) * 100).toFixed(1);
      problems.push(
        `package "${m.name}" is ${m.bytes} B, ceiling ${entry.ceiling} B (+${over}% over).`,
      );
    } else if (m.bytes < entry.ceiling * STALE_CEILING_RATIO) {
      warnings.push(
        `package "${m.name}" is ${m.bytes} B against a ${entry.ceiling} B ceiling — the ceiling ` +
          'has stopped constraining it; re-tighten with --write --bytes.',
      );
    }
  }

  return { problems, warnings };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_REASON_CHARS = 20;

/**
 * The rubber-stamp guard. Rewriting a counter is a legitimate act — batching
 * changes, draw calls move — but it retires a published claim, and doing it in
 * the same commit that changes the engine is how a regression gets waved
 * through as "the new expected value". So: baseline + engine source in one
 * change requires a dated line saying why.
 */
export function reconcileReviews({ baselineTouched, srcTouched, oldReviews, newReviews }) {
  if (!baselineTouched || !srcTouched) return [];

  const current = Array.isArray(newReviews) ? newReviews : [];
  if (current.length === 0) {
    return ['.perf-baseline.json changed alongside packages/*/src with no "reviews" entry at all.'];
  }

  const previous = Array.isArray(oldReviews) ? oldReviews : [];
  const seen = new Set(previous.map((r) => `${r?.date}|${r?.reason}`));
  const added = current.filter((r) => !seen.has(`${r?.date}|${r?.reason}`));

  if (added.length === 0) {
    return [
      '.perf-baseline.json changed alongside packages/*/src but added no new "reviews" entry — ' +
        'state what moved and why, dated.',
    ];
  }

  const problems = [];
  for (const entry of added) {
    if (!ISO_DATE.test(String(entry?.date ?? ''))) {
      problems.push(`review entry has date ${JSON.stringify(entry?.date)}, expected YYYY-MM-DD.`);
    }
    if (String(entry?.reason ?? '').trim().length < MIN_REASON_CHARS) {
      problems.push(
        `review entry dated ${entry?.date} has no real justification ` +
          `(needs ${MIN_REASON_CHARS}+ characters saying which counter moved and why).`,
      );
    }
  }
  return problems;
}

/**
 * Decides which suites of a capture no longer describe HEAD.
 *
 * `commitsBySuite` maps a suite title to the commits touching its measured
 * sources since the capture commit — an EXACT test, unlike comparing dates: a
 * capture from sixty days ago against untouched sources still describes HEAD
 * perfectly, and a capture from this morning against a source edited since does
 * not. Age is a proxy; reachability is the fact.
 */
export function reconcileFreshness({ suiteTitles, freshness, commitsBySuite, instrumentCommits }) {
  const problems = [];

  if (!freshness || typeof freshness !== 'object') {
    return ['.perf-baseline.json has no "freshness" section — the canary has nothing to check.'];
  }
  const map = freshness.suites;
  if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
    return ['.perf-baseline.json "freshness.suites" is empty — no suite is being watched.'];
  }
  if (suiteTitles.length === 0) {
    return ['the capture contains no suites.'];
  }

  for (const title of suiteTitles) {
    if (!(title in map)) {
      problems.push(
        `capture contains suite "${title}" with no freshness mapping — an unmapped suite is ` +
          'unverifiable, so it is treated as stale.',
      );
    }
  }
  for (const title of Object.keys(map)) {
    if (!suiteTitles.includes(title)) {
      problems.push(
        `freshness maps suite "${title}" which the capture does not contain — the map and the ` +
          'bench have drifted apart.',
      );
    }
  }

  if (instrumentCommits.length > 0) {
    problems.push(
      `the bench itself changed since the capture (${instrumentCommits.length} commit(s) under ` +
        `${(freshness.instrument ?? []).join(', ')}) — every number was measured by a different ` +
        'instrument. First offender: ' +
        instrumentCommits[0],
    );
  }

  for (const title of suiteTitles) {
    const commits = commitsBySuite[title] ?? [];
    if (commits.length > 0) {
      problems.push(
        `suite "${title}" measures sources changed by ${commits.length} commit(s) since the ` +
          `capture. First offender: ${commits[0]}`,
      );
    }
  }

  return problems;
}

// --- Selftest ----------------------------------------------------------------
//
// Run by BOTH CLIs before they trust a green. A gate whose own logic is
// unproven is exactly the failure this arc exists to retire, and a selftest
// wired as a separate optional step is one a hurried session skips.

const baseRow = (scenario, over = {}) => ({
  scenario,
  problems: [],
  poolMisses: 0,
  particleFactoryCalls: 0,
  cachedFactoryCalls: 0,
  perFrameFactoryCalls: 0,
  drawAtlasPerFrame: 1,
  drawImageRectPerFrame: 0,
  drawRectPerFrame: 0,
  xformUnrotatedPerFrame: 1000,
  xformRotatedPerFrame: 0,
  ...over,
});

const baseCounters = (over = {}) => ({
  poolMisses: 0,
  particleFactoryCalls: 0,
  cachedFactoryCalls: 0,
  perFrameFactoryCalls: 0,
  drawAtlasPerFrame: 1,
  drawImageRectPerFrame: 0,
  drawRectPerFrame: 0,
  xformUnrotatedPerFrame: 1000,
  xformRotatedPerFrame: 0,
  ...over,
});

export function selftest() {
  const failures = [];
  const expect = (label, cond) => {
    if (!cond) failures.push(label);
  };
  const fires = (label, problems, needle) =>
    expect(
      `${label} (got: ${problems.length === 0 ? 'nothing' : problems.join(' | ')})`,
      problems.some((p) => p.includes(needle)),
    );

  const rows = [baseRow('alloc.render 1000 / 1 atlas')];
  const clean = { 'alloc.render 1000 / 1 atlas': baseCounters() };

  expect('clean counters reconcile silently', reconcileCounters(rows, clean).length === 0);
  fires('empty baseline fails', reconcileCounters(rows, {}), 'empty');
  fires('missing baseline section fails', reconcileCounters(rows, undefined), 'no "counters"');
  fires('no measured rows fails', reconcileCounters([], clean), 'measured nothing');
  fires(
    'a regressed counter fails',
    reconcileCounters([baseRow('alloc.render 1000 / 1 atlas', { drawAtlasPerFrame: 1000 })], clean),
    'measured 1000, baseline 1',
  );
  fires(
    'an IMPROVED counter fails too',
    reconcileCounters(
      [baseRow('alloc.render 1000 / 1 atlas', { xformUnrotatedPerFrame: 500 })],
      clean,
    ),
    'Improvements must be committed',
  );
  fires(
    'a scenario missing from the baseline fails',
    reconcileCounters([baseRow('alloc.render new')], clean),
    'no baseline entry',
  );
  fires(
    'a baseline key with no scenario fails',
    reconcileCounters(rows, { ...clean, 'alloc.render ghost': baseCounters() }),
    'did not produce it',
  );
  fires(
    'an all-zero row fails the liveness floor',
    reconcileCounters([baseRow('z', { drawAtlasPerFrame: 0, xformUnrotatedPerFrame: 0 })], {
      z: baseCounters({ drawAtlasPerFrame: 0, xformUnrotatedPerFrame: 0 }),
    }),
    'never ran',
  );
  fires(
    'a fractional per-frame count fails',
    reconcileCounters([baseRow('alloc.render 1000 / 1 atlas', { drawAtlasPerFrame: 1.5 })], clean),
    'not in steady state',
  );
  fires(
    "the bench's own expectation is honoured",
    reconcileCounters(
      [baseRow('alloc.render 1000 / 1 atlas', { problems: ['pool misses: 3, expected 0'] })],
      clean,
    ),
    'in-bench expectation',
  );
  fires(
    'an unknown baseline counter fails',
    reconcileCounters(rows, {
      'alloc.render 1000 / 1 atlas': { ...baseCounters(), drawCircles: 0 },
    }),
    'unknown counter',
  );

  const sized = [{ name: '@flare-engine/math', ok: true, bytes: 1000 }];
  expect(
    'a package under its ceiling reconciles silently',
    reconcileBytes(sized, { '@flare-engine/math': { ceiling: 1100 } }).problems.length === 0,
  );
  fires(
    'a package over its ceiling fails',
    reconcileBytes(sized, { '@flare-engine/math': { ceiling: 900 } }).problems,
    'over',
  );
  fires(
    'a package with no ceiling fails',
    reconcileBytes(sized, { '@flare-engine/other': { ceiling: 900 } }).problems,
    'no byte ceiling',
  );
  fires(
    'a failed pack fails',
    reconcileBytes([{ name: '@flare-engine/math', ok: false, reason: 'dist not built' }], {
      '@flare-engine/math': { ceiling: 1100 },
    }).problems,
    'failed to pack',
  );
  fires('an empty byte baseline fails', reconcileBytes(sized, {}).problems, 'empty');
  fires(
    'a stale-generous ceiling warns',
    reconcileBytes(sized, { '@flare-engine/math': { ceiling: 10_000 } }).warnings,
    'stopped constraining',
  );
  expect(
    'a stale-generous ceiling does not fail',
    reconcileBytes(sized, { '@flare-engine/math': { ceiling: 10_000 } }).problems.length === 0,
  );

  const review = { date: '2026-07-29', reason: 'batching fix drops drawAtlas 1000 to 8' };
  expect(
    'a baseline edit without engine source needs no review',
    reconcileReviews({
      baselineTouched: true,
      srcTouched: false,
      oldReviews: [],
      newReviews: [],
    }).length === 0,
  );
  fires(
    'baseline + engine source with no review fails',
    reconcileReviews({
      baselineTouched: true,
      srcTouched: true,
      oldReviews: [review],
      newReviews: [review],
    }),
    'added no new "reviews" entry',
  );
  expect(
    'baseline + engine source with a new review passes',
    reconcileReviews({
      baselineTouched: true,
      srcTouched: true,
      oldReviews: [],
      newReviews: [review],
    }).length === 0,
  );
  fires(
    'a hand-waved review reason fails',
    reconcileReviews({
      baselineTouched: true,
      srcTouched: true,
      oldReviews: [],
      newReviews: [{ date: '2026-07-29', reason: 'updated' }],
    }),
    'no real justification',
  );
  fires(
    'an undated review fails',
    reconcileReviews({
      baselineTouched: true,
      srcTouched: true,
      oldReviews: [],
      newReviews: [{ date: 'today', reason: 'batching fix drops drawAtlas 1000 to 8' }],
    }),
    'expected YYYY-MM-DD',
  );

  const freshness = { instrument: ['benchmarks/src'], suites: { ECS: ['@flare-engine/ecs'] } };
  expect(
    'an untouched capture is fresh',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness,
      commitsBySuite: { ECS: [] },
      instrumentCommits: [],
    }).length === 0,
  );
  fires(
    'a suite whose sources moved is stale',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness,
      commitsBySuite: { ECS: ['abc123 perf(ecs): faster iteration'] },
      instrumentCommits: [],
    }),
    'suite "ECS" measures sources changed',
  );
  fires(
    'a changed instrument stales everything',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness,
      commitsBySuite: { ECS: [] },
      instrumentCommits: ['def456 perf(bench): widen the matrix'],
    }),
    'different instrument',
  );
  fires(
    'an unmapped suite is stale',
    reconcileFreshness({
      suiteTitles: ['ECS', 'Render'],
      freshness,
      commitsBySuite: { ECS: [], Render: [] },
      instrumentCommits: [],
    }),
    'no freshness mapping',
  );
  fires(
    'a mapping with no suite fails',
    reconcileFreshness({
      suiteTitles: [],
      freshness,
      commitsBySuite: {},
      instrumentCommits: [],
    }),
    'no suites',
  );
  fires(
    'a missing freshness section fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: undefined,
      commitsBySuite: {},
      instrumentCommits: [],
    }),
    'no "freshness" section',
  );

  return failures;
}

/** Throws on selftest failure. Both CLIs call this before doing any real work. */
export function assertSelftest(label) {
  const failures = selftest();
  if (failures.length === 0) return;
  console.error(`\n${label}: SELFTEST FAILED — the gate's own logic is broken:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nRefusing to report a result from an unproven gate.\n');
  process.exit(1);
}
