import { describe, expect, test } from 'bun:test';
import type {
  CaptureSource,
  ScreenshotResult,
  ScreenshotTarget,
  SkiaImageLike,
} from '@flare-engine/share';
import { createCaptureScene } from '../src/scenes/capture';
import { PT_SCREENSHOT_TARGETS, createPTScreenshotScene } from '../src/share/manager';

function makeFakeImage(width: number, height: number): SkiaImageLike {
  return {
    width: () => width,
    height: () => height,
    encodeToBytes: (_format, _quality) => new Uint8Array([1, 2, 3, 4]),
  };
}

function makeFakeSource(): CaptureSource & { snapshots: number } {
  let snapshots = 0;
  return {
    get snapshots() {
      return snapshots;
    },
    makeImageSnapshot() {
      snapshots += 1;
      return makeFakeImage(1080, 1920);
    },
  };
}

function makeFakeContext(): import('@flare-engine/engine').GameContextValue {
  return {} as unknown as import('@flare-engine/engine').GameContextValue;
}

describe('PT_SCREENSHOT_TARGETS — M9.6 session #18', () => {
  test('declares Play + iOS portrait phone slots with stable ids', () => {
    const ids = PT_SCREENSHOT_TARGETS.map((t) => t.id);
    expect(ids).toContain('play-1080x1920');
    expect(ids).toContain('play-1080x2400');
    expect(ids).toContain('ios-1242x2688');
    expect(ids).toContain('ios-1290x2796');
  });

  test('every target uses PNG and a positive width/height', () => {
    for (const t of PT_SCREENSHOT_TARGETS) {
      expect(t.format).toBe('png');
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
    }
  });
});

describe('createPTScreenshotScene — M9.6 session #18', () => {
  test('captureAll() returns one result per default PT target', async () => {
    const source = makeFakeSource();
    const scene = createPTScreenshotScene({ source });
    const results = await scene.captureAll();
    expect(results).toHaveLength(PT_SCREENSHOT_TARGETS.length);
    expect(source.snapshots).toBe(PT_SCREENSHOT_TARGETS.length);
    expect(results[0]?.target.id).toBe('play-1080x1920');
  });

  test('capture(id) returns null for unknown id and result for known id', async () => {
    const source = makeFakeSource();
    const scene = createPTScreenshotScene({ source });
    expect(await scene.capture('does-not-exist')).toBeNull();
    const result = await scene.capture('ios-1242x2688');
    expect(result).not.toBeNull();
    expect(result?.target.id).toBe('ios-1242x2688');
  });

  test('setup hook fires before each capture', async () => {
    const source = makeFakeSource();
    const seen: string[] = [];
    const scene = createPTScreenshotScene({
      source,
      targets: [
        { id: 'a', width: 100, height: 100, format: 'png' },
        { id: 'b', width: 200, height: 200, format: 'png' },
      ],
      setup: (target) => {
        seen.push(target.id);
      },
    });
    await scene.captureAll();
    expect(seen).toEqual(['a', 'b']);
  });
});

describe('createCaptureScene — M9.6 session #18', () => {
  test('onEnter triggers captureAll and forwards results to onComplete', async () => {
    const source = makeFakeSource();
    const screenshots = createPTScreenshotScene({
      source,
      targets: [{ id: 'only', width: 100, height: 200, format: 'png' }],
    });
    let received: readonly ScreenshotResult[] | null = null;
    const sceneFactory = createCaptureScene(makeFakeContext(), {
      screenshots,
      onComplete: (r) => {
        received = r;
      },
    });
    const scene = sceneFactory();
    expect(scene.name).toBe('capture');

    scene.onEnter?.();
    // Allow the queued microtask + awaited captureAll to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(received).not.toBeNull();
    const list = received as unknown as readonly ScreenshotResult[];
    expect(list).toHaveLength(1);
    expect(list[0]?.target.id).toBe('only');
  });

  test('onError fires when captureAll rejects', async () => {
    const failingScreenshots = {
      targets: [] as readonly ScreenshotTarget[],
      capture: async () => null,
      captureAll: async () => {
        throw new Error('capture exploded');
      },
    };
    let caught: unknown = null;
    const sceneFactory = createCaptureScene(makeFakeContext(), {
      screenshots: failingScreenshots,
      onError: (err) => {
        caught = err;
      },
    });
    sceneFactory().onEnter?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('capture exploded');
  });
});
