/**
 * Builds `results/public.json`: one versioned document carrying every published lane, for any
 * consumer that should not have to learn four capture formats to read them.
 *
 * **Every object is built field by field, never spread from a capture.** The captures carry host
 * internals (power-plan GUID and label, CPU affinity mask) that are provenance for the fold and
 * nobody else's business; a spread would publish whatever a capture happens to carry tomorrow.
 * `PUBLIC_KEYS` is the whitelist the test holds the written file to.
 *
 * **The build is a pure function of the committed captures plus the release version.** It stamps
 * no render time, so the test can rebuild it and compare, which is what makes a recapture that
 * skipped `bun run bench:md` a red test instead of a stale export.
 *
 * `status` is what the capture says about itself (`stale` is `device.json`'s own flag, `none` is a
 * lane with no capture on disk). Whether a `current` capture still describes HEAD is a git
 * question and stays with `check:perf-freshness`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AllocRow } from './alloc.js';
import { MAX_RUN_DEVIATION_PERCENT, SCENARIO_DEVIATION_OVERRIDES } from './load.js';
import {
  COVERAGE,
  COVERAGE_PLATFORMS,
  type CoveragePlatformId,
  type CoverageSource,
  LANES,
  type LaneId,
  type LaneMeta,
  PUBLIC_ROW_IDS,
  PUBLIC_ROW_LABELS,
  SECTIONS,
  type SectionId,
  type SectionMeta,
} from './public-lanes.js';
import {
  type DeviceReport,
  type MicrobenchReport,
  readMicrobenchJson,
  repoRoot,
  resultsDir,
  writeFileAtomic,
} from './results.js';
import {
  loadWebCapture,
  type WebCaptureFile,
  type WebNamedValue,
  type WebRenderRow,
} from './web-sections.js';

export const PUBLIC_SCHEMA_VERSION = 1;

export type PublicRow = {
  /** Stable across releases and independent of `label`. */
  id: string;
  /** The suite a row belongs to, on lanes that have suites. */
  group: string | null;
  label: string;
  unit: string;
  median: number;
  /** Lowest and highest per-run median across the folded runs; `null` on a single-run capture. */
  bandMin: number | null;
  bandMax: number | null;
  p95: number | null;
  p99: number | null;
  samples: number;
  /** Set when the row is less reproducible than its neighbours; read it before the median. */
  note: string | null;
};

export type PublicThermal = {
  /** Highest Android throttling status reported around any folded capture; 0 is none. */
  statusMax: number | null;
  batteryTempCMin: number | null;
  batteryTempCMax: number | null;
};

export type PublicMachine = {
  cpu: string | null;
  logicalCpus: number | null;
  os: string | null;
  gpuRenderer: string | null;
  device: string | null;
  browser: string | null;
  /** Set only on lanes that count frames. */
  refreshRateHz: number | null;
  thermal: PublicThermal | null;
};

export type LaneStatus = 'current' | 'stale' | 'none';

export type PublicLane = {
  id: LaneId;
  title: string;
  status: LaneStatus;
  statusReason: string | null;
  platform: string;
  runtime: string | null;
  measures: string;
  doesNotMeasure: string[];
  capturedAt: string | null;
  commit: string | null;
  runs: number | null;
  machine: PublicMachine | null;
  note: string | null;
  rows: PublicRow[];
};

type SectionHead = {
  title: string;
  measures: string;
  doesNotMeasure: string[];
  capturedAt: string | null;
  commit: string | null;
  runtime: string | null;
};

export type PublicCounterRow = {
  id: string;
  label: string;
  poolMisses: number;
  particleFactoryCalls: number;
  cachedFactoryCalls: number;
  perFrameFactoryCalls: number;
  drawAtlasPerFrame: number;
  drawImageRectPerFrame: number;
  drawRectPerFrame: number;
  xformUnrotatedPerFrame: number;
  xformRotatedPerFrame: number;
  pass: boolean;
};

export type PublicHeapRow = {
  id: string;
  label: string;
  unit: 'bytes/frame';
  median: number;
  bandMin: number | null;
  bandMax: number | null;
  /** A `median` smaller than this is under the instrument's resolution, not zero. */
  resolution: number;
  warmupFrames: number;
  measuredFrames: number;
  plateauHeapMB: number;
  converged: boolean;
};

