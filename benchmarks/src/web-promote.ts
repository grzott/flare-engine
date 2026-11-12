/**
 * Folds N web-lane captures into one baseline — the web lanes' equivalent of `promote.ts`.
 *
 * Until this existed, every published web figure was a **single run**. The node lane learned in
 * PERF-2 why that is not enough: two identical runs of the same scenario can differ by more than
 * the change anyone is trying to detect, so a single capture is a coin flip inside a band nobody
 * can see. This module produces the band.
 *
 * **Fail-closed, for the same reason `promote.ts` is:** the output becomes the reference every
 * later run is judged against, so averaging-anyway is the wrong default. Runs that are not one
 * measurement (different commit, runtime, browser, renderer or phone) are refused rather than
 * blended, and so is a window the device was throttling through.
 *
 * ## Threshold calibration
 *
 * `MAX_RUN_DEVIATION_PERCENT` is 10, against **measured** healthy data rather than a guess —
 * fifteen captures, five per lane, all on hardware behaving normally:
 *
 * | lane | largest single-run deviation | median across scenarios |
 * |---|---|---|
 * | CPU-raster | 7.9% | 0.6% |
 * | desktop GPU | 8.0% | 2.4% |
 * | Android (Pixel 7, thermal status 0 throughout, battery 23.4 -> 25.7 C) | 4.3% | 3.0% |
 *
 * The worst healthy single-run deviation anywhere was **8.0%**, so a 10% ceiling has only ~1.25x
 * magnitude headroom — thin on its own. What carries the gate is the second condition: it takes
 * **two** runs past the ceiling to refuse, and across all fifteen healthy captures no scenario had
 * even one. A median absorbs a single outlier by construction, so the gate must too; two deviant
 * runs mean the median is straddling two states.
 *
 * Note the desktop lanes are *noisier* than the phone, which is the opposite of the intuition that
 * motivated a device-specific guard.
 *
 * **Stated limit, and it is the same one PERF-11 recorded:** this is calibrated from below only.
 * No throttled capture has ever been measured with this instrument, so the deviation ceiling is
 * not validated against the failure it is meant to catch. That is why throttling is caught
 * *directly* by `thermalStatus` — the OS reporting its own state — rather than inferred from
 * spread. The spread check is a backstop for causes the thermal API does not name.
 *
 * Battery-temperature drift is **recorded but deliberately not gated**: nothing here has ever
 * observed what drift magnitude corresponds to a bad capture, and a threshold invented for it
 * would be the exact mistake this docstring exists to avoid.
 */

/** Two or more runs this far from the folded median mean the median is straddling two states. */
export const MAX_RUN_DEVIATION_PERCENT = 10;

/** One outlier in a window is absorbed by a median; two are a signal. */
export const MIN_DEVIANT_RUNS = 2;

export type WebPromoteRow = {
  readonly kind: string;
  readonly name: string;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly samples: number;
  readonly opsPerBatch: number;
  readonly batchMs: number;
  readonly frameDeltaMs: number;
  readonly capturedAt: string;
  readonly commit: string;
  readonly runtime: string;
  readonly browserVersion: string;
  readonly rendererString?: string;
  readonly device?: { readonly model: string };
  readonly thermal?: {
    readonly statusBefore: number | null;
    readonly statusAfter: number | null;
    /**
     * Recorded by the capture since the lane existed, but absent from this type
     * until PERF-21 — so the fold could not see it even though every row
     * carried it. That is the mechanical reason drift went ungated while
     * `thermalStatus` (a step function) was the only signal consulted.
     */
    readonly batteryTempCBefore?: number | null;
    readonly batteryTempCAfter?: number | null;
  };
};

export type WebFoldedRow = {
  readonly name: string;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly bandMinMs: number;
  readonly bandMaxMs: number;
  readonly samples: number;
  readonly opsPerBatch: number;
  readonly runs: number;
};

export type WebAggregateOutcome =
  | {
      readonly ok: true;
      readonly rows: WebFoldedRow[];
      readonly runs: number;
      /** Non-blocking observations. Reported, never a reason to refuse. */
      readonly warnings: string[];
    }
  | { readonly ok: false; readonly problems: string[] };

/**
 * Battery-temperature drift across a folded window, in Celsius, or null when
 * any capture failed to report it.
 *
 * Split out from the judging so it can be tested against fixed rows.
 */
export function windowTempDriftC(captures: readonly WebPromoteRow[][]): number | null {
  const first = captures[0]?.[0]?.thermal;
  const last = captures[captures.length - 1]?.[0]?.thermal;
  const from = first?.batteryTempCBefore;
  const to = last?.batteryTempCAfter;
  if (from === null || from === undefined || to === null || to === undefined) return null;
  return to - from;
}

