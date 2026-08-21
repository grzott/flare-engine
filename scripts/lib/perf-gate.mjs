/**
 * Pure reconciliation logic for the Track A perf gate (docs/plans/
 * perf-measurement-2026-07.md §4, §11.5). No I/O, no git, no npm — every
 * function here takes data and returns problems, so the whole decision surface
 * is testable from `selftest()` without packing a tarball or running a bench.
 *
 * The governing rule is **fail-closed**: absence and emptiness are red, never
 * green. That is the B8 lesson encoded — this file's predecessor was a literal
 * `{}` that gated nothing, while the published render numbers drifted 3.1x out
 * of date across April to July. A check that cannot tell "nothing is wrong"
 * from "nothing was checked" is not a check, and neither is a threshold file
 * with no thresholds in it.
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

    // The reverse direction: a counter the BENCH now reports but COUNTER_FIELDS
    // does not list is never compared, never written by `--write`, and never
    // missed by anything — it would be a gate-shaped hole in the shape of a new
    // feature. `frames` is the one legitimate non-counter number on the row.
    const ungated = Object.keys(row).filter(
      (f) => f !== 'frames' && typeof row[f] === 'number' && !COUNTER_FIELDS.includes(f),
    );
    for (const f of ungated) {
      problems.push(
        `the bench reports counter "${f}" (scenario "${row.scenario}") which COUNTER_FIELDS does ` +
          'not list, so nothing gates it. Add it to COUNTER_FIELDS and re-run --write.',
      );
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
 * `commitsBySuite` maps a suite title to the changes touching its measured
 * sources since the capture commit — committed AND uncommitted — an EXACT test,
 * unlike comparing dates: a capture from sixty days ago against untouched
 * sources still describes HEAD perfectly, and a capture from this morning
 * against a source edited since does not. Age is a proxy; reachability is the
 * fact. Uncommitted edits count because the local gate runs before the commit
 * exists, and that is the last cheap moment to re-capture.
 */
/**
 * Judges one web lane's folded capture, for everything that can be decided from the file alone.
 *
 * Split out from `check-perf-freshness` so it runs under `selftest()` like every other rule here:
 * the git-dependent half (is the commit an ancestor, what changed since) stays in the script,
 * because it cannot be evaluated without a repository.
 *
 * The three lanes went unwatched entirely until PERF-15 — `freshness.suites` covers only the five
 * node suites, so a web capture could go stale, thin out to a single run, or be deleted with every
 * gate green.
 */
export function judgeWebLane(file, laneJson, lane, opts = {}) {
  const problems = [];
  const minRuns = opts.minRuns ?? 2;
  const rows = Array.isArray(laneJson?.render) ? laneJson.render : [];

  if (rows.length === 0) {
    problems.push(`web lane ${file} records no render rows.`);
    return problems;
  }

  const runtimes = [...new Set(rows.map((r) => r.runtime))];
  if (runtimes.length !== 1 || runtimes[0] !== lane.runtime) {
    problems.push(
      `web lane ${file} should record runtime "${lane.runtime}" but records ${runtimes
        .map((r) => `"${r}"`)
        .join(', ')} — lanes must never be folded into one series.`,
    );
  }

  const thin = rows.filter((r) => (r.runs ?? 0) < minRuns);
  if (thin.length > 0) {
    problems.push(
      `web lane ${file} has ${thin.length} row(s) folded from fewer than ${minRuns} runs — a fold ` +
        'of one reports a spread band of zero, which reads as precision it does not have.',
    );
  }

  // "Unrecorded" is not "clean" — the node lane's numbers were ~2.5x wrong because nothing
  // recorded the power plan they were taken under. Which provenance matters is per lane, because
  // the lanes do not measure the same machine: on the two desktop lanes the host IS the subject,
  // so its power plan governs; on the device lane the phone is the subject and the desktop merely
  // drives CDP, so what governs is the device identity and its thermal state either side.
  if (lane.machineProvenance === 'host') {
    if (rows.some((r) => r.powerSchemeGuid === undefined && r.powerScheme === undefined)) {
      problems.push(
        `web lane ${file} records no power plan for its capture — it predates machine-condition ` +
          'provenance, so it cannot be shown to have been taken under the conditions the node ' +
          'baseline was. Land provenance recording in apps/bench-web, then re-capture the lane.',
      );
    }
  } else if (lane.machineProvenance === 'device') {
    if (rows.some((r) => r.device === undefined || r.thermal === undefined)) {
      problems.push(
        `web lane ${file} records no device identity or thermal state — an on-device number must ` +
          'name the phone it ran on and show it was not throttling.',
      );
    }
  }

  const commits = [...new Set(rows.map((r) => r.commit).filter(Boolean))];
  if (commits.length !== 1) {
    problems.push(
      `web lane ${file} mixes ${commits.length} capture commit(s) — it is not one measurement.`,
    );
  }

  return problems;
}