export type PublicValueRow = {
  id: string;
  label: string;
  unit: string;
  value: number;
};

export type PublicColdStartRow = PublicValueRow & {
  network: {
    downloadBytesPerSec: number;
    uploadBytesPerSec: number;
    latencyMs: number;
  } | null;
};

export type PublicCoverageCell = {
  status: 'measured' | 'stale' | 'not-measured' | 'not-applicable';
  lanes: LaneId[];
  sections: SectionId[];
  /** The GitHub issue tracking what this cell still lacks. */
  issue: number | null;
};

export type PublicExport = {
  schemaVersion: number;
  release: { version: string };
  lanes: PublicLane[];
  counters: SectionHead & { rows: PublicCounterRow[] };
  heap: SectionHead & { runs: number | null; rows: PublicHeapRow[] };
  payload: SectionHead & { rows: PublicValueRow[] };
  coldStart: SectionHead & { runs: number | null; rows: PublicColdStartRow[] };
  coverage: {
    platforms: { id: CoveragePlatformId; title: string }[];
    categories: {
      id: string;
      title: string;
      cells: Record<CoveragePlatformId, PublicCoverageCell>;
    }[];
  };
};

const SECTION_HEAD_KEYS = [
  'title',
  'measures',
  'doesNotMeasure',
  'capturedAt',
  'commit',
  'runtime',
] as const;

/** Every key the export may carry, by the kind of object it sits on. */
export const PUBLIC_KEYS = {
  root: [
    'schemaVersion',
    'release',
    'lanes',
    'counters',
    'heap',
    'payload',
    'coldStart',
    'coverage',
  ],
  release: ['version'],
  lane: [
    'id',
    'title',
    'status',
    'statusReason',
    'platform',
    'runtime',
    'measures',
    'doesNotMeasure',
    'capturedAt',
    'commit',
    'runs',
    'machine',
    'note',
    'rows',
  ],
  machine: [
    'cpu',
    'logicalCpus',
    'os',
    'gpuRenderer',
    'device',
    'browser',
    'refreshRateHz',
    'thermal',
  ],
  thermal: ['statusMax', 'batteryTempCMin', 'batteryTempCMax'],
  row: [
    'id',
    'group',
    'label',
    'unit',
    'median',
    'bandMin',
    'bandMax',
    'p95',
    'p99',
    'samples',
    'note',
  ],
  counters: [...SECTION_HEAD_KEYS, 'rows'],
  counterRow: [
    'id',
    'label',
    'poolMisses',
    'particleFactoryCalls',
    'cachedFactoryCalls',
    'perFrameFactoryCalls',
    'drawAtlasPerFrame',
    'drawImageRectPerFrame',
    'drawRectPerFrame',
    'xformUnrotatedPerFrame',
    'xformRotatedPerFrame',
    'pass',
  ],
  heap: [...SECTION_HEAD_KEYS, 'runs', 'rows'],
  heapRow: [
    'id',
    'label',
    'unit',
    'median',
    'bandMin',
    'bandMax',
    'resolution',
    'warmupFrames',
    'measuredFrames',
    'plateauHeapMB',
    'converged',
  ],
  payload: [...SECTION_HEAD_KEYS, 'rows'],
  payloadRow: ['id', 'label', 'unit', 'value'],
  coldStart: [...SECTION_HEAD_KEYS, 'runs', 'rows'],
  coldStartRow: ['id', 'label', 'unit', 'value', 'network'],
  network: ['downloadBytesPerSec', 'uploadBytesPerSec', 'latencyMs'],
  coverage: ['platforms', 'categories'],
  coveragePlatform: ['id', 'title'],
  coverageCategory: ['id', 'title', 'cells'],
  coverageCell: ['status', 'lanes', 'sections', 'issue'],
} as const satisfies Record<string, readonly string[]>;

export type PublicInputs = {
  readonly microbench: MicrobenchReport | null;
  readonly device: DeviceReport | null;
  readonly webCpu: WebCaptureFile | null;
  readonly webGpu: WebCaptureFile | null;
  readonly webAndroid: WebCaptureFile | null;
};