/**
 * Warn above this much drift across a window.
 *
 * Calibrated 2026-09-05 (PERF-21), not invented: across 15 Pixel 7 captures the
 * battery climbed 29.4 -> 31.6 C (+2.2) while `render.flush 1000 / 1 atlas` p50
 * moved 0.417 -> 0.521 ms (+25%) monotonically, with `thermalStatus` reading 0
 * throughout. So roughly 1 C of drift buys ~11% of movement — just past the 10%
 * band the fold guard already enforces, which makes 1 C the point where drift
 * alone can push a run out of tolerance.
 *
 * It WARNS rather than refuses, following `power.ts`'s rule for Balanced: the
 * effect is measured on one device over one session, which is enough to report
 * and not enough to invent a verdict. The baseline this replaced drifted the
 * same way (23.4 -> 25.7 C), so refusing would have rejected the prior
 * published window too.
 */
export const TEMP_DRIFT_WARN_C = 1;

/**
 * An android window is refused when at least `ceil(n / TREND_SCENARIO_DIVISOR)` of its n scenarios
 * are rising (PERF-17): Kendall tau of the p50s against run order at least `TREND_MIN_TAU`, and the
 * last run at least `TREND_MIN_RISE` above the first.
 *
 * Calibrated on every five-capture window in `web-android-history.ndjson`. The rule counts 15 of 18
 * on the 2026-08-21 back-to-back drift and 11-14 on the 2026-09-05 back-to-back windows, against at
 * most 1 of 18 on every gapped window recorded from 2026-08-21 to 2026-11-08. One third sits far
 * from both; "any one scenario" would refuse two of those gapped windows.
 *
 * Both halves are needed. Android p50s are quantized, so a drift climbs in steps with ties and small
 * dips: a strict every-run rise finds only 4 of 18 on 2026-08-21. Tau alone counts order without
 * size and refuses the clean, gapped 2026-11-04 window (6 of 18 at recorded precision, on sub-5%
 * wobble).
 *
 * The 10% spread gate below already refuses the 2026-08-21 window; this rule is what refuses a drift
 * the spread gate passes, as on 2026-09-05 from 07:27 (11 of 18).
 */
export const TREND_SCENARIO_DIVISOR = 3;

/** Over five runs, tau 0.6 still allows two of the ten pairs to fall, or four to tie. */
export const TREND_MIN_TAU = 0.6;

/** Net rise, last run over first, as a fraction of the first. */
export const TREND_MIN_RISE = 0.05;

/**
 * Shortest window the trend rule judges. Below four runs tau cannot tell a trend from one step: over
 * three runs a flat series with one slow last run, `[a, a, 1.06a]`, already scores tau 0.67, and over
 * two tau is the sign of a single difference. From four runs that shape scores 0.5. On the recorded
 * history one gapped three-run window already reaches 6 of 18 (2026-09-06 from 14:19), while every
 * gapped four-run window stays at or under 4. `bench:web:promote` folds five by default.
 */
export const MIN_TREND_RUNS = 4;

/** Kendall tau of `values` against their order: S / (k(k-1)/2), S = sum of sign(v[j] - v[i]) over i < j. */
export function kendallTau(values: readonly number[]): number {
  const k = values.length;
  if (k < 2) return 0;
  let s = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) s += Math.sign((values[j] as number) - (values[i] as number));
  }
  return s / ((k * (k - 1)) / 2);
}

/** Whether one scenario's p50s across a window count as rising under the trend rule. */
export function isRising(values: readonly number[]): boolean {
  const first = values[0];
  const last = values[values.length - 1];
  if (first === undefined || last === undefined || first <= 0) return false;
  return kendallTau(values) >= TREND_MIN_TAU && (last - first) / first >= TREND_MIN_RISE;
}

/** Refusal text when enough scenarios are rising across the window, or `null`. */
function judgeRisingTrend(
  captures: readonly WebPromoteRow[][],
  names: readonly string[],
): string | null {
  if (captures.length < MIN_TREND_RUNS) return null;

  const rising: string[] = [];
  for (const [i, name] of names.entries()) {
    const values = captures.map((c) => (c[i] as WebPromoteRow).p50Ms);
    if (!isRising(values)) continue;
    const first = values[0] as number;
    const risePct = (((values[values.length - 1] as number) - first) / first) * 100;
    rising.push(
      `"${name}" (${values.map((v) => v.toPrecision(4)).join(' -> ')}; ` +
        `tau ${kendallTau(values).toFixed(2)}, +${risePct.toFixed(1)}%)`,
    );
  }

  const threshold = Math.ceil(names.length / TREND_SCENARIO_DIVISOR);
  if (rising.length === 0 || rising.length < threshold) return null;

  return (
    `${rising.length} of ${names.length} scenarios are rising across all ${captures.length} runs ` +
    `(Kendall tau >= ${TREND_MIN_TAU} and last run >= ${TREND_MIN_RISE * 100}% above the first; ` +
    `refuse at ${threshold}: one third of the scenarios, rounded up) — the phone was still ` +
    'drifting, so the median describes a moving state. Re-capture from a cool phone with the ' +
    `100 s gap. Rising: ${rising.join('; ')}`
  );
}

