import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SCENARIO_DEVIATION_OVERRIDES } from '../src/load.js';
import {
  buildPublicExport,
  loadPublicInputs,
  PUBLIC_KEYS,
  PUBLIC_SCHEMA_VERSION,
  type PublicExport,
  type PublicInputs,
  publicExportFile,
  serializePublicExport,
} from '../src/public-export.js';
import { PUBLIC_ROW_IDS } from '../src/public-lanes.js';
import { benchmarksDocFile } from '../src/results.js';
import {
  EXPECTED_ALLOC_SCENARIOS,
  EXPECTED_HEAP_SCENARIOS,
  EXPECTED_SCENARIOS,
} from '../src/scenario-contract.js';

/**
 * The committed `results/public.json` is the target, for the reason `web-sections.test.ts` gives:
 * `index.ts` is a CLI that cannot be imported, so only the artifact shows that `bench:md` wrote it.
 */
const committed = JSON.parse(readFileSync(publicExportFile(), 'utf8')) as PublicExport;
const committedText = readFileSync(publicExportFile(), 'utf8');
const inputs = loadPublicInputs();

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Keys of `value` that the whitelist for its kind does not carry, as `path.key`. */
function strayKeys(value: Json, allowed: readonly string[], at: string): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [`${at} is not an object`];
  }
  return Object.keys(value)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${at}.${k}`);
}

function each(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function child(value: Json, key: string): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value[key] ?? null)
    : null;
}

function allStrayKeys(doc: Json): string[] {
  const out = strayKeys(doc, PUBLIC_KEYS.root, 'root');
  out.push(...strayKeys(child(doc, 'release'), PUBLIC_KEYS.release, 'release'));
  each(child(doc, 'lanes')).forEach((lane, i) => {
    const at = `lanes[${i}]`;
    out.push(...strayKeys(lane, PUBLIC_KEYS.lane, at));
    const machine = child(lane, 'machine');
    if (machine !== null) {
      out.push(...strayKeys(machine, PUBLIC_KEYS.machine, `${at}.machine`));
      const thermal = child(machine, 'thermal');
      if (thermal !== null) {
        out.push(...strayKeys(thermal, PUBLIC_KEYS.thermal, `${at}.machine.thermal`));
      }
    }
    each(child(lane, 'rows')).forEach((row, j) => {
      out.push(...strayKeys(row, PUBLIC_KEYS.row, `${at}.rows[${j}]`));
    });
  });
  const sections = [
    ['counters', PUBLIC_KEYS.counters, PUBLIC_KEYS.counterRow],
    ['heap', PUBLIC_KEYS.heap, PUBLIC_KEYS.heapRow],
    ['payload', PUBLIC_KEYS.payload, PUBLIC_KEYS.payloadRow],
    ['coldStart', PUBLIC_KEYS.coldStart, PUBLIC_KEYS.coldStartRow],
  ] as const;
  for (const [name, keys, rowKeys] of sections) {
    const section = child(doc, name);
    out.push(...strayKeys(section, keys, name));
    each(child(section, 'rows')).forEach((row, j) => {
      out.push(...strayKeys(row, rowKeys, `${name}.rows[${j}]`));
      const network = child(row, 'network');
      if (network !== null) {
        out.push(...strayKeys(network, PUBLIC_KEYS.network, `${name}.rows[${j}].network`));
      }
    });
  }
  const coverage = child(doc, 'coverage');
  out.push(...strayKeys(coverage, PUBLIC_KEYS.coverage, 'coverage'));
  each(child(coverage, 'platforms')).forEach((p, i) => {
    out.push(...strayKeys(p, PUBLIC_KEYS.coveragePlatform, `coverage.platforms[${i}]`));
  });
  each(child(coverage, 'categories')).forEach((c, i) => {
    const at = `coverage.categories[${i}]`;
    out.push(...strayKeys(c, PUBLIC_KEYS.coverageCategory, at));
    const cells = child(c, 'cells');
    if (cells !== null && typeof cells === 'object' && !Array.isArray(cells)) {
      for (const [platform, cell] of Object.entries(cells)) {
        out.push(...strayKeys(cell, PUBLIC_KEYS.coverageCell, `${at}.cells.${platform}`));
      }
    }
  });
  return out;
}

/** Rows with no spread band, as `lane/row`. */
function rowsWithoutBand(doc: PublicExport): string[] {
  const out: string[] = [];
  for (const lane of doc.lanes) {
    for (const r of lane.rows) {
      if (typeof r.bandMin !== 'number' || typeof r.bandMax !== 'number') {
        out.push(`${lane.id}/${r.id}`);
      }
    }
  }
  for (const r of doc.heap.rows) {
    if (typeof r.bandMin !== 'number' || typeof r.bandMax !== 'number') out.push(`heap/${r.id}`);
  }
  return out;
}

const WEB_HEADINGS: Readonly<Record<string, string>> = {
  'Render suite — CPU-raster': 'web-cpu-raster',
  'Render suite — desktop GPU': 'web-gpu',
  'Render suite — Android device (on-device GPU)': 'web-android-gpu',
};

const SECTION_HEADINGS: Readonly<Record<string, 'counters' | 'heap' | 'payload' | 'coldStart'>> = {
  'Draw-path allocation counters': 'counters',
  'Integration heap': 'heap',
  'CanvasKit WASM payload': 'payload',
  'Cold start to first rendered frame': 'coldStart',
};

/** Headings of `benchmarks.md` that carry prose and no measured rows. */
const PROSE_HEADINGS = [
  'Headline numbers',
  'Methodology',
  'What these numbers do not measure',
  'Suites',
  'Device',
  'Web (CanvasKit)',
  'Notes on interpretation',
  'Gating native (C++) acceleration',
];

/**
 * Every heading of the published doc, checked against the export. A heading this function cannot
 * place is a problem by itself: that is what makes a lane added to `benchmarks.md` fail here until
 * it is also exported.
 */
function docLanesMissingFrom(doc: PublicExport, markdown: string): string[] {
  const problems: string[] = [];
  const captured = (id: string): boolean =>
    doc.lanes.some((l) => l.id === id && l.status !== 'none' && l.rows.length > 0);
  let parent = '';
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,3}) (.+)$/.exec(line);
    if (m === null) continue;
    const title = m[2] as string;
    if (m[1] === '##') parent = title;
    const section = SECTION_HEADINGS[title];
    if (section !== undefined) {
      if (doc[section].rows.length === 0) problems.push(`"${title}" has no ${section} rows`);
    } else if (m[1] === '##') {
      if (!PROSE_HEADINGS.includes(title)) problems.push(`unplaced section "${title}"`);
    } else if (parent === 'Suites') {
      const node = doc.lanes.find((l) => l.id === 'node-jsc');
      if (node?.rows.some((r) => r.group === title) !== true) {
        problems.push(`suite "${title}" has no rows in the node-jsc lane`);
      }
    } else if (parent === 'Device') {
      const device = doc.lanes.find((l) => l.id === 'device-native');
      const name = device?.machine?.device ?? null;
      if (!captured('device-native') || name === null || !title.startsWith(name)) {
        problems.push(`device "${title}" is not the device-native lane`);
      }
    } else {
      const id = WEB_HEADINGS[title];
      if (id === undefined) problems.push(`unplaced lane "${title}"`);
      else if (!captured(id)) problems.push(`lane "${title}" (${id}) has no rows`);
    }
  }
  return problems;
}

const markdown = readFileSync(benchmarksDocFile(), 'utf8');

function rebuilt(from: PublicInputs = inputs): PublicExport {
  return buildPublicExport(from, committed.release.version);
}

function clone(doc: PublicExport): PublicExport {
  return JSON.parse(JSON.stringify(doc)) as PublicExport;
}

describe('committed public.json', () => {
  it('is what bench:md generates from the committed captures', () => {
    // The release version is taken from the file itself: the version PR bumps every package.json
    // without re-rendering, and that must not turn the release red.
    expect(committedText).toBe(serializePublicExport(rebuilt()));
  });

  it('names a schema version and a release', () => {
    expect(committed.schemaVersion).toBe(PUBLIC_SCHEMA_VERSION);
    expect(committed.release.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('carries every lane and section benchmarks.md renders', () => {
    expect(docLanesMissingFrom(committed, markdown)).toEqual([]);
  });

  it('carries every row of every capture', () => {
    const node = committed.lanes.find((l) => l.id === 'node-jsc');
    const scenarios = (inputs.microbench?.suites ?? []).flatMap((s) => s.results);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(node?.rows.map((r) => r.median)).toEqual(scenarios.map((r) => r.medianNs));
    const web = [
      ['web-cpu-raster', inputs.webCpu],
      ['web-gpu', inputs.webGpu],
      ['web-android-gpu', inputs.webAndroid],
    ] as const;
    for (const [id, capture] of web) {
      const rows = (capture?.render ?? []).filter((r) => r.kind === 'render');
      const lane = committed.lanes.find((l) => l.id === id);
      expect(lane?.rows.map((r) => r.median)).toEqual(rows.map((r) => r.p50Ms));
    }
    expect(committed.counters.rows.length).toBe(inputs.microbench?.alloc?.length ?? 0);
    expect(committed.heap.rows.length).toBe(inputs.microbench?.heap.length ?? 0);
    expect(committed.payload.rows.length).toBe(inputs.webCpu?.payload?.length ?? 0);
    expect(committed.coldStart.rows.length).toBe(inputs.webCpu?.coldStart?.length ?? 0);
  });

  it('gives every row a spread band', () => {
    expect(rowsWithoutBand(committed)).toEqual([]);
  });

  it('carries only whitelisted keys', () => {
    expect(allStrayKeys(committed as unknown as Json)).toEqual([]);
  });

  it('carries no host internals', () => {
    expect(committedText).not.toMatch(/powerScheme|affinity/i);
    // The power-plan GUID and its localised label, whichever key they might travel under.
    expect(committedText).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(committedText).not.toContain('Wysoka');
  });

  it('labels rows without the column-alignment padding', () => {
    const labels = committed.lanes.flatMap((l) => l.rows.map((r) => r.label));
    expect(labels.filter((l) => l !== l.trim() || /\s{2,}/.test(l))).toEqual([]);
  });

  it('keeps row ids unique within a lane, and shared across the render lanes', () => {
    for (const lane of committed.lanes) {
      const ids = lane.rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const node = committed.lanes.find((l) => l.id === 'node-jsc');
    const renderIds = node?.rows.filter((r) => r.group === 'Render').map((r) => r.id);
    for (const id of ['web-cpu-raster', 'web-gpu', 'web-android-gpu']) {
      const lane = committed.lanes.find((l) => l.id === id);
      if (lane?.status !== 'none') expect(lane?.rows.map((r) => r.id)).toEqual(renderIds);
    }
  });

  it('notes every row held to a wider tolerance, and only those', () => {
    const node = committed.lanes.find((l) => l.id === 'node-jsc');
    const noted = node?.rows.filter((r) => r.note !== null).map((r) => r.id) ?? [];
    const expected = [...SCENARIO_DEVIATION_OVERRIDES.keys()].map((s) => PUBLIC_ROW_IDS[s] ?? s);
    expect([...noted].sort()).toEqual([...expected].sort());
    for (const [scenario, override] of SCENARIO_DEVIATION_OVERRIDES) {
      const row = node?.rows.find((r) => r.id === PUBLIC_ROW_IDS[scenario]);
      expect(row?.note).toContain(`${override.percent}%`);
      expect(row?.note).toContain(override.reason);
    }
  });

  it('points every coverage cell at a lane, a section or nothing', () => {
    const laneIds = committed.lanes.filter((l) => l.status !== 'none').map((l) => l.id);
    for (const category of committed.coverage.categories) {
      expect(Object.keys(category.cells)).toEqual(committed.coverage.platforms.map((p) => p.id));
      for (const cell of Object.values(category.cells)) {
        for (const id of cell.lanes) expect(laneIds).toContain(id);
        const measured = cell.lanes.length + cell.sections.length > 0;
        expect(measured).toBe(cell.status === 'measured' || cell.status === 'stale');
      }
    }
  });
});

describe('the checks above fail on the defects they name', () => {
  it('a lane rendered in benchmarks.md but absent from the export', () => {
    const doc = clone(committed);
    doc.lanes = doc.lanes.filter((l) => l.id !== 'web-gpu');
    expect(docLanesMissingFrom(doc, markdown)).toEqual([
      'lane "Render suite — desktop GPU" (web-gpu) has no rows',
    ]);
    expect(docLanesMissingFrom(committed, `${markdown}\n### Render suite — Firefox\n`)).toEqual([
      'unplaced lane "Render suite — Firefox"',
    ]);
    expect(docLanesMissingFrom(committed, `${markdown}\n## Frame capacity\n`)).toEqual([
      'unplaced section "Frame capacity"',
    ]);
  });

  it('a row with no spread band', () => {
    const micro = inputs.microbench;
    if (micro === null) throw new Error('no committed microbench.json');
    const single = JSON.parse(JSON.stringify(micro)) as typeof micro;
    const first = single.suites[0]?.results[0];
    if (first === undefined) throw new Error('microbench.json has no rows');
    delete first.bandMinNs;
    expect(rowsWithoutBand(rebuilt({ ...inputs, microbench: single }))).toEqual([
      `node-jsc/${PUBLIC_ROW_IDS[first.scenario]}`,
    ]);
  });

  it('a key outside the whitelist', () => {
    const doc = clone(committed) as unknown as { lanes: { machine: Record<string, Json> }[] };
    const machine = doc.lanes[0]?.machine;
    if (machine === undefined) throw new Error('no lanes');
    machine.powerSchemeGuid = '8c5e7fda';
    expect(allStrayKeys(doc as unknown as Json)).toEqual(['lanes[0].machine.powerSchemeGuid']);
  });
});

describe('row ids', () => {
  it('exist for every scenario in the frozen contract', () => {
    const names = [
      ...Object.values(EXPECTED_SCENARIOS).flat(),
      ...EXPECTED_HEAP_SCENARIOS,
      ...EXPECTED_ALLOC_SCENARIOS,
    ];
    expect(names.filter((n) => PUBLIC_ROW_IDS[n] === undefined)).toEqual([]);
  });

  it('are unique', () => {
    const ids = Object.values(PUBLIC_ROW_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuse a scenario that has none', () => {
    const micro = inputs.microbench;
    if (micro === null) throw new Error('no committed microbench.json');
    const renamed = JSON.parse(JSON.stringify(micro)) as typeof micro;
    const first = renamed.suites[0]?.results[0];
    if (first === undefined) throw new Error('microbench.json has no rows');
    first.scenario = 'ecs.step  9000 entities';
    expect(() => rebuilt({ ...inputs, microbench: renamed })).toThrow('has no public row id');
  });
});
