import { describe, expect, it } from 'bun:test';
import {
  aggregateWebRuns,
  groupCaptures,
  isRising,
  judgeWindowRecency,
  kendallTau,
  MAX_RUN_DEVIATION_PERCENT,
  median,
  TREND_MIN_TAU,
  type WebPromoteRow,
} from '../src/web-promote.js';

function row(over: Partial<WebPromoteRow> & { name: string; p50Ms: number }): WebPromoteRow {
  return {
    kind: 'render',
    p95Ms: over.p50Ms * 1.1,
    p99Ms: over.p50Ms * 1.2,
    samples: 100,
    opsPerBatch: 50,
    batchMs: 20,
    frameDeltaMs: 16.7,
    capturedAt: '2026-08-18T10:00:00.000Z',
    commit: 'abc123',
    runtime: 'web-android-gpu',
    browserVersion: '151.0.0.0',
    rendererString: 'ANGLE (ARM, Mali-G710, OpenGL ES 3.2)',
    device: { model: 'Pixel 7' },
    thermal: { statusBefore: 0, statusAfter: 0 },
    ...over,
  };
}

/** N captures of one scenario at the given per-run values. */
function windowOf(values: readonly number[], over: Partial<WebPromoteRow> = {}): WebPromoteRow[][] {
  return values.map((v, i) => [
    row({
      name: 'render.flush 1000',
      p50Ms: v,
      capturedAt: `2026-08-18T10:0${i}:00.000Z`,
      ...over,
    }),
  ]);
}

describe('median', () => {
  it('averages the middle pair on an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('takes the middle of an odd count regardless of input order', () => {
    expect(median([5, 1, 3])).toBe(3);
  });
});

describe('groupCaptures', () => {
  it('groups rows by capture stamp, oldest first, dropping non-render rows', () => {
    const rows: WebPromoteRow[] = [
      row({ name: 'b', p50Ms: 2, capturedAt: '2026-08-18T11:00:00.000Z' }),
      row({ name: 'a', p50Ms: 1, capturedAt: '2026-08-18T10:00:00.000Z' }),
      { ...row({ name: 'payload', p50Ms: 0 }), kind: 'payload' },
    ];
    const groups = groupCaptures(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.[0]?.name).toBe('a');
    expect(groups[1]?.[0]?.name).toBe('b');
  });
});

