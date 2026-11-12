import { describe, expect, it } from 'bun:test';
import {
  type AbColdStartRow,
  type AbRenderRow,
  type AbRow,
  bandVerdict,
  formatReport,
  interleave,
  median,
  parseAbRows,
  readAbFields,
  summarize,
} from '../scripts/ab-210-report.js';
import { abEnvRefusal } from '../scripts/run.js';
import { parseWasmArm } from '../src/wasm-arm.js';

// #210 A/B: the switch plumbing and the table `bench:web:ab210` ends with.

const ZONE = 'render.flush   1000 sprites / zone-bg path';
const OUTLINE = 'render.flush   1000 sprites / outline effect';
const ATLAS = 'render.flush   1000 sprites / 1 atlas';

const prov = {
  commit: 'abc123',
  host: 'win32 x64 (test)',
  affinityMask: '0xffff',
  powerSchemeLabel: 'High performance',
  browserVersion: '158.0.0.0',
  hostLoadPct: 3,
};

function render(arm: AbRow['arm'], round: number, name: string, p50Ms: number): AbRenderRow {
  return {
    ab: 210,
    runId: 'r1',
    arm,
    round,
    capturedAt: `2026-11-12T10:0${round}:00.000Z`,
    kind: 'render',
    name,
    samples: 20,
    p50Ms,
    p95Ms: p50Ms,
    p99Ms: p50Ms,
    ...prov,
    wasmArmTaken: arm,
    wasmRequests: { network: arm === 'url-cached' ? 2 : 1, cache: 0, blob: arm === 'blob' ? 1 : 0 },
  };
}

function cold(
  arm: AbRow['arm'],
  round: number,
  profile: 'context' | 'persistent',
  name: string,
  ms: number,
): AbColdStartRow {
  return {
    ab: 210,
    runId: 'r1',
    arm,
    round,
    capturedAt: `2026-11-12T10:0${round}:30.000Z`,
    kind: 'coldStart',
    profile,
    name,
    ms,
    ...prov,
    wasmArmTaken: arm,
    wasmRequests:
      profile === 'persistent' && arm === 'url-cached'
        ? { network: 1, cache: 1, blob: 0 }
        : { network: 1, cache: 0, blob: 0 },
  };
}

describe('interleave', () => {
  it('runs every arm once per round, ABC ABC ABC, not AAA BBB CCC', () => {
    const order = interleave(['a', 'b', 'c'], 3).map((s) => `${s.arm}${s.round}`);
    expect(order).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'c2', 'a3', 'b3', 'c3']);
  });
});

