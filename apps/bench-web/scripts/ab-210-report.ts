/**
 * #210 A/B: the row shape of `results/ab-210.ndjson` and the per-arm table `bench:web:ab210` ends
 * with. Pure — no I/O, no server — so the aggregation is testable on its own. Strip with the loader
 * switch.
 */
import { WASM_ARMS, type WasmArm } from '../src/wasm-arm.js';

/** How a page got `canvaskit.wasm` (`scripts/ab-210-wasm-requests.mjs`). */
export type WasmRequestCounts = {
  readonly network: number;
  readonly cache: number;
  readonly blob: number;
};

/** `context`: the lane's own cold start, a fresh `browser.newContext()`. `persistent`: a fresh
 *  on-disk profile, where the HTTP cache can keep the 8.2 MB wasm (see coldstart-driver.mjs). */
export type ColdStartProfile = 'context' | 'persistent';

export const COLD_START_PROFILES: readonly ColdStartProfile[] = ['context', 'persistent'];

type RowBase = {
  readonly ab: 210;
  readonly runId: string;
  readonly arm: WasmArm;
  readonly round: number;
  readonly capturedAt: string;
};

type Provenance = {
  readonly commit: string;
  readonly host: string;
  readonly affinityMask?: string;
  readonly powerSchemeLabel?: string;
  readonly browserVersion: string;
  readonly hostLoadPct: number;
  readonly wasmArmTaken: string | null;
  readonly wasmRequests: WasmRequestCounts | null;
};

export type AbRenderRow = RowBase &
  Provenance & {
    readonly kind: 'render';
    readonly name: string;
    readonly samples: number;
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
  };

export type AbColdStartRow = RowBase &
  Provenance & {
    readonly kind: 'coldStart';
    readonly profile: ColdStartProfile;
    readonly name: string;
    readonly ms: number;
  };

export type AbErrorRow = RowBase & {
  readonly kind: 'error';
  readonly step: string;
  readonly message: string;
};

export type AbRow = AbRenderRow | AbColdStartRow | AbErrorRow;

/** `zone-bg path` in every cpu-raster window from September to `e074a09` (issue #210). */
export const ZONE_BG_BAND = { loMs: 89.5, hiMs: 97.4 } as const;

/** The three raster rows the table reports, by scenario name with its padding collapsed. */
export const TABLE_RENDER_ROWS = [
  { label: 'zone-bg path', name: 'render.flush 1000 sprites / zone-bg path' },
  { label: 'outline effect', name: 'render.flush 1000 sprites / outline effect' },
  { label: '1000 sprites / 1 atlas', name: 'render.flush 1000 sprites / 1 atlas' },
] as const;