export function publicExportFile(): string {
  return resolve(resultsDir(), 'public.json');
}

function loadDevice(): DeviceReport | null {
  try {
    return JSON.parse(readFileSync(resolve(resultsDir(), 'device.json'), 'utf8')) as DeviceReport;
  } catch {
    return null;
  }
}

export function loadPublicInputs(): PublicInputs {
  return {
    microbench: readMicrobenchJson(),
    device: loadDevice(),
    webCpu: loadWebCapture('web.json'),
    webGpu: loadWebCapture('web-gpu.json'),
    webAndroid: loadWebCapture('web-android.json'),
  };
}

/** The lockstep engine version in the tree, read off `@flare-engine/core`. */
export function readEngineVersion(): string {
  const file = resolve(repoRoot(), 'packages', 'core', 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
  if (typeof pkg.version !== 'string' || pkg.version === '') {
    throw new Error(`${file} has no readable "version" field`);
  }
  return pkg.version;
}

/** Display form of a capture name: the column-alignment padding is not part of the label. */
export function displayLabel(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function rowId(name: string): string {
  const id = PUBLIC_ROW_IDS[name];
  if (id === undefined) {
    throw new Error(
      `"${name}" has no public row id. Add one to PUBLIC_ROW_IDS in benchmarks/src/public-lanes.ts ` +
        '(for a rename, move the existing id to the new name).',
    );
  }
  return id;
}

/**
 * The wider-tolerance disclosure for a node row, or `null` when it folds at the global tolerance.
 * One source for both the doc's bullet and the export's row `note`.
 */
export function deviationCaveat(scenario: string): { claim: string; reason: string } | null {
  const override = SCENARIO_DEVIATION_OVERRIDES.get(scenario);
  if (override === undefined) return null;
  return {
    claim: `held to a wider tolerance than every other row (${override.percent}%, not ${MAX_RUN_DEVIATION_PERCENT}%), and is less reproducible than its neighbours.`,
    reason: override.reason,
  };
}

function laneMeta(id: LaneId): LaneMeta {
  const meta = LANES.find((l) => l.id === id);
  if (meta === undefined) throw new Error(`no lane metadata for "${id}"`);
  return meta;
}

function emptyLane(id: LaneId): PublicLane {
  const meta = laneMeta(id);
  return {
    id,
    title: meta.title,
    status: 'none',
    statusReason: 'No capture on disk for this lane.',
    platform: meta.platform,
    runtime: null,
    measures: meta.measures,
    doesNotMeasure: [...meta.doesNotMeasure],
    capturedAt: null,
    commit: null,
    runs: null,
    machine: null,
    note: null,
    rows: [],
  };
}

function nodeLane(capture: MicrobenchReport | null): PublicLane {
  if (capture === null) return emptyLane('node-jsc');
  const meta = laneMeta('node-jsc');
  const rows: PublicRow[] = [];
  for (const suite of capture.suites) {
    for (const r of suite.results) {
      const caveat = deviationCaveat(r.scenario);
      rows.push({
        id: rowId(r.scenario),
        group: suite.title,
        label: displayLabel(r.scenario),
        unit: 'ns',
        median: r.medianNs,
        bandMin: r.bandMinNs ?? null,
        bandMax: r.bandMaxNs ?? null,
        p95: null,
        p99: r.p99Ns ?? null,
        samples: r.samples,
        note:
          caveat === null
            ? null
            : `${caveat.claim.charAt(0).toUpperCase()}${caveat.claim.slice(1)} ${caveat.reason}`,
      });
    }
  }
  return {
    id: 'node-jsc',
    title: `${meta.title} (${capture.runtime}, JavaScriptCore)`,
    status: 'current',
    statusReason: null,
    platform: meta.platform,
    runtime: capture.runtime,
    measures: meta.measures,
    doesNotMeasure: [...meta.doesNotMeasure],
    capturedAt: capture.generated,
    commit: capture.gitSha ?? null,
    runs: capture.runs ?? 1,
    machine: {
      cpu: capture.cpuModel ?? null,
      logicalCpus: capture.cpuCount ?? null,
      os: capture.platform,
      gpuRenderer: null,
      device: null,
      browser: null,
      refreshRateHz: null,
      thermal: null,
    },
    note: null,
    rows,
  };
}

function single<T>(values: readonly T[], what: string, lane: string): T {
  const unique = [...new Set(values)];
  if (unique.length !== 1) {
    throw new Error(
      `${lane}: rows disagree on ${what} (${unique.map(String).join(', ')}) — refusing to publish one value for the lane.`,
    );
  }
  return unique[0] as T;
}

function reduceNullable(
  values: readonly (number | null)[],
  pick: (...v: number[]) => number,
): number | null {
  if (values.length === 0) return null;
  const known: number[] = [];
  for (const v of values) {
    // One unreported reading makes the summary unreported: "not reported" is not "not throttling".
    if (v === null) return null;
    known.push(v);
  }
  return pick(...known);
}

function webThermal(rows: readonly WebRenderRow[]): PublicThermal | null {
  const readings = rows.flatMap((r) => (r.thermal === undefined ? [] : [r.thermal]));
  if (readings.length === 0) return null;
  const status = readings.flatMap((t) => [t.statusBefore, t.statusAfter]);
  const temps = readings.flatMap((t) => [t.batteryTempCBefore, t.batteryTempCAfter]);
  return {
    statusMax: reduceNullable(status, Math.max),
    batteryTempCMin: reduceNullable(temps, Math.min),
    batteryTempCMax: reduceNullable(temps, Math.max),
  };
}

/** `"win32 x64 (13th Gen …)"` → os + cpu. The host string is the only place a web row names them. */
function splitHost(host: string): { os: string; cpu: string | null } {
  const m = /^(.*?)\s*\((.*)\)$/.exec(host);
  return m === null ? { os: host, cpu: null } : { os: m[1] as string, cpu: m[2] as string };
}

function webLane(id: LaneId, capture: WebCaptureFile | null): PublicLane {
  const rows = capture === null ? [] : capture.render.filter((r) => r.kind === 'render');
  const first = rows[0];
  if (capture === null || first === undefined) return emptyLane(id);
  const meta = laneMeta(id);
  const runtime = single(
    rows.map((r) => r.runtime),
    'runtime',
    id,
  );
  const browser = single(
    rows.map((r) => `${r.browserName} ${r.browserVersion}`),
    'browser',
    id,
  );
  const d = first.device;
  const host = splitHost(first.host);
  return {
    id,
    title: `${meta.title} (${browser}, CanvasKit)`,
    status: 'current',
    statusReason: null,
    platform: meta.platform,
    runtime,
    measures: meta.measures,
    doesNotMeasure: [...meta.doesNotMeasure],
    capturedAt: capture.generated,
    commit: single(
      rows.map((r) => r.commit),
      'commit',
      id,
    ),
    runs: single(
      rows.map((r) => r.runs ?? 1),
      'runs',
      id,
    ),
    machine: {
      cpu: d === undefined ? host.cpu : d.soc,
      logicalCpus: null,
      os: d === undefined ? host.os : `Android ${d.androidRelease}`,
      gpuRenderer: first.rendererString ?? null,
      device: d === undefined ? null : `${d.model} (${d.codename})`,
      browser,
      refreshRateHz: null,
      thermal: webThermal(rows),
    },
    note: null,
    rows: rows.map((r) => ({
      id: rowId(r.name),
      group: null,
      label: displayLabel(r.name),
      unit: 'ms',
      median: r.p50Ms,
      bandMin: r.bandMinMs ?? null,
      bandMax: r.bandMaxMs ?? null,
      p95: r.p95Ms,
      p99: r.p99Ms,
      samples: r.samples,
      note: null,
    })),
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] as number;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as number) + upper) / 2;
}