describe('median', () => {
  it('takes the middle value of an odd count, the mean of the middle two of an even count', () => {
    expect(median([110.5, 95.2, 97.1])).toBe(97.1);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('bandVerdict', () => {
  it('holds the pre-#196 band inclusive at both ends', () => {
    expect(bandVerdict(89.5)).toBe('in band');
    expect(bandVerdict(97.4)).toBe('in band');
    expect(bandVerdict(97.5)).toBe('above band');
    expect(bandVerdict(89.4)).toBe('below band');
  });
});

describe('summarize', () => {
  const rows: AbRow[] = [
    render('blob', 1, ZONE, 110.6),
    render('blob', 2, ZONE, 110.4),
    render('blob', 3, ZONE, 114.9),
    render('blob', 1, OUTLINE, 126.2),
    render('blob', 1, ATLAS, 10.55),
    render('url-cached', 1, ZONE, 95.2),
    render('url-cached', 2, ZONE, 96.0),
    render('url-cached', 3, ZONE, 93.9),
    cold('blob', 1, 'context', 'coldStart.cold4g', 16_712),
    cold('blob', 2, 'context', 'coldStart.cold4g', 16_745),
    cold('blob', 1, 'context', 'coldStart.cold', 98),
    cold('url-cached', 1, 'context', 'coldStart.cold4g', 32_540),
    cold('url-cached', 1, 'persistent', 'coldStart.cold4g', 16_800),
    cold('url-cached', 1, 'context', 'coldStart.warm4g', 1),
  ];

  it('takes per-arm medians of the named rows, matching names with their padding collapsed', () => {
    const [blob, url, urlCached] = summarize(rows);
    expect(blob?.arm).toBe('blob');
    expect(blob?.captures).toBe(3);
    expect(blob?.render['zone-bg path']).toEqual({ median: 110.6, min: 110.4, max: 114.9, n: 3 });
    expect(blob?.render['outline effect']?.median).toBe(126.2);
    expect(blob?.render['1000 sprites / 1 atlas']?.median).toBe(10.55);
    expect(blob?.cold4g.context?.median).toBe(16_728.5);
    expect(blob?.cold.context?.median).toBe(98);
    expect(blob?.cold4g.persistent).toBeNull();

    expect(url?.captures).toBe(0);
    expect(url?.render['zone-bg path']).toBeNull();

    expect(urlCached?.render['zone-bg path']?.median).toBe(95.2);
    expect(urlCached?.cold4g.context?.median).toBe(32_540);
    expect(urlCached?.cold4g.persistent?.median).toBe(16_800);
    expect(urlCached?.cold4gWasm.context).toBe('net 1');
    expect(urlCached?.cold4gWasm.persistent).toBe('net 1 + cache 1');
    expect(urlCached?.renderWasm).toBe('net 2');
  });

  it('ignores a row whose loader took another path, and counts error rows', () => {
    const stale: AbRow = { ...render('url', 1, ZONE, 50), wasmArmTaken: 'blob' };
    const failed: AbRow = {
      ab: 210,
      runId: 'r1',
      arm: 'url',
      round: 2,
      capturedAt: '2026-11-12T10:05:00.000Z',
      kind: 'error',
      step: 'render',
      message: 'boom',
    };
    const url = summarize([stale, failed])[1];
    expect(url?.render['zone-bg path']).toBeNull();
    expect(url?.errors).toBe(1);
  });

  it('prints one table line per arm with the band verdict, and the band itself', () => {
    const text = formatReport(rows);
    const blobLine = text.split('\n').find((l) => l.startsWith('blob '));
    expect(blobLine).toContain('110.6 [110.4-114.9]');
    expect(blobLine).toContain('above band');
    expect(blobLine).toContain('16.73 s');
    expect(text.split('\n').find((l) => l.startsWith('url-cached '))).toContain('in band');
    expect(text).toContain('89.5-97.4 ms');
  });
});

describe('parseAbRows', () => {
  it('keeps only #210 rows and skips lines that do not parse', () => {
    const row = render('url', 1, ZONE, 96);
    const text = [JSON.stringify(row), '{"name":"other"}', '{not json', ''].join('\n');
    expect(parseAbRows(text)).toEqual([row]);
  });
});

describe('readAbFields', () => {
  it('reads the fields a driver adds, and nulls anything malformed', () => {
    expect(
      readAbFields({ wasmArmTaken: 'url', wasmRequests: { network: 1, cache: 0, blob: 0 } }),
    ).toEqual({ wasmArmTaken: 'url', wasmRequests: { network: 1, cache: 0, blob: 0 } });
    expect(readAbFields({ wasmRequests: { network: '1' } })).toEqual({
      wasmArmTaken: null,
      wasmRequests: null,
    });
  });
});

describe('parseWasmArm', () => {
  it('reads the arm from the query, null when absent, and throws on an unknown name', () => {
    expect(parseWasmArm('?mode=cpu-raster&wasmArm=url-cached')).toBe('url-cached');
    expect(parseWasmArm('?mode=cpu-raster')).toBeNull();
    expect(() => parseWasmArm('?wasmArm=url_cached')).toThrow(/unknown wasmArm/);
  });
});

describe('abEnvRefusal', () => {
  it('refuses a history-writing capture while an A/B env var is set', () => {
    expect(abEnvRefusal({})).toBeNull();
    expect(abEnvRefusal({ BENCH_WEB_WASM_ARM: 'blob' })).toContain('BENCH_WEB_WASM_ARM');
    expect(abEnvRefusal({ BENCH_WEB_COLDSTART_PROFILE: 'persistent' })).toContain(
      'must not land in the lane history',
    );
  });
});