export function reconcileFreshness({ suiteTitles, freshness, commitsBySuite, instrumentCommits }) {
  const problems = [];

  if (!freshness || typeof freshness !== 'object') {
    return ['.perf-baseline.json has no "freshness" section — the canary has nothing to check.'];
  }
  const map = freshness.suites;
  if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length === 0) {
    return ['.perf-baseline.json "freshness.suites" is empty — no suite is being watched.'];
  }
  if (suiteTitles.length === 0) {
    return ['the capture contains no suites.'];
  }

  // The watch LISTS themselves must be checked, not just their contents.
  //
  // An empty or malformed list produces an empty path set, an empty path set
  // produces no commits, and no commits reads as "fresh" — so deleting a key
  // is indistinguishable from nothing having changed. That is the same shape as
  // the `{}` baseline this gate replaced, one level up: the check would still
  // run, still print OK, and still be watching nothing.
  const instrument = freshness.instrument;
  if (!Array.isArray(instrument) || instrument.length === 0) {
    problems.push(
      `.perf-baseline.json "freshness.instrument" is ${JSON.stringify(instrument)} — it must be a ` +
        'non-empty array of paths. With no instrument path a rewritten bench reads as fresh, ' +
        'which is exactly the PERF-4a failure (486 µs -> 55.6 µs with zero engine changes).',
    );
  } else if (instrument.some((p) => typeof p !== 'string' || p.trim() === '')) {
    problems.push('.perf-baseline.json "freshness.instrument" contains a non-string path.');
  }

  for (const [title, names] of Object.entries(map)) {
    if (!Array.isArray(names) || names.length === 0) {
      problems.push(
        `freshness maps suite "${title}" to ${JSON.stringify(names)} — it must be a non-empty ` +
          'array of package names, or the suite is permanently "fresh".',
      );
    } else if (names.some((n) => typeof n !== 'string' || !n.startsWith('@'))) {
      problems.push(
        `freshness maps suite "${title}" to something that is not a list of package names ` +
          `(${JSON.stringify(names)}).`,
      );
    }
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
      `the bench itself changed since the capture (${instrumentCommits.length} change(s) under ` +
        `${(freshness.instrument ?? []).join(', ')}) — every number was measured by a different ` +
        'instrument. First offender: ' +
        instrumentCommits[0],
    );
  }

  for (const title of suiteTitles) {
    const commits = commitsBySuite[title] ?? [];
    if (commits.length > 0) {
      problems.push(
        `suite "${title}" measures sources changed by ${commits.length} change(s) since the ` +
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

  // --- web lanes (PERF-15) ---------------------------------------------------
  const webLane = { runtime: 'web-cpu-raster', machineProvenance: 'host' };
  const webDeviceLane = { runtime: 'web-android-gpu', machineProvenance: 'device' };
  const webRow = (over = {}) => ({
    runtime: 'web-cpu-raster',
    runs: 5,
    commit: 'abc123abc123',
    powerSchemeGuid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',
    ...over,
  });
  const webOpts = { minRuns: 2 };

  expect(
    'a complete web lane judges clean',
    judgeWebLane('web.json', { render: [webRow()] }, webLane, webOpts).length === 0,
  );
  fires(
    'a deleted/empty web lane fails',
    judgeWebLane('web.json', { render: [] }, webLane, webOpts),
    'records no render rows',
  );
  fires(
    'a web lane folded from one run fails',
    judgeWebLane('web.json', { render: [webRow({ runs: 1 })] }, webLane, webOpts),
    'fewer than 2 runs',
  );
  fires(
    'a web lane recording the wrong runtime fails',
    judgeWebLane('web.json', { render: [webRow({ runtime: 'web-gpu' })] }, webLane, webOpts),
    'never be folded into one series',
  );
  fires(
    'a web lane mixing capture commits fails',
    judgeWebLane(
      'web.json',
      { render: [webRow(), webRow({ commit: 'def456def456' })] },
      webLane,
      webOpts,
    ),
    'is not one measurement',
  );
  fires(
    'a web lane without machine provenance fails',
    judgeWebLane(
      'web.json',
      { render: [webRow({ powerSchemeGuid: undefined })] },
      webLane,
      webOpts,
    ),
    'records no power plan',
  );
  expect(
    'machine provenance is not demanded when a lane declares none',
    judgeWebLane(
      'web.json',
      { render: [webRow({ powerSchemeGuid: undefined })] },
      { runtime: 'web-cpu-raster' },
      webOpts,
    ).length === 0,
  );
  // The device lane is judged on the phone's provenance, not the desktop's: the desktop only
  // drives CDP there, so demanding its power plan would refuse a capture for an irrelevant reason.
  expect(
    'the device lane accepts device identity + thermal instead of a host power plan',
    judgeWebLane(
      'web-android.json',
      {
        render: [
          webRow({
            runtime: 'web-android-gpu',
            powerSchemeGuid: undefined,
            device: { model: 'Pixel 7' },
            thermal: { statusBefore: 0, statusAfter: 0 },
          }),
        ],
      },
      webDeviceLane,
      webOpts,
    ).length === 0,
  );
  fires(
    'the device lane fails without thermal state',
    judgeWebLane(
      'web-android.json',
      { render: [webRow({ runtime: 'web-android-gpu', device: { model: 'Pixel 7' } })] },
      webDeviceLane,
      webOpts,
    ),
    'not throttling',
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
  fires(
    'a bench counter missing from COUNTER_FIELDS fails',
    reconcileCounters([baseRow('alloc.render 1000 / 1 atlas', { drawCirclesPerFrame: 7 })], clean),
    'nothing gates it',
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
    'a mapping naming a suite the capture lacks fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: { ...freshness, suites: { ...freshness.suites, Ghost: ['@flare-engine/render'] } },
      commitsBySuite: { ECS: [], Ghost: [] },
      instrumentCommits: [],
    }),
    'which the capture does not contain',
  );
  fires(
    'a capture with no suites fails',
    reconcileFreshness({
      suiteTitles: [],
      freshness,
      commitsBySuite: {},
      instrumentCommits: [],
    }),
    'no suites',
  );
  fires(
    'a missing instrument list fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: { suites: freshness.suites },
      commitsBySuite: { ECS: [] },
      instrumentCommits: [],
    }),
    '"freshness.instrument" is undefined',
  );
  fires(
    'an empty instrument list fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: { ...freshness, instrument: [] },
      commitsBySuite: { ECS: [] },
      instrumentCommits: [],
    }),
    'non-empty array of paths',
  );
  fires(
    'a stringified instrument list fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: { ...freshness, instrument: 'benchmarks/src' },
      commitsBySuite: { ECS: [] },
      instrumentCommits: [],
    }),
    'non-empty array of paths',
  );
  fires(
    'a suite mapped to an empty package list fails',
    reconcileFreshness({
      suiteTitles: ['ECS'],
      freshness: { ...freshness, suites: { ECS: [] } },
      commitsBySuite: { ECS: [] },
      instrumentCommits: [],
    }),
    'permanently "fresh"',
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