function deviceLane(report: DeviceReport | null): PublicLane {
  const run = report?.devices[0];
  if (report === null || run === undefined) return emptyLane('device-native');
  if (report.devices.length > 1) {
    throw new Error('device.json carries several devices; the device lane publishes exactly one.');
  }
  const meta = laneMeta('device-native');
  return {
    id: 'device-native',
    title: `${meta.title} (React Native + Skia, Hermes)`,
    status: report.stale === true ? 'stale' : 'current',
    statusReason: report.stale === true ? (report.staleReason ?? null) : null,
    platform: meta.platform,
    runtime: 'React Native (Hermes)',
    measures: meta.measures,
    doesNotMeasure: [...meta.doesNotMeasure],
    capturedAt: report.generated,
    commit: null,
    runs: 1,
    machine: {
      cpu: null,
      logicalCpus: null,
      os: run.os,
      gpuRenderer: null,
      device: run.device,
      browser: null,
      refreshRateHz: null,
      thermal: null,
    },
    note: run.notes ?? null,
    rows: run.loads
      .filter((l) => l.fps.length > 0)
      .map((l) => ({
        id: rowId(l.label),
        group: null,
        label: displayLabel(l.label),
        unit: 'fps',
        median: median(l.fps),
        bandMin: Math.min(...l.fps),
        bandMax: Math.max(...l.fps),
        p95: null,
        p99: null,
        samples: l.fps.length,
        note: 'The band is the lowest and highest one-second sample of a single capture, not a run-to-run spread.',
      })),
  };
}

