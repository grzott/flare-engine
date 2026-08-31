import { describe, expect, it } from 'bun:test';
import type { SceneSurfaceLike, SceneSurfaceModuleLike } from '../src/scene-texture.js';
import { createSceneCapture, createSceneSurfaceCache } from '../src/scene-texture.js';

/**
 * Regression cover for the WEB-1 defect: on web, RN-Skia's `MakeOffscreen`
 * allocates a fresh `OffscreenCanvas` + WebGL context per call and releases
 * nothing. `GameView` pushes a new picture every frame, so a per-frame
 * allocation blows Chrome's 16-live-context cap within ~16 frames and the
 * on-screen canvas is evicted — the game loop keeps running and paints
 * nothing. See docs/plans/web-target-2026-08.md §12.
 *
 * These exercise the real cache against a counting Skia stub; the count IS the
 * behavior under test, so a stub is the only way to observe it.
 */

interface StubSurface {
  disposed: boolean;
  w: number;
  h: number;
}

/** `Symbol.dispose` is outside this project's ES2022 lib, so it is reached
 *  through a typed lookup rather than a computed key literal. */
const DISPOSE = (Symbol as unknown as { dispose?: symbol }).dispose;

function makeStubSkia(): { module: SceneSurfaceModuleLike; created: StubSurface[] } {
  const created: StubSurface[] = [];
  const module: SceneSurfaceModuleLike = {
    Surface: {
      MakeOffscreen(width: number, height: number) {
        const record: StubSurface = { disposed: false, w: width, h: height };
        created.push(record);
        const surface: Record<string | symbol, unknown> = {
          getCanvas: () => ({ drawPicture: () => {}, clear: () => {} }),
          makeImageSnapshot: () => ({ width: () => width, height: () => height }),
          flush: () => {},
        };
        if (DISPOSE !== undefined) {
          surface[DISPOSE] = (): void => {
            record.disposed = true;
          };
        }
        return surface as unknown as SceneSurfaceLike;
      },
    },
  };
  return { module, created };
}

describe('createSceneSurfaceCache', () => {
  it('allocates one offscreen surface for many frames at a constant size', () => {
    const { module, created } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    for (let frame = 0; frame < 120; frame++) {
      cache.acquire(800, 600);
    }

    expect(created.length).toBe(1);
  });

  it('returns the same surface instance on every frame at a constant size', () => {
    const { module } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    const first = cache.acquire(800, 600);
    const second = cache.acquire(800, 600);

    expect(second).toBe(first);
  });

  it('reallocates when the size changes and disposes the surface it replaced', () => {
    const { module, created } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    cache.acquire(800, 600);
    cache.acquire(800, 600);
    cache.acquire(640, 480);

    expect(created.length).toBe(2);
    expect(created[0]?.disposed).toBe(true);
    expect(created[1]?.disposed).toBe(false);
    expect(created[1]?.w).toBe(640);
    expect(created[1]?.h).toBe(480);
  });

  it('disposes the live surface on dispose()', () => {
    const { module, created } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    cache.acquire(800, 600);
    cache.dispose();

    expect(created[0]?.disposed).toBe(true);
  });

  it('allocates again after dispose() rather than handing back a dead surface', () => {
    const { module, created } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    cache.acquire(800, 600);
    cache.dispose();
    cache.acquire(800, 600);

    expect(created.length).toBe(2);
    expect(created[1]?.disposed).toBe(false);
  });

  it('returns null and allocates nothing for a zero-sized viewport', () => {
    const { module, created } = makeStubSkia();
    const cache = createSceneSurfaceCache(module);

    expect(cache.acquire(0, 0)).toBeNull();
    expect(created.length).toBe(0);
  });
});

/**
 * Per-frame release cover. Measured in a browser (WEB-2): with the snapshot and
 * the previous CPU image never released, CanvasKit's wasm heap is exhausted and
 * `readPixels` throws `Aborted()` — reproduced at iteration 566 of 1200 at
 * 1280x720, matching the ~800-frame death seen in the app. Releasing both
 * survives 1500 frames at 2560x1215.
 */
interface StubImage {
  disposed: boolean;
  kind: 'snapshot' | 'cpu';
}

