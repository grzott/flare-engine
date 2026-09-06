import { describe, expect, it } from 'bun:test';
import {
  aggregateWebRuns,
  groupCaptures,
  judgeWindowRecency,
  MAX_RUN_DEVIATION_PERCENT,
  median,
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
