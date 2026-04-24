import { describe, expect, test } from 'bun:test';
import { type CaptureSource, createScreenshotScene } from '../src/index.js';

function makeSource(): CaptureSource & { calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    makeImageSnapshot() {
      calls++;
      return {
        width: () => 100,
        height: () => 200,
        encodeToBytes: () => new Uint8Array([1, 2, 3]),
      };
    },
  };
}

describe('createScreenshotScene', () => {
  test('capture(id) returns the matching result', async () => {
    const source = makeSource();
    const scene = createScreenshotScene({
      source,
      targets: [
        { id: 'play', width: 1080, height: 1920 },
        { id: 'ios', width: 1284, height: 2778 },
      ],
    });
    const r = await scene.capture('play');
    expect(r?.target.id).toBe('play');
    expect(r?.screenshot.width).toBe(100);
  });

  test('capture returns null for unknown id', async () => {
    const source = makeSource();
    const scene = createScreenshotScene({
      source,
      targets: [{ id: 'play', width: 1, height: 1 }],
    });
    expect(await scene.capture('missing')).toBeNull();
  });

  test('captureAll yields one result per target in order', async () => {
    const source = makeSource();
    const scene = createScreenshotScene({
      source,
      targets: [
        { id: 'a', width: 1, height: 1 },
        { id: 'b', width: 2, height: 2 },
        { id: 'c', width: 3, height: 3 },
      ],
    });
    const results = await scene.captureAll();
    expect(results.map((r) => r.target.id)).toEqual(['a', 'b', 'c']);
    expect(source.calls).toBe(3);
  });

  test('setup hook runs before each capture', async () => {
    const source = makeSource();
    const order: string[] = [];
    const scene = createScreenshotScene({
      source,
      targets: [
        { id: 'a', width: 1, height: 1 },
        { id: 'b', width: 2, height: 2 },
      ],
      async setup(t) {
        order.push(`setup:${t.id}`);
      },
    });
    await scene.captureAll();
    expect(order).toEqual(['setup:a', 'setup:b']);
  });

  test('failed captures are skipped by captureAll', async () => {
    const source: CaptureSource = {
      makeImageSnapshot: () => null,
    };
    const scene = createScreenshotScene({
      source,
      targets: [{ id: 'a', width: 1, height: 1 }],
    });
    expect(await scene.captureAll()).toEqual([]);
  });
});
