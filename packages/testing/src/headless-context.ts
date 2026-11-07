import { type AssetLoader, AssetManager, type SpriteSheet } from '@flare-engine/assets';
import { Camera2D } from '@flare-engine/render';
import { createMockInputManager, type MockInputManager } from './mock-input.js';
import { type CreateTestWorldOptions, createTestWorld, type TestWorld } from './test-world.js';

export interface CreateHeadlessContextOptions<S = undefined> extends CreateTestWorldOptions {
  /**
   * Viewport width in pixels, forwarded to `camera.setViewport`. Must be given
   * together with `viewportHeight`; one without the other throws a
   * `RangeError`. Omitting both leaves the camera at its `new Camera2D()`
   * default of a 0×0 viewport.
   */
  viewportWidth?: number;
  /** Viewport height in pixels. See `viewportWidth`. */
  viewportHeight?: number;
  /**
   * Value exposed as `scenes` on the context, passed through untouched. The
   * real `GameContextValue` holds a `SceneManager`, but `@flare-engine/scene`
   * is tier 3 and this package is tier 2.5, so the caller builds it (or any
   * stand-in) and hands it over here.
   */
  scenes?: S;
}

export interface HeadlessContext<S = undefined> extends TestWorld {
  /** Real `Camera2D`, updated from `loop.onLateUpdate` like `GameView` does. */
  readonly camera: Camera2D;
  /** Scriptable input; `update()` runs from `loop.onLateUpdate` every frame. */
  readonly input: MockInputManager;
  /** Real `AssetManager` with a loader that resolves `null` for every entry. */
  readonly assets: AssetManager;
  /**
   * Permissive sprite sheet: one 8×8 frame named `headless`, and a `frameMap`
   * whose `get` always returns `0` and `has` always returns `true`, so
   * `getFrame(sheet, anyName)` resolves to that frame.
   */
  readonly sheet: SpriteSheet;
  /** Whatever `options.scenes` was; `undefined` when omitted. */
  readonly scenes: S;
}

const noopLoader: AssetLoader = () => Promise.resolve(null);

function createPermissiveSheet(): SpriteSheet {
  const frameMap = new Map<string, number>();
  frameMap.get = () => 0;
  frameMap.has = () => true;
  return {
    frames: [{ name: 'headless', x: 0, y: 0, w: 8, h: 8 }],
    frameMap,
    animations: new Map(),
  };
}

/**
 * Build a headless stand-in for the React `GameContextValue` for loop-harness
 * tests. It is `createTestWorld(options)` plus the same `camera`, `input` and
 * `assets` members `GameView` constructs (`audio`, `renderer` and `batch` are
 * omitted — they need a platform), a permissive `sheet`, and a caller-supplied
 * `scenes` slot. Nothing here imports React Native or Skia.
 *
 * Mirrors `GameView`'s frame wiring: `loop.onLateUpdate` runs
 * `camera.update(dt)` then `input.update()`, so a `camera.shake()` moves
 * `effectiveX` / `effectiveY` and a tapped pointer's `justPressed` clears once
 * frames are stepped. `world`, `loop`, `clock`, `step` and `stepFrames` are the
 * test world's own.
 */
export function createHeadlessContext(options?: CreateHeadlessContextOptions): HeadlessContext;
export function createHeadlessContext<S>(
  options: CreateHeadlessContextOptions<S> & { scenes: S },
): HeadlessContext<S>;
export function createHeadlessContext(
  options: CreateHeadlessContextOptions<unknown> = {},
): HeadlessContext<unknown> {
  const { viewportWidth, viewportHeight } = options;
  if ((viewportWidth === undefined) !== (viewportHeight === undefined)) {
    throw new RangeError(
      '[@flare-engine/testing] viewportWidth and viewportHeight must be given together',
    );
  }

  const testWorld = createTestWorld({ fixedDt: options.fixedDt, maxDt: options.maxDt });
  const camera = new Camera2D();
  if (viewportWidth !== undefined && viewportHeight !== undefined) {
    camera.setViewport(viewportWidth, viewportHeight);
  }
  const input = createMockInputManager();
  const assets = new AssetManager(noopLoader);

  testWorld.loop.onLateUpdate.add((dt) => {
    camera.update(dt);
    input.update();
  });

  return {
    ...testWorld,
    camera,
    input,
    assets,
    sheet: createPermissiveSheet(),
    scenes: options.scenes,
  };
}