describe('aggregateWebRuns — folding', () => {
  it('folds the per-scenario median and reports the observed band', () => {
    const out = aggregateWebRuns(windowOf([1.0, 1.02, 1.04]));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.runs).toBe(3);
    const r = out.rows[0];
    expect(r?.p50Ms).toBeCloseTo(1.02, 6);
    expect(r?.bandMinMs).toBeCloseTo(1.0, 6);
    expect(r?.bandMaxMs).toBeCloseTo(1.04, 6);
    expect(r?.runs).toBe(3);
  });

  it('absorbs a single outlier — one deviant run must not fail a good window', () => {
    // The node lane's guard failed on healthy data the first time precisely because it reacted to
    // one run. A median of five absorbs one by construction, so the gate must too.
    const out = aggregateWebRuns(windowOf([1.0, 1.0, 1.0, 1.0, 5.0]));
    expect(out.ok).toBe(true);
  });

  it('refuses when two or more runs sit outside the deviation ceiling', () => {
    const out = aggregateWebRuns(windowOf([1.0, 1.0, 1.0, 5.0, 5.0]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain(`${MAX_RUN_DEVIATION_PERCENT}%`);
  });

  it('accepts the real measured spread of a healthy device window', () => {
    // Worst per-scenario deviation observed across five unthrottled Pixel 7 captures was 4.3%.
    // A gate that refused this would be refusing healthy data, which is the failure PERF-11 hit.
    const folded = 0.5;
    const out = aggregateWebRuns(
      windowOf([folded * 0.957, folded, folded * 1.043, folded, folded]),
    );
    expect(out.ok).toBe(true);
  });
});

describe('aggregateWebRuns — fail-closed', () => {
  it('refuses a window of one capture', () => {
    const out = aggregateWebRuns(windowOf([1.0]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toMatch(/only 1 capture/);
  });

  it('refuses an empty window', () => {
    expect(aggregateWebRuns([]).ok).toBe(false);
  });

  it('refuses captures from different commits', () => {
    const caps = windowOf([1.0, 1.0]);
    (caps[1] as WebPromoteRow[])[0] = row({ name: 'render.flush 1000', p50Ms: 1.0, commit: 'zzz' });
    const out = aggregateWebRuns(caps);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('commit');
  });

  it('refuses captures from different phones', () => {
    const caps = windowOf([1.0, 1.0]);
    (caps[1] as WebPromoteRow[])[0] = row({
      name: 'render.flush 1000',
      p50Ms: 1.0,
      device: { model: 'Pixel 9' },
    });
    const out = aggregateWebRuns(caps);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('different phones');
  });

  it('refuses captures from different renderers', () => {
    const caps = windowOf([1.0, 1.0]);
    (caps[1] as WebPromoteRow[])[0] = row({
      name: 'render.flush 1000',
      p50Ms: 1.0,
      rendererString: 'ANGLE (NVIDIA, RTX 4070 Ti, D3D11)',
    });
    const out = aggregateWebRuns(caps);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('different hardware');
  });

  it('refuses a capture taken while the device was throttling', () => {
    const out = aggregateWebRuns(
      windowOf([1.0, 1.0], { thermal: { statusBefore: 0, statusAfter: 2 } }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('throttling');
  });

  it('refuses an unreported thermal status rather than assuming it was fine', () => {
    const out = aggregateWebRuns(
      windowOf([1.0, 1.0], { thermal: { statusBefore: null, statusAfter: null } }),
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('unreported');
  });

  it('accepts desktop lanes, which report no thermal state at all', () => {
    const caps = windowOf([1.0, 1.02]).map((c) =>
      c.map((r) => {
        const { thermal: _thermal, device: _device, ...rest } = r;
        return { ...rest, runtime: 'web-gpu' } as WebPromoteRow;
      }),
    );
    expect(aggregateWebRuns(caps).ok).toBe(true);
  });

  it('refuses a window whose scenario set drifted', () => {
    const caps = windowOf([1.0, 1.0]);
    (caps[1] as WebPromoteRow[])[0] = row({ name: 'render.flush 999', p50Ms: 1.0 });
    const out = aggregateWebRuns(caps);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('contract drifted');
  });
});
describe('judgeWindowRecency', () => {
  const published = '2026-09-05T07:07:24.475Z';

  it('accepts a window captured after the published baseline', () => {
    expect(judgeWindowRecency('2026-09-06T08:00:00.000Z', published)).toBeNull();
  });

  it('refuses a window whose newest capture is the one already published', () => {
    // The 2026-08-21 shape: the lane exited before measuring anything, so history did not move
    // and the fold re-published the previous window as current.
    const problem = judgeWindowRecency(published, published);
    expect(problem).not.toBeNull();
    expect(problem).toContain('no new capture landed');
    expect(problem).toContain('--refold');
  });

  it('refuses a window that predates the published baseline', () => {
    const problem = judgeWindowRecency('2026-08-27T22:06:38.600Z', published);
    expect(problem).not.toBeNull();
    expect(problem).toContain('predates the published baseline');
  });

  it('accepts any window when the lane has no baseline yet', () => {
    expect(judgeWindowRecency('2026-01-01T00:00:00.000Z', null)).toBeNull();
  });

  it('refuses when the published baseline carries no usable date', () => {
    const problem = judgeWindowRecency(published, 'whenever');
    expect(problem).not.toBeNull();
    expect(problem).toContain('not a date');
  });

  it('refuses when the capture stamp itself is not a date', () => {
    const problem = judgeWindowRecency('not-a-stamp', published);
    expect(problem).not.toBeNull();
    expect(problem).toContain('history log is damaged');
  });
});

describe('kendallTau', () => {
  it('is +1 for a strict rise, -1 for a strict fall and 0 for a flat series', () => {
    expect(kendallTau([1, 2, 3, 4, 5])).toBe(1);
    expect(kendallTau([5, 4, 3, 2, 1])).toBe(-1);
    expect(kendallTau([1, 1, 1, 1, 1])).toBe(0);
  });

  it('counts ties as 0 rather than as a fall', () => {
    // The recorded 2026-08-21 `1000 sprites / 1 atlas` row: 8 rising pairs, 1 tie, 1 falling.
    expect(kendallTau([0.4319, 0.4413, 0.4413, 0.5405, 0.5263])).toBeCloseTo(0.7, 12);
  });
});

describe('aggregateWebRuns — rising trend on the android lane', () => {
  // PERF-17. A scenario is rising at Kendall tau >= 0.6 with the last run >= 5% above the first;
  // the fold refuses from one third of the scenarios. Values stay inside the 10% spread gate.
  const RISING = [1.0, 1.02, 1.04, 1.06, 1.08];
  const FLAT = [1.0, 1.0, 1.0, 1.0, 1.0];
  const NOISY = [1.0, 1.03, 1.01, 1.04, 1.02];
  const TIED_DIP = [1.0, 1.03, 1.03, 1.07, 1.06];
  const LATE_JUMP = [1.0, 1.0, 1.0, 1.0, 1.06];

  /** One capture per run, one row per series; values stay inside the deviation ceiling. */
  function windowOfSeries(
    series: readonly (readonly number[])[],
    over: Partial<WebPromoteRow> = {},
  ): WebPromoteRow[][] {
    const runs = series[0]?.length ?? 0;
    return Array.from({ length: runs }, (_, i) =>
      series.map((values, s) =>
        row({
          name: `render.flush ${s}`,
          p50Ms: values[i] as number,
          capturedAt: `2026-08-18T10:0${i}:00.000Z`,
          ...over,
        }),
      ),
    );
  }

  function mix(
    n: number,
    rising: number,
    shape: readonly number[] = RISING,
  ): (readonly number[])[] {
    return Array.from({ length: n }, (_, s) => (s < rising ? shape : FLAT));
  }

  it('refuses a window where every scenario rises, naming each with values, tau and rise', () => {
    const out = aggregateWebRuns(windowOfSeries(mix(18, 18)));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const text = out.problems.join('\n');
    expect(text).toContain('18 of 18');
    expect(text).toContain('one third');
    expect(text).toContain('Kendall tau >= 0.6 and last run >= 5% above the first');
    for (let s = 0; s < 18; s++) expect(text).toContain(`"render.flush ${s}"`);
    expect(text).toContain('1.000 -> 1.020 -> 1.040 -> 1.060 -> 1.080; tau 1.00, +8.0%');
  });

  for (const [n, threshold] of [
    [18, 6],
    [7, 3],
  ] as const) {
    it(`refuses exactly ceil(${n}/3) = ${threshold} rising scenarios of ${n}`, () => {
      const out = aggregateWebRuns(windowOfSeries(mix(n, threshold)));
      expect(out.ok).toBe(false);
      if (out.ok) return;
      const text = out.problems.join('\n');
      expect(text).toContain(`${threshold} of ${n}`);
      expect(text).toContain(`refuse at ${threshold}`);
      expect(text).toContain(`"render.flush ${threshold - 1}"`);
      expect(text).not.toContain(`"render.flush ${threshold}"`);
    });

    it(`accepts ${threshold - 1} rising scenarios of ${n} — one under the threshold`, () => {
      expect(aggregateWebRuns(windowOfSeries(mix(n, threshold - 1))).ok).toBe(true);
    });
  }

  it('accepts a flat window', () => {
    expect(aggregateWebRuns(windowOfSeries(mix(18, 0))).ok).toBe(true);
  });

  it('accepts a noisy, non-monotonic window', () => {
    const out = aggregateWebRuns(windowOfSeries(Array.from({ length: 18 }, () => NOISY)));
    expect(out.ok).toBe(true);
  });

  it('does not judge trend on desktop lanes, which carry no thermal state', () => {
    const caps = windowOfSeries(mix(18, 18)).map((c) =>
      c.map((r) => {
        const { thermal: _thermal, device: _device, ...rest } = r;
        return { ...rest, runtime: 'web-gpu' } as WebPromoteRow;
      }),
    );
    expect(aggregateWebRuns(caps).ok).toBe(true);
  });

  it('does not judge a three-run window, even one where every scenario would qualify', () => {
    const threeRuns = Array.from({ length: 18 }, () => [1.0, 1.04, 1.08]);
    expect(threeRuns.every(isRising)).toBe(true);
    expect(aggregateWebRuns(windowOfSeries(threeRuns)).ok).toBe(true);

    const fourRuns = Array.from({ length: 18 }, () => [1.0, 1.03, 1.06, 1.09]);
    expect(aggregateWebRuns(windowOfSeries(fourRuns)).ok).toBe(false);
  });

  it('counts a rise with a tie and a dip — the shape quantized p50s actually take', () => {
    const out = aggregateWebRuns(windowOfSeries(mix(18, 6, TIED_DIP)));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join('\n')).toContain(
      '"render.flush 5" (1.000 -> 1.030 -> 1.030 -> 1.070 -> 1.060; tau 0.70, +6.0%)',
    );
  });

  it('does not count a flat series with one 6% jump at the end', () => {
    const out = aggregateWebRuns(windowOfSeries(Array.from({ length: 18 }, () => LATE_JUMP)));
    expect(out.ok).toBe(true);
  });
});

describe('aggregateWebRuns — rising trend on recorded android windows', () => {
  // p50s from `benchmarks/results/web-android-history.ndjson`, to 10 significant figures: the
  // coarsest rounding that leaves every row's tau, strict-rise and 5%-rise verdict as recorded.
  // At 4 decimals near-equal p50s merge into ties and the tau-only count on 11-04 drops 6 -> 3.
  const REAL_NAMES = [
    'render.flush    100 sprites / 1 atlas',
    'render.flush    500 sprites / 1 atlas',
    'render.flush   1000 sprites / 1 atlas',
    'render.flush   5000 sprites / 1 atlas',
    'render.flush    500 sprites / 4 atlas interleaved',
    'render.flush    500 sprites / 4 atlas clustered',
    'render.flush   1000 sprites / 8 atlas interleaved',
    'render.flush   1000 sprites / 8 atlas clustered',
    'render.flush   1000 sprites / 50% rotated',
    'render.flush   1000 sprites / 100% rotated',
    'render.flush   1000 sprites / 4 alpha runs',
    'render.flush   1000 sprites / tint effect',
    'render.flush   1000 sprites / outline effect',
    'render.flush   1000 sprites / stretch path',
    'render.flush   1000 sprites / zone-bg path',
    'render.sort     500 items (0 swaps)',
    'render.sort     500 items (5 swaps)',
    'render.sort    1000 items (10 swaps)',
  ];

  type RecordedWindow = {
    readonly stamps: readonly string[];
    /** One row per `REAL_NAMES` entry, one value per capture. */
    readonly p50s: readonly (readonly number[])[];
  };

  /** Back-to-back, 47 s apart, `thermalStatus` 0 throughout. */
  const DRIFT_2026_08_21: RecordedWindow = {
    stamps: [
      '2026-08-21T09:34:59.848Z',
      '2026-08-21T09:35:46.768Z',
      '2026-08-21T09:36:33.365Z',
      '2026-08-21T09:37:20.055Z',
      '2026-08-21T09:38:06.859Z',
    ],
    p50s: [
      [0.1136363636, 0.1265822785, 0.1226993865, 0.1428571429, 0.1369863014],
      [0.231034483, 0.25, 0.243902439, 0.2955882352, 0.2970588238],
      [0.4319148932, 0.4413043481, 0.4413043481, 0.5405405405, 0.5263157895],
      [1.872727272, 1.936363635, 1.954545455, 2.333333333, 2.233333333],
      [2.537499998, 2.600000001, 2.649999999, 2.985714287, 3.099999998],
      [0.2702702703, 0.2898550725, 0.276712329, 0.3366666665, 0.350877193],
      [5.575000003, 5.625, 5.774999999, 6.833333333, 6.766666671],
      [0.4744186048, 0.5, 0.5, 0.5941176467, 0.5911764713],
      [0.4466666672, 0.4636363631, 0.4674418603, 0.5513513515, 0.5714285714],
      [0.461363636, 0.4761904762, 0.4785714284, 0.5742857141, 0.5800000003],
      [0.4545454545, 0.4720930228, 0.4697674416, 0.5666666668, 0.5714285714],
      [0.4466666665, 0.4545454545, 0.461363636, 0.5405405405, 0.5555555556],
      [3.114285712, 3.128571429, 3.214285714, 3.733333329, 3.716666669],
      [2.649999999, 2.650000002, 3.433333332, 3.071428571, 3.185714283],
      [2.355555558, 2.355555554, 2.885714284, 2.662499998, 2.762499999],
      [0.001656726309, 0.001716148962, 0.001932740626, 0.001871082421, 0.001868285848],
      [0.004805382028, 0.004967709886, 0.005405405405, 0.005171967934, 0.005393743258],
      [0.01843317972, 0.01836547291, 0.02047082907, 0.01953125, 0.0193986421],
    ],
  };

  /** Gapped, 150-167 s apart. */
  const CLEAN_2026_11_04: RecordedWindow = {
    stamps: [
      '2026-11-04T15:43:57.837Z',
      '2026-11-04T15:46:45.042Z',
      '2026-11-04T15:49:14.746Z',
      '2026-11-04T15:51:44.601Z',
      '2026-11-04T15:54:14.290Z',
    ],
    p50s: [
      [0.1149425287, 0.1203592814, 0.1234567901, 0.1280254777, 0.1204819277],
      [0.2150537634, 0.2298850575, 0.2258426967, 0.2298850575, 0.2148936171],
      [0.3759259259, 0.3921568627, 0.3941176469, 0.3903846153, 0.3740740741],
      [1.725, 1.7, 1.708333333, 1.691666666, 1.691666666],
      [2.422222222, 2.444444444, 2.433333332, 2.455555555, 2.444444444],
      [0.2463414635, 0.258974359, 0.261038961, 0.2610389612, 0.2451219511],
      [5.300000001, 5.350000001, 5.299999997, 5.324999999, 5.350000001],
      [0.440425532, 0.4568181817, 0.4466666669, 0.4590909092, 0.4444444444],
      [0.4208333334, 0.4142857142, 0.4208333334, 0.4142857145, 0.4060000002],
      [0.4297872341, 0.4297872338, 0.4347826087, 0.4276595747, 0.4250000001],
      [0.4208333331, 0.4297872341, 0.4255319149, 0.4319148936, 0.4163265307],
      [0.4040000001, 0.4166666667, 0.4208333331, 0.4166666667, 0.4],
      [2.433333334, 2.444444444, 2.512499999, 2.455555557, 2.477777777],
      [2.411111111, 2.466666667, 2.5, 2.477777779, 2.48888889],
      [2.059999999, 2.090000001, 2.12, 2.109999999, 2.110000001],
      [0.001646903821, 0.00165030118, 0.001649756661, 0.001655081099, 0.001651936896],
      [0.004805382028, 0.004781257471, 0.004792715073, 0.00482509047, 0.004785833932],
      [0.01806684734, 0.01831501832, 0.01823154057, 0.0184501845, 0.01833180568],
    ],
  };

  function recorded(w: RecordedWindow): WebPromoteRow[][] {
    return w.stamps.map((capturedAt, i) =>
      REAL_NAMES.map((name, s) =>
        row({ name, p50Ms: (w.p50s[s] as readonly number[])[i] as number, capturedAt }),
      ),
    );
  }

  it('refuses the 2026-08-21 back-to-back drift by the trend rule, and names the rule', () => {
    // The spread gate refuses this window too (15 rows past 10%), so `ok` alone proves nothing
    // about the trend rule: assert its own line.
    const out = aggregateWebRuns(recorded(DRIFT_2026_08_21));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const trend = out.problems.find((p) => p.includes('Kendall tau')) ?? '';
    expect(trend).toContain('15 of 18');
    expect(trend).toContain(
      '"render.flush   1000 sprites / 1 atlas" (0.4319 -> 0.4413 -> 0.4413 -> 0.5405 -> 0.5263; ' +
        'tau 0.70, +21.9%)',
    );
  });

  it('accepts the clean, gapped 2026-11-04 window', () => {
    expect(aggregateWebRuns(recorded(CLEAN_2026_11_04)).ok).toBe(true);
  });

  it('pins the per-scenario counts the calibration comment cites', () => {
    const count = (w: RecordedWindow, rule: (v: readonly number[]) => boolean): number =>
      w.p50s.filter(rule).length;
    const strictRise = (v: readonly number[]): boolean =>
      v.every((x, j) => j === 0 || x > (v[j - 1] as number));
    const tauOnly = (v: readonly number[]): boolean => kendallTau(v) >= TREND_MIN_TAU;

    // A strict every-run rise misses the quantized drift: 4 is under the threshold of 6.
    expect(count(DRIFT_2026_08_21, strictRise)).toBe(4);
    expect(count(DRIFT_2026_08_21, isRising)).toBe(15);
    // Tau alone reaches the threshold on the clean window; the 5% net rise takes it to zero.
    expect(count(CLEAN_2026_11_04, tauOnly)).toBe(6);
    expect(count(CLEAN_2026_11_04, isRising)).toBe(0);
  });
});

describe('aggregateWebRuns — recency against the published baseline', () => {
  // windowOf stamps captures 10:00, 10:01, 10:02 ... so the newest here is 10:02.
  const newestInWindow = '2026-08-18T10:02:00.000Z';

  it('refuses an otherwise healthy window that brings nothing newer', () => {
    const out = aggregateWebRuns(windowOf([1.0, 1.0, 1.0]), {
      baselineGeneratedAt: newestInWindow,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problems.join(' ')).toContain('no new capture landed');
  });

  it('folds the same window once a newer capture has landed', () => {
    const out = aggregateWebRuns(windowOf([1.0, 1.0, 1.0]), {
      baselineGeneratedAt: '2026-08-18T09:00:00.000Z',
    });
    expect(out.ok).toBe(true);
  });

  it('does not check recency when no baseline stamp is supplied', () => {
    expect(aggregateWebRuns(windowOf([1.0, 1.0, 1.0])).ok).toBe(true);
    expect(aggregateWebRuns(windowOf([1.0, 1.0, 1.0]), { baselineGeneratedAt: null }).ok).toBe(
      true,
    );
  });
});