function sectionHead(
  meta: SectionMeta,
  from: { capturedAt: string | null; commit: string | null; runtime: string | null },
): SectionHead {
  return {
    title: meta.title,
    measures: meta.measures,
    doesNotMeasure: [...meta.doesNotMeasure],
    capturedAt: from.capturedAt,
    commit: from.commit,
    runtime: from.runtime,
  };
}

function counterRow(r: AllocRow): PublicCounterRow {
  return {
    id: rowId(r.scenario),
    label: displayLabel(r.scenario),
    poolMisses: r.poolMisses,
    particleFactoryCalls: r.particleFactoryCalls,
    cachedFactoryCalls: r.cachedFactoryCalls,
    perFrameFactoryCalls: r.perFrameFactoryCalls,
    drawAtlasPerFrame: r.drawAtlasPerFrame,
    drawImageRectPerFrame: r.drawImageRectPerFrame,
    drawRectPerFrame: r.drawRectPerFrame,
    xformUnrotatedPerFrame: r.xformUnrotatedPerFrame,
    xformRotatedPerFrame: r.xformRotatedPerFrame,
    pass: r.problems.length === 0,
  };
}

function valueRows(values: readonly WebNamedValue[], unit: 'bytes' | 'ms'): PublicValueRow[] {
  const rows: PublicValueRow[] = [];
  for (const v of values) {
    const value = unit === 'bytes' ? v.bytes : v.ms;
    if (value === undefined) throw new Error(`"${v.name}" carries no ${unit} value`);
    rows.push({
      id: rowId(v.name),
      label: PUBLIC_ROW_LABELS[v.name] ?? displayLabel(v.name),
      unit,
      value,
    });
  }
  return rows;
}

function webSectionSource(
  values: readonly WebNamedValue[],
  capture: WebCaptureFile | null,
): { capturedAt: string | null; commit: string | null; runtime: string | null } {
  const first = values[0];
  if (first === undefined) return { capturedAt: null, commit: null, runtime: null };
  return {
    capturedAt: first.capturedAt ?? capture?.generated ?? null,
    commit: first.commit ?? null,
    runtime:
      first.browserName === undefined
        ? null
        : `${first.browserName} ${first.browserVersion ?? ''}`.trim(),
  };
}

function coverageCell(source: CoverageSource, lanes: readonly PublicLane[]): PublicCoverageCell {
  const laneIds = [...(source.lanes ?? [])];
  const sections = [...(source.sections ?? [])];
  const issue = source.issue ?? null;
  if (source.applicable === false) {
    return { status: 'not-applicable', lanes: [], sections: [], issue: null };
  }
  const captured = laneIds.filter((id) => lanes.find((l) => l.id === id)?.status !== 'none');
  if (captured.length === 0 && sections.length === 0) {
    return { status: 'not-measured', lanes: [], sections: [], issue };
  }
  const anyCurrent =
    sections.length > 0 ||
    captured.some((id) => lanes.find((l) => l.id === id)?.status === 'current');
  return { status: anyCurrent ? 'measured' : 'stale', lanes: captured, sections, issue };
}

