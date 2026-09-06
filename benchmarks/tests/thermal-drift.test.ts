import { describe, expect, it } from 'bun:test';
import {
  aggregateWebRuns,
  TEMP_DRIFT_WARN_C,
  type WebPromoteRow,
  windowTempDriftC,
} from '../src/web-promote.js';

/**
 * PERF-21. `thermalStatus` is a step function that reads 0 right up until it
 * does not, so it cannot fire during the warm-up that actually moves these
 * numbers. Battery temperature was already recorded on every capture and was
 * not consulted — it was not even present on the type the fold reads.
 */
const row = (
  overrides: Partial<WebPromoteRow> & {
    before?: number | null;
    after?: number | null;
    p50Ms?: number;
  } = {},
): WebPromoteRow =>
  ({
    commit: 'abc123',
    host: 'android Pixel 7',
    runtime: 'web-android-gpu',
    appVersion: '0.3.1',
    browserName: 'chrome-android',
    browserVersion: '151',
    capturedAt: '2026-09-05T00:00:00.000Z',
    name: 'render.flush  1000 sprites / 1 atlas',
    kind: 'flush',
    samples: 100,
    opsPerBatch: 10,
    p50Ms: overrides.p50Ms ?? 1,
    p95Ms: 1,
    p99Ms: 1,
    device: { model: 'Pixel 7' },
    thermal: {
      statusBefore: 0,
      statusAfter: 0,
      batteryTempCBefore: overrides.before === undefined ? 25 : overrides.before,
      batteryTempCAfter: overrides.after === undefined ? 25 : overrides.after,
    },
    ...overrides,
  }) as unknown as WebPromoteRow;

/** Five captures whose battery goes `from` -> `to` linearly. */
const window = (from: number, to: number): WebPromoteRow[][] => {
  const n = 5;
  return Array.from({ length: n }, (_, i) => {
    const lo = from + ((to - from) * i) / n;
    const hi = from + ((to - from) * (i + 1)) / n;
    return [row({ before: lo, after: hi, capturedAt: `2026-09-05T00:0${i}:00.000Z` })];
  });
};

describe('windowTempDriftC', () => {
  it('measures first capture BEFORE to last capture AFTER', () => {
    expect(windowTempDriftC(window(29.4, 31.6))).toBeCloseTo(2.2, 5);
  });

  it('is null when a capture did not report temperature', () => {
    expect(windowTempDriftC([[row({ before: null })], [row()]])).toBeNull();
    expect(windowTempDriftC([[row()], [row({ after: null })]])).toBeNull();
  });

  it('reports cooling as a negative drift, not an absolute', () => {
    expect(windowTempDriftC(window(31.6, 29.4))).toBeCloseTo(-2.2, 5);
  });
});

describe('fold warns on thermal drift without refusing', () => {
  it('warns on the real 2026-09-05 window that motivated this gate', () => {
    // 29.4 -> 31.6 C with thermalStatus 0 throughout, alongside a monotone +25%
    // in p50. The existing throttling check saw nothing wrong with it.
    const outcome = aggregateWebRuns(window(29.4, 31.6));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings.join(' ')).toContain('drifted 2.2 C');
    // Crucially a warning, not a refusal: the previous published baseline
    // drifted 2.3 C, so refusing would have rejected it too.
    expect(outcome.rows.length).toBeGreaterThan(0);
  });

  it('stays silent on a thermally steady window', () => {
    const outcome = aggregateWebRuns(window(25, 25.2));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings).toEqual([]);
  });

  it('warns on cooling too — any moving thermal state, not just heating', () => {
    const outcome = aggregateWebRuns(window(31.6, 29.4));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings.join(' ')).toContain('-2.2 C');
  });

  it('warns when temperature was never reported — silence is not steadiness', () => {
    const caps = Array.from({ length: 5 }, (_, i) => [
      row({ before: null, after: null, capturedAt: `2026-09-05T00:0${i}:00.000Z` }),
    ]);
    const outcome = aggregateWebRuns(caps);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings.join(' ')).toContain('not reported');
  });

  it('uses a threshold just past the fold guard 10% band', () => {
    // 1 C bought ~11% of movement on the calibration data; the fold refuses at
    // 10%. Pinned so a later tweak is a deliberate act with the reasoning here.
    expect(TEMP_DRIFT_WARN_C).toBe(1);
  });
});