/** ABC ABC ABC: each round runs every arm once, so slow machine drift lands on all arms alike. */
export function interleave<T>(
  arms: readonly T[],
  rounds: number,
): { readonly arm: T; readonly round: number }[] {
  const out: { arm: T; round: number }[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (const arm of arms) out.push({ arm, round });
  }
  return out;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export type Stat = {
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly n: number;
};

export function stat(values: readonly number[]): Stat | null {
  const m = median(values);
  if (m === null) return null;
  return { median: m, min: Math.min(...values), max: Math.max(...values), n: values.length };
}

export type BandVerdict = 'in band' | 'above band' | 'below band';

/** Inclusive at both ends, matching how the issue states the band. */
export function bandVerdict(ms: number): BandVerdict {
  if (ms > ZONE_BG_BAND.hiMs) return 'above band';
  if (ms < ZONE_BG_BAND.loMs) return 'below band';
  return 'in band';
}

export function collapseName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export type ArmSummary = {
  readonly arm: WasmArm;
  /** Distinct render captures that produced rows for this arm. */
  readonly captures: number;
  readonly errors: number;
  readonly render: Readonly<Record<string, Stat | null>>;
  readonly cold4g: Readonly<Record<ColdStartProfile, Stat | null>>;
  readonly cold: Readonly<Record<ColdStartProfile, Stat | null>>;
  /** How the cold4g navigation got the wasm, each distinct pattern with its count. */
  readonly cold4gWasm: Readonly<Record<ColdStartProfile, string>>;
  /** How the render-suite page got the wasm, likewise. */
  readonly renderWasm: string;
};

export function formatRequests(r: WasmRequestCounts | null): string {
  if (r === null) return 'unrecorded';
  const parts: string[] = [];
  if (r.network > 0) parts.push(`net ${r.network}`);
  if (r.cache > 0) parts.push(`cache ${r.cache}`);
  if (r.blob > 0) parts.push(`blob ${r.blob}`);
  return parts.length === 0 ? 'none' : parts.join(' + ');
}

function patterns(reqs: readonly (WasmRequestCounts | null)[]): string {
  if (reqs.length === 0) return '-';
  const counts = new Map<string, number>();
  for (const r of reqs) {
    const key = formatRequests(r);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 1) return [...counts.keys()][0] as string;
  return [...counts].map(([k, n]) => `${k} (x${n})`).join(', ');
}

/**
 * Per-arm medians over every row in the file. A data row whose loader reported a different path
 * than its arm is ignored: the runner already logs that as an error, and it must not count.
 */
export function summarize(rows: readonly AbRow[]): ArmSummary[] {
  return WASM_ARMS.map((arm) => {
    const mine = rows.filter((r) => r.arm === arm);
    const ok = mine.filter(
      (r): r is AbRenderRow | AbColdStartRow => r.kind !== 'error' && r.wasmArmTaken === arm,
    );
    const renderRows = ok.filter((r): r is AbRenderRow => r.kind === 'render');
    const coldRows = ok.filter((r): r is AbColdStartRow => r.kind === 'coldStart');

    const render: Record<string, Stat | null> = {};
    for (const row of TABLE_RENDER_ROWS) {
      render[row.label] = stat(
        renderRows.filter((r) => collapseName(r.name) === row.name).map((r) => r.p50Ms),
      );
    }

    const pick = (profile: ColdStartProfile, name: string): AbColdStartRow[] =>
      coldRows.filter((r) => r.profile === profile && r.name === name);
    const byProfile = <V>(f: (p: ColdStartProfile) => V): Record<ColdStartProfile, V> => ({
      context: f('context'),
      persistent: f('persistent'),
    });

    const captureKeys = new Set(renderRows.map((r) => `${r.runId}#${r.round}`));
    const renderWasm = [...captureKeys].map(
      (k) => renderRows.find((r) => `${r.runId}#${r.round}` === k)?.wasmRequests ?? null,
    );

    return {
      arm,
      captures: captureKeys.size,
      errors: mine.filter((r) => r.kind === 'error').length,
      render,
      cold4g: byProfile((p) => stat(pick(p, 'coldStart.cold4g').map((r) => r.ms))),
      cold: byProfile((p) => stat(pick(p, 'coldStart.cold').map((r) => r.ms))),
      cold4gWasm: byProfile((p) =>
        patterns(pick(p, 'coldStart.cold4g').map((r) => r.wasmRequests)),
      ),
      renderWasm: patterns(renderWasm),
    };
  });
}

function fmtRaster(s: Stat | null | undefined): string {
  if (s === null || s === undefined) return '-';
  const d = s.median < 20 ? 2 : 1;
  return `${s.median.toFixed(d)} [${s.min.toFixed(d)}-${s.max.toFixed(d)}]`;
}

function fmtSeconds(s: Stat | null): string {
  return s === null ? '-' : `${(s.median / 1000).toFixed(2)} s`;
}

function fmtMs(s: Stat | null): string {
  return s === null ? '-' : `${s.median.toFixed(1)} ms`;
}

function table(header: readonly string[], body: readonly (readonly string[])[]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => (r[i] ?? '').length)));
  const line = (cells: readonly string[]): string =>
    cells
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

function distinct(values: readonly (string | undefined)[]): string {
  const set = [...new Set(values.map((v) => v ?? 'unrecorded'))];
  return set.length === 0 ? '-' : set.join(', ');
}

