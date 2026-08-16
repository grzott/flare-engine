import { describe, expect, it } from 'bun:test';
import { FOUR_G_PROFILE, measureCanvasKitPayload } from '../scripts/payload.js';

describe('measureCanvasKitPayload', () => {
  it('reports four finite, positive byte counts', () => {
    const bytes = measureCanvasKitPayload();
    expect(bytes).toHaveLength(4);
    for (const b of bytes) {
      expect(Number.isFinite(b.bytes)).toBe(true);
      expect(b.bytes).toBeGreaterThan(0);
    }
  });

  it('names exactly the four default/full × raw/gzip variants', () => {
    const names = measureCanvasKitPayload().map((b) => b.name);
    expect(names).toEqual([
      'canvaskit.default.raw',
      'canvaskit.default.gzip',
      'canvaskit.full.raw',
      'canvaskit.full.gzip',
    ]);
  });

  it('the full binary is larger than default, raw and gzipped alike', () => {
    const [defaultRaw, defaultGzip, fullRaw, fullGzip] = measureCanvasKitPayload();
    expect(fullRaw!.bytes).toBeGreaterThan(defaultRaw!.bytes);
    expect(fullGzip!.bytes).toBeGreaterThan(defaultGzip!.bytes);
  });

  it('gzip shrinks the binary substantially (it is not a no-op)', () => {
    const [defaultRaw, defaultGzip] = measureCanvasKitPayload();
    expect(defaultGzip!.bytes).toBeLessThan(defaultRaw!.bytes);
  });
});

describe('FOUR_G_PROFILE', () => {
  it('states exact, reproducible throttle parameters', () => {
    expect(FOUR_G_PROFILE).toEqual({
      downloadThroughputBytesPerSec: 524_288,
      uploadThroughputBytesPerSec: 393_216,
      latencyMs: 20,
    });
  });
});
