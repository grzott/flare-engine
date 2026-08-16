import { describe, expect, it } from 'bun:test';
import {
  allRecords,
  buildProvenance,
  buildWebCapture,
  collectHostAndCommit,
  readAppVersion,
  toColdStartRecords,
  toPayloadRecords,
  toRenderRecords,
} from '../scripts/history.js';

const PROVENANCE_INPUT = {
  commit: 'abc123def456',
  host: 'win32 x64 (Test CPU)',
  appVersion: '0.2.1',
  browserName: 'chromium',
  browserVersion: '151.0.7922.34',
  capturedAt: '2026-08-16T09:10:02.226Z',
};

describe('buildProvenance', () => {
  it('carries every field the provenance schema requires, runtime fixed to web-swiftshader', () => {
    const p = buildProvenance(PROVENANCE_INPUT);
    expect(p).toEqual({ ...PROVENANCE_INPUT, runtime: 'web-swiftshader' });
  });
});

describe('toRenderRecords / toPayloadRecords / toColdStartRecords', () => {
  const p = buildProvenance(PROVENANCE_INPUT);

  it('render records carry the ms unit and full provenance on every row', () => {
    const [rec] = toRenderRecords(
      [
        {
          name: 'render.flush   1000 sprites / 1 atlas',
          samples: 100,
          p50Ms: 2.2,
          p95Ms: 2.4,
          p99Ms: 2.6,
        },
      ],
      p,
    );
    expect(rec).toMatchObject({
      kind: 'render',
      unit: 'ms',
      commit: PROVENANCE_INPUT.commit,
      host: PROVENANCE_INPUT.host,
      runtime: 'web-swiftshader',
      appVersion: PROVENANCE_INPUT.appVersion,
    });
  });

  it('payload records carry the bytes unit', () => {
    const [rec] = toPayloadRecords([{ name: 'canvaskit.default.raw', bytes: 7_094_511 }], p);
    expect(rec).toMatchObject({ kind: 'payload', unit: 'bytes', bytes: 7_094_511 });
  });

  it('cold start records carry the ms unit and the network profile only when throttled', () => {
    const [plain, throttled] = toColdStartRecords(
      [
        { name: 'coldStart.cold', ms: 812.4, network: null },
        {
          name: 'coldStart.cold4g',
          ms: 15234.1,
          network: {
            downloadThroughputBytesPerSec: 524_288,
            uploadThroughputBytesPerSec: 393_216,
            latencyMs: 20,
          },
        },
      ],
      p,
    );
    expect(plain).toMatchObject({ kind: 'coldStart', unit: 'ms', network: null });
    expect(throttled?.network).toEqual({
      downloadThroughputBytesPerSec: 524_288,
      uploadThroughputBytesPerSec: 393_216,
      latencyMs: 20,
    });
  });
});

describe('buildWebCapture / allRecords', () => {
  it('flattens every lane into one list, in render → payload → coldStart order', () => {
    const p = buildProvenance(PROVENANCE_INPUT);
    const capture = buildWebCapture({
      generated: PROVENANCE_INPUT.capturedAt,
      render: toRenderRecords([{ name: 'r', samples: 100, p50Ms: 1, p95Ms: 2, p99Ms: 3 }], p),
      payload: toPayloadRecords([{ name: 'canvaskit.default.raw', bytes: 1 }], p),
      coldStart: toColdStartRecords([{ name: 'coldStart.cold', ms: 1, network: null }], p),
    });
    expect(capture.schemaVersion).toBe(1);
    const all = allRecords(capture);
    expect(all.map((r) => r.kind)).toEqual(['render', 'payload', 'coldStart']);
  });
});

describe('collectHostAndCommit', () => {
  it('returns non-empty commit and host strings', () => {
    const { commit, host } = collectHostAndCommit();
    expect(commit.length).toBeGreaterThan(0);
    expect(host.length).toBeGreaterThan(0);
  });
});

describe('readAppVersion', () => {
  it('reads a real semver-shaped version off @flare-engine/render-web/package.json', async () => {
    const version = await readAppVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
