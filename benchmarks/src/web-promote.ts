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
  | { readonly ok: true; readonly rows: WebFoldedRow[]; readonly runs: number }
  | { readonly ok: false; readonly problems: string[] };

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

export function aggregateWebRuns(captures: readonly WebPromoteRow[][]): WebAggregateOutcome {
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
  return { ok: true, rows, runs: captures.length };
}
