import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import {
  allRecords,
  androidWebBaselineFilePath,
  androidWebLatestFilePath,
  buildProvenance,
  buildWebAndroidCapture,
  buildWebCapture,
  buildWebGpuCapture,
  collectHostAndCommit,
  gpuWebBaselineFilePath,
  gpuWebLatestFilePath,
  readAppVersion,
  toColdStartRecords,
  toPayloadRecords,
  toRenderRecords,
  webBaselineFilePath,
  webLatestFilePath,
  writeAndroidWebLatestCapture,
  writeGpuWebLatestCapture,
  writeWebLatestCapture,
} from '../scripts/history.js';

const PROVENANCE_INPUT = {
  commit: 'abc123def456',
  host: 'win32 x64 (Test CPU)',
  runtime: 'web-cpu-raster' as const,
  appVersion: '0.2.1',
  browserName: 'chromium',
  browserVersion: '151.0.7922.34',
  capturedAt: '2026-08-16T09:10:02.226Z',
};

describe('buildProvenance', () => {
  it('carries every field the provenance schema requires, runtime as given', () => {
    const p = buildProvenance(PROVENANCE_INPUT);
    expect(p).toEqual(PROVENANCE_INPUT);
  });

  it('carries rendererString through for gpu records', () => {
    const p = buildProvenance({
      ...PROVENANCE_INPUT,
      runtime: 'web-gpu',
      rendererString: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    });
    expect(p.runtime).toBe('web-gpu');
    expect(p.rendererString).toBe(
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    );
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
          opsPerBatch: 5000,
          batchMs: 20.1,
          frameDeltaMs: 16.7,
        },
      ],
      p,
    );
    expect(rec).toMatchObject({
      kind: 'render',
      unit: 'ms',
      commit: PROVENANCE_INPUT.commit,
      host: PROVENANCE_INPUT.host,
      runtime: 'web-cpu-raster',
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
      render: toRenderRecords(
        [
          {
            name: 'r',
            samples: 100,
            p50Ms: 1,
            p95Ms: 2,
            p99Ms: 3,
            opsPerBatch: 100,
            batchMs: 20,
            frameDeltaMs: 16.7,
          },
        ],
        p,
      ),
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
/**
 * The PERF-18 invariant: a capture writes its own sidecar and nothing else. Before this, every
 * capture rewrote the lane's published baseline from that single run, so one verification capture
 * replaced a committed 5-run fold with a one-run snapshot (perf-measurement-2026-07.md §12 F4) —
 * and the fold could no longer tell a re-capture from a window it had already published.
 *
 * Written against the real result paths on purpose: the sidecars are gitignored scratch, and a test
 * against injected paths would not have caught the original bug, which was entirely about which
 * file the writer named.
 */
describe('a capture writes a sidecar, never the published baseline', () => {
  const STAMP = '2026-09-06T12:00:00.000Z';

  const lanes = [
    {
      name: 'cpu-raster',
      latest: webLatestFilePath(),
      baseline: webBaselineFilePath(),
      write: () =>
        writeWebLatestCapture(
          buildWebCapture({ generated: STAMP, render: [], payload: [], coldStart: [] }),
        ),
    },
    {
      name: 'gpu',
      latest: gpuWebLatestFilePath(),
      baseline: gpuWebBaselineFilePath(),
      write: () => writeGpuWebLatestCapture(buildWebGpuCapture({ generated: STAMP, render: [] })),
    },
    {
      name: 'android',
      latest: androidWebLatestFilePath(),
      baseline: androidWebBaselineFilePath(),
      write: () =>
        writeAndroidWebLatestCapture(buildWebAndroidCapture({ generated: STAMP, render: [] })),
    },
  ];

  for (const lane of lanes) {
    it(`${lane.name}: writes the sidecar and leaves the published baseline byte-identical`, () => {
      const baselineBefore = existsSync(lane.baseline) ? readFileSync(lane.baseline, 'utf8') : null;
      const sidecarBefore = existsSync(lane.latest) ? readFileSync(lane.latest, 'utf8') : null;

      try {
        const written = lane.write();
        expect(written).toBe(lane.latest);
        expect(JSON.parse(readFileSync(lane.latest, 'utf8')).generated).toBe(STAMP);

        const baselineAfter = existsSync(lane.baseline)
          ? readFileSync(lane.baseline, 'utf8')
          : null;
        expect(baselineAfter).toBe(baselineBefore);
      } finally {
        if (sidecarBefore === null) rmSync(lane.latest, { force: true });
        else writeFileSync(lane.latest, sidecarBefore, 'utf8');
      }
    });

    it(`${lane.name}: the sidecar is a distinct, gitignored path beside the baseline`, () => {
      expect(lane.latest).not.toBe(lane.baseline);
      // `benchmarks/results/*-latest.json` in .gitignore is what keeps a one-run file out of the
      // tree; a rename that broke this suffix would start committing single runs again.
      expect(basename(lane.latest).endsWith('-latest.json')).toBe(true);
      expect(dirname(lane.latest)).toBe(dirname(lane.baseline));
    });
  }
});