/** The full text `bench:web:ab210` ends with (and `--report` prints). */
export function formatReport(rows: readonly AbRow[]): string {
  const summaries = summarize(rows);
  const data = rows.filter((r): r is AbRenderRow | AbColdStartRow => r.kind !== 'error');
  const runs = new Set(rows.map((r) => r.runId)).size;
  const { loMs, hiMs } = ZONE_BG_BAND;

  const main = table(
    [
      'arm',
      'n',
      'zone-bg path ms',
      'vs band',
      'outline effect ms',
      '1000 sprites / 1 atlas ms',
      'cold4g',
      'cold',
    ],
    summaries.map((s) => {
      const zone = s.render['zone-bg path'];
      return [
        s.arm,
        String(s.captures),
        fmtRaster(zone),
        zone ? bandVerdict(zone.median) : '-',
        fmtRaster(s.render['outline effect']),
        fmtRaster(s.render['1000 sprites / 1 atlas']),
        fmtSeconds(s.cold4g.context),
        fmtMs(s.cold.context),
      ];
    }),
  );

  const detail = table(
    [
      'arm',
      'wasm, render page',
      'wasm, cold4g',
      'cold4g, disk profile',
      'cold, disk profile',
      'wasm, cold4g disk',
      'errors',
    ],
    summaries.map((s) => [
      s.arm,
      s.renderWasm,
      s.cold4gWasm.context,
      fmtSeconds(s.cold4g.persistent),
      fmtMs(s.cold.persistent),
      s.cold4gWasm.persistent,
      String(s.errors),
    ]),
  );

  const verdicts = summaries.map((s) => {
    const zone = s.render['zone-bg path'];
    if (!zone) return `  ${s.arm}: no zone-bg path rows.`;
    return (
      `  ${s.arm}: zone-bg path ${zone.median.toFixed(1)} ms, ${bandVerdict(zone.median)} ` +
      `(${loMs}-${hiMs} ms); cold4g ${fmtSeconds(s.cold4g.context)} in the lane's own ` +
      `cold start, ${fmtSeconds(s.cold4g.persistent)} with a disk profile.`
    );
  });

  return [
    `#210 A/B: ${rows.length} row(s) from ${runs} run(s) in results/ab-210.ndjson`,
    `  commit ${distinct(data.map((r) => r.commit))}; Chromium ${distinct(data.map((r) => r.browserVersion))}`,
    `  affinity ${distinct(data.map((r) => r.affinityMask))}; power plan ${distinct(data.map((r) => r.powerSchemeLabel))}`,
    '',
    'Medians of each capture (render: p50 per capture; [min-max] across captures). cold4g and',
    "cold are the lane's own cold start (a fresh browser context, as in web-history.ndjson).",
    '',
    main,
    '',
    'Wasm requests (net = network download, cache = HTTP cache, blob = blob: URL) and the same',
    'cold start in a fresh on-disk profile, where the HTTP cache can keep the 8.2 MB wasm:',
    '',
    detail,
    '',
    `Pre-#196 band for zone-bg path: ${loMs}-${hiMs} ms (cpu-raster windows, September to e074a09,`,
    'Chromium 156 and earlier). On another Chromium, compare the arms with each other first.',
    ...verdicts,
  ].join('\n');
}

/** Rows from `results/ab-210.ndjson`; lines that do not parse or are not #210 rows are skipped. */
export function parseAbRows(text: string): AbRow[] {
  const out: AbRow[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof v === 'object' && v !== null && Reflect.get(v, 'ab') === 210) out.push(v as AbRow);
  }
  return out;
}

/** The A/B fields a driver adds to its payload, validated, since the payload crosses a process. */
export function readAbFields(payload: object): {
  readonly wasmArmTaken: string | null;
  readonly wasmRequests: WasmRequestCounts | null;
} {
  const taken: unknown = Reflect.get(payload, 'wasmArmTaken');
  const reqs: unknown = Reflect.get(payload, 'wasmRequests');
  const isCounts =
    typeof reqs === 'object' &&
    reqs !== null &&
    ['network', 'cache', 'blob'].every((k) => typeof Reflect.get(reqs, k) === 'number');
  return {
    wasmArmTaken: typeof taken === 'string' ? taken : null,
    wasmRequests: isCounts ? (reqs as WasmRequestCounts) : null,
  };
}