/**
 * Refusal text when a window brings nothing newer than what is already published, or `null` when
 * the window is genuinely ahead of the baseline.
 *
 * **The failure this exists for, measured 2026-08-21.** `bench:web:gpu` and `bench:web:android`
 * had no root passthrough, so running them from the repo root exited instantly with
 * `Script not found` — five "captures" in one second that wrote nothing. `bench:web:promote` then
 * folded the previous month's history and republished it as current, reporting five captures
 * folded and a file written, because a fold reads history and history is exactly as long as it was
 * before. Nothing in the harness could tell "no new captures" from "captures that already existed".
 *
 * The stamps are what separate them, and they only separate them because a capture no longer
 * writes the published baseline (PERF-18 / §12 F4). While it did, the newest capture and the
 * published `generated` were equal after every legitimate capture run, so this check could not have
 * been written tighter than "strictly older" — which is precisely the case the 2026-08-21 incident
 * is not.
 *
 * Equality is therefore a refusal, not a pass: it means the published baseline already describes
 * the newest capture on disk. `--refold` exists for the one honest case (re-folding a published
 * window at a different `--runs`).
 */
export function judgeWindowRecency(
  newestCapturedAt: string,
  baselineGeneratedAt: string | null,
): string | null {
  if (baselineGeneratedAt === null) return null;

  const published = Date.parse(baselineGeneratedAt);
  if (Number.isNaN(published)) {
    return (
      `the published baseline's "generated" stamp (${baselineGeneratedAt}) is not a date, so this ` +
      'window cannot be shown to be newer than it. Re-capture rather than publish over a baseline ' +
      'that cannot be dated'
    );
  }

  const newest = Date.parse(newestCapturedAt);
  if (Number.isNaN(newest)) {
    return `the newest capture's stamp (${newestCapturedAt}) is not a date — the history log is damaged`;
  }

  if (newest > published) return null;

  if (newest === published) {
    return (
      `the newest capture in this window (${newestCapturedAt}) is the one already published — ` +
      'no new capture landed. Either the lane did not run (a failed capture appends nothing, and ' +
      'the fold cannot tell that from a window that already existed), or this window is already ' +
      'the published baseline. Re-capture, or pass --refold to re-fold the same window deliberately'
    );
  }

  return (
    `this window's newest capture (${newestCapturedAt}) predates the published baseline ` +
    `(${baselineGeneratedAt}) — folding it would republish older numbers as current`
  );
}

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  if (s.length === 0) return 0;
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Groups history rows into captures by their shared `capturedAt` stamp, oldest first. */
export function groupCaptures(rows: readonly WebPromoteRow[]): WebPromoteRow[][] {
  const by = new Map<string, WebPromoteRow[]>();
  for (const r of rows) {
    if (r.kind !== 'render') continue;
    const list = by.get(r.capturedAt);
    if (list === undefined) by.set(r.capturedAt, [r]);
    else list.push(r);
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

function sharedField(
  captures: readonly WebPromoteRow[][],
  field: 'commit' | 'runtime' | 'browserVersion',
  problems: string[],
): void {
  const seen = [...new Set(captures.map((c) => (c[0] as WebPromoteRow)[field]))];
  if (seen.length > 1) {
    problems.push(
      `captures disagree on ${field}: ${seen.join(' | ')} — these are not one measurement`,
    );
  }
}

export type WebAggregateOptions = {
  /**
   * `generated` of the lane's published baseline, or `null` when it has none / the caller is
   * deliberately re-folding. Drives `judgeWindowRecency`.
   */
  readonly baselineGeneratedAt?: string | null;
};

export function aggregateWebRuns(
  captures: readonly WebPromoteRow[][],
  options: WebAggregateOptions = {},
): WebAggregateOutcome {
  const problems: string[] = [];

  if (captures.length === 0) {
    return { ok: false, problems: ['no captures to fold — run the lane first'] };
  }
  if (captures.length < 2) {
    return {
      ok: false,
      problems: [
        `only ${captures.length} capture in the window — a fold of one run is the single-run figure ` +
          'it exists to replace, with a spread band that would falsely read as zero',
      ],
    };
  }

  // Captures are oldest-first, so the last group carries the window's newest stamp.
  const newestCapture = captures[captures.length - 1] as WebPromoteRow[];
  const recency = judgeWindowRecency(
    (newestCapture[0] as WebPromoteRow).capturedAt,
    options.baselineGeneratedAt ?? null,
  );
  if (recency !== null) problems.push(recency);

  sharedField(captures, 'commit', problems);
  sharedField(captures, 'runtime', problems);
  sharedField(captures, 'browserVersion', problems);

  const renderers = [
    ...new Set(captures.map((c) => (c[0] as WebPromoteRow).rendererString ?? '—')),
  ];
  if (renderers.length > 1) {
    problems.push(`captures disagree on renderer: ${renderers.join(' | ')} — different hardware`);
  }
  const models = [...new Set(captures.map((c) => (c[0] as WebPromoteRow).device?.model ?? '—'))];
  if (models.length > 1) {
    problems.push(`captures disagree on device: ${models.join(' | ')} — different phones`);
  }

  // Throttling is refused directly rather than inferred: a device that was already clocking down
  // produces numbers describing the governor, not the engine.
  for (const c of captures) {
    const head = c[0] as WebPromoteRow;
    const t = head.thermal;
    if (t === undefined) continue;
    if (t.statusBefore === null || t.statusAfter === null) {
      problems.push(
        `capture ${head.capturedAt} has an unreported thermal status — "unrecorded" is not "not throttling"`,
      );
      continue;
    }
    if (t.statusBefore > 0 || t.statusAfter > 0) {
      problems.push(
        `capture ${head.capturedAt} ran while the device reported thermal throttling ` +
          `(status ${t.statusBefore} -> ${t.statusAfter}) — refusing to publish a governed number`,
      );
    }
  }

  const names = (captures[0] as WebPromoteRow[]).map((r) => r.name);
  for (const c of captures) {
    const got = c.map((r) => r.name);
    if (JSON.stringify(got) !== JSON.stringify(names)) {
      problems.push('captures cover different scenario sets — the contract drifted mid-window');
      break;
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  // Only the android lane carries `thermal`. Desktop lanes have no warm-up to drift through.
  if (captures.some((c) => (c[0] as WebPromoteRow).thermal !== undefined)) {
    const trend = judgeRisingTrend(captures, names);
    if (trend !== null) problems.push(trend);
  }

  const rows: WebFoldedRow[] = [];
  for (const [i, name] of names.entries()) {
    const picked = captures.map((c) => c[i] as WebPromoteRow);
    const p50s = picked.map((r) => r.p50Ms);
    const folded = median(p50s);

    const deviant = p50s.filter(
      (v) => folded > 0 && Math.abs(v - folded) / folded > MAX_RUN_DEVIATION_PERCENT / 100,
    );
    if (deviant.length >= MIN_DEVIANT_RUNS) {
      problems.push(
        `"${name}": ${deviant.length} of ${p50s.length} runs deviate more than ` +
          `${MAX_RUN_DEVIATION_PERCENT}% from the folded median ${folded.toFixed(3)} ms ` +
          `(runs: ${p50s.map((v) => v.toFixed(3)).join(', ')})`,
      );
      continue;
    }

    rows.push({
      name,
      p50Ms: folded,
      p95Ms: median(picked.map((r) => r.p95Ms)),
      p99Ms: median(picked.map((r) => r.p99Ms)),
      bandMinMs: Math.min(...p50s),
      bandMaxMs: Math.max(...p50s),
      samples: Math.round(median(picked.map((r) => r.samples))),
      opsPerBatch: Math.round(median(picked.map((r) => r.opsPerBatch))),
      runs: picked.length,
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  // Thermal DRIFT, distinct from the throttling check above. `thermalStatus` is
  // a step function that reads 0 right up until it does not, so it cannot fire
  // during the warm-up that actually moves these numbers (PERF-21).
  const warnings: string[] = [];
  const drift = windowTempDriftC(captures);
  if (drift === null) {
    warnings.push(
      'battery temperature was not reported across the window — drift could not be checked',
    );
  } else if (Math.abs(drift) >= TEMP_DRIFT_WARN_C) {
    warnings.push(
      `battery temperature drifted ${drift.toFixed(1)} C across the window ` +
        `(warn at ${TEMP_DRIFT_WARN_C} C) — the device was still warming or cooling, so this ` +
        'median describes a moving thermal state. Capture at steady state: run throwaway ' +
        'warm-up captures first, then the window that counts.',
    );
  }

  return { ok: true, rows, runs: captures.length, warnings };
}