function makeCaptureStub(): {
  module: SceneSurfaceModuleLike<StubImage>;
  images: StubImage[];
} {
  const images: StubImage[] = [];
  const attachDispose = (record: StubImage, extra: Record<string, unknown> = {}) => {
    const obj: Record<string | symbol, unknown> = { ...extra };
    if (DISPOSE !== undefined) {
      obj[DISPOSE] = (): void => {
        record.disposed = true;
      };
    }
    return obj;
  };

  const module: SceneSurfaceModuleLike<StubImage> = {
    Surface: {
      MakeOffscreen(width: number, height: number) {
        return {
          getCanvas: () => ({ drawPicture: () => {} }),
          flush: () => {},
          makeImageSnapshot: () => {
            const snapRecord: StubImage = { disposed: false, kind: 'snapshot' };
            images.push(snapRecord);
            const snapshot = attachDispose(snapRecord, {
              makeNonTextureImage: () => {
                const cpuRecord: StubImage = { disposed: false, kind: 'cpu' };
                images.push(cpuRecord);
                return attachDispose(cpuRecord) as unknown as StubImage;
              },
            });
            return snapshot as unknown as StubImage;
          },
          width,
          height,
        } as unknown as SceneSurfaceLike<StubImage>;
      },
    },
  };
  return { module, images };
}

describe('createSceneCapture', () => {
  it('releases the GPU snapshot every frame once it has been copied', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600);

    const snapshots = images.filter((i) => i.kind === 'snapshot');
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]?.disposed).toBe(true);
  });

  it('does not release the image it just returned', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600);

    const cpu = images.filter((i) => i.kind === 'cpu');
    expect(cpu.length).toBe(1);
    expect(cpu[0]?.disposed).toBe(false);
  });

  it('image at frame N is still alive after frames N+1 and N+2 (ring depth 3)', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600); // frame 0 → cpu[0]
    capture.capture({}, 800, 600); // frame 1 → cpu[1]
    capture.capture({}, 800, 600); // frame 2 → cpu[2]

    const cpu = images.filter((i) => i.kind === 'cpu');
    expect(cpu[0]?.disposed).toBe(false);
    expect(cpu[1]?.disposed).toBe(false);
    expect(cpu[2]?.disposed).toBe(false);
  });

  it('image at frame N is released when frame N+3 is captured', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600); // frame 0 → cpu[0]
    capture.capture({}, 800, 600); // frame 1 → cpu[1]
    capture.capture({}, 800, 600); // frame 2 → cpu[2]

    const cpuBeforeRelease = images.filter((i) => i.kind === 'cpu');
    expect(cpuBeforeRelease[0]?.disposed).toBe(false);

    capture.capture({}, 800, 600); // frame 3 → cpu[3]; ring overflows, cpu[0] released

    const cpu = images.filter((i) => i.kind === 'cpu');
    expect(cpu[0]?.disposed).toBe(true);
    expect(cpu[1]?.disposed).toBe(false);
    expect(cpu[2]?.disposed).toBe(false);
    expect(cpu[3]?.disposed).toBe(false);
  });

  it('holds at most three frame images across a long run (ring depth 3)', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    for (let frame = 0; frame < 500; frame++) {
      capture.capture({}, 800, 600);
    }

    const liveCpu = images.filter((i) => i.kind === 'cpu' && !i.disposed);
    const liveSnapshots = images.filter((i) => i.kind === 'snapshot' && !i.disposed);
    expect(liveCpu.length).toBe(3);
    expect(liveSnapshots.length).toBe(0);
  });

  it('releases the held frame image on dispose()', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600);
    capture.dispose();

    expect(images.filter((i) => !i.disposed).length).toBe(0);
  });

  it('dispose() releases all images still in the ring', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    capture.capture({}, 800, 600);
    capture.capture({}, 800, 600);
    capture.capture({}, 800, 600);
    capture.dispose();

    const liveCpu = images.filter((i) => i.kind === 'cpu' && !i.disposed);
    expect(liveCpu.length).toBe(0);
  });

  it('returns null and captures nothing for a zero-sized viewport', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module);

    expect(capture.capture({}, 0, 0)).toBeNull();
    expect(images.length).toBe(0);
  });

  it('nonTextureImage: false — snapshot returned directly, makeNonTextureImage never called', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module, { nonTextureImage: false });

    capture.capture({}, 800, 600);

    const cpuImages = images.filter((i) => i.kind === 'cpu');
    expect(cpuImages.length).toBe(0);

    const snapshots = images.filter((i) => i.kind === 'snapshot');
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]?.disposed).toBe(false);
  });

  it('retentionDepth: 2 — image at frame N released when frame N+2 is captured', () => {
    const { module, images } = makeCaptureStub();
    const capture = createSceneCapture(module, { retentionDepth: 2 });

    capture.capture({}, 800, 600); // frame 0 → cpu[0]
    capture.capture({}, 800, 600); // frame 1 → cpu[1]

    const cpuBefore = images.filter((i) => i.kind === 'cpu');
    expect(cpuBefore[0]?.disposed).toBe(false);

    capture.capture({}, 800, 600); // frame 2 → cpu[2]; ring overflows, cpu[0] released

    const cpu = images.filter((i) => i.kind === 'cpu');
    expect(cpu[0]?.disposed).toBe(true);
    expect(cpu[1]?.disposed).toBe(false);
    expect(cpu[2]?.disposed).toBe(false);
  });
});