export function buildPublicExport(inputs: PublicInputs, releaseVersion: string): PublicExport {
  const node = inputs.microbench;
  const lanes: PublicLane[] = [
    nodeLane(node),
    webLane('web-cpu-raster', inputs.webCpu),
    webLane('web-gpu', inputs.webGpu),
    webLane('web-android-gpu', inputs.webAndroid),
    deviceLane(inputs.device),
  ];

  const nodeSource = {
    capturedAt: node?.generated ?? null,
    commit: node?.gitSha ?? null,
    runtime: node?.runtime ?? null,
  };
  const payload = inputs.webCpu?.payload ?? [];
  const coldStart = inputs.webCpu?.coldStart ?? [];

  return {
    schemaVersion: PUBLIC_SCHEMA_VERSION,
    release: { version: releaseVersion },
    lanes,
    counters: {
      ...sectionHead(SECTIONS.counters, nodeSource),
      rows: (node?.alloc ?? []).map(counterRow),
    },
    heap: {
      ...sectionHead(SECTIONS.heap, nodeSource),
      runs: node === null ? null : (node.runs ?? 1),
      rows: (node?.heap ?? []).map((h) => ({
        id: rowId(h.name),
        label: displayLabel(h.name),
        unit: 'bytes/frame',
        median: h.bytesPerFrame,
        bandMin: h.bandMinBytesPerFrame ?? null,
        bandMax: h.bandMaxBytesPerFrame ?? null,
        resolution: h.resolutionBytesPerFrame,
        warmupFrames: h.warmupFrames,
        measuredFrames: h.iterations,
        plateauHeapMB: h.plateauHeapMB,
        converged: h.converged,
      })),
    },
    payload: {
      ...sectionHead(SECTIONS.payload, webSectionSource(payload, inputs.webCpu)),
      rows: valueRows(payload, 'bytes'),
    },
    coldStart: {
      ...sectionHead(SECTIONS.coldStart, webSectionSource(coldStart, inputs.webCpu)),
      runs: coldStart.length === 0 ? null : 1,
      rows: coldStart.map((c) => {
        const network = c.network ?? null;
        return {
          ...(valueRows([c], 'ms')[0] as PublicValueRow),
          network:
            network === null
              ? null
              : {
                  downloadBytesPerSec: network.downloadThroughputBytesPerSec,
                  uploadBytesPerSec: network.uploadThroughputBytesPerSec,
                  latencyMs: network.latencyMs,
                },
        };
      }),
    },
    coverage: {
      platforms: COVERAGE_PLATFORMS.map((p) => ({ id: p.id, title: p.title })),
      categories: COVERAGE.map((c) => ({
        id: c.id,
        title: c.title,
        cells: {
          desktopWeb: coverageCell(c.cells.desktopWeb, lanes),
          androidWeb: coverageCell(c.cells.androidWeb, lanes),
          iosWeb: coverageCell(c.cells.iosWeb, lanes),
          androidNative: coverageCell(c.cells.androidNative, lanes),
          iosNative: coverageCell(c.cells.iosNative, lanes),
        },
      })),
    },
  };
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const LINE_WIDTH = 100;

/**
 * `JSON.stringify(doc, null, 2)`, except that an array of scalars short enough for one line is
 * written on one line. That is how Biome formats JSON, and `bun run lint` checks this file: plain
 * `stringify` output fails the gate on every short string array.
 */
function formatJson(value: Json, indent: string, used: number): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const oneLine = `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
      // One column is kept for the comma that may follow.
      if (used + oneLine.length + 1 <= LINE_WIDTH) return oneLine;
    }
    const items = value.map((v) => `${inner}${formatJson(v, inner, inner.length)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const members = entries.map(([k, v]) => {
    const head = `${inner}${JSON.stringify(k)}: `;
    return `${head}${formatJson(v, inner, head.length)}`;
  });
  return `{\n${members.join(',\n')}\n${indent}}`;
}

export function serializePublicExport(doc: PublicExport): string {
  return `${formatJson(doc as unknown as Json, '', 0)}\n`;
}

export function writePublicExport(doc: PublicExport): string {
  const file = publicExportFile();
  writeFileAtomic(file, serializePublicExport(doc));
  return file;
}
