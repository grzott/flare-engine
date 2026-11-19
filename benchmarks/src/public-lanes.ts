/**
 * The frozen, hand-written half of `results/public.json`: row ids, what each lane does and does
 * not measure, and the coverage matrix. `public-export.ts` joins it with the committed captures.
 *
 * **Row ids are a contract, labels are not.** A consumer keys on `id` to follow one row across
 * releases, so an id never changes once published, even when the scenario's display name does.
 * That is why ids are listed here by hand instead of being derived from the name: a derived id
 * would move with every rename. Renaming a scenario means changing the key in this table and
 * leaving the value alone.
 *
 * The three web lanes run the node Render suite's 18 scenarios under the same names, so they share
 * those ids, which is what lets a consumer line the lanes up row for row.
 */

export const PUBLIC_ROW_IDS: Readonly<Record<string, string>> = {
  'ecs.step   500 entities (Pos+Vel)': 'ecs.step.500',
  'ecs.step  1000 entities (Pos+Vel)': 'ecs.step.1000',
  'ecs.step  2000 entities (Pos+Vel)': 'ecs.step.2000',
  'ecs.step  5000 entities (Pos+Vel)': 'ecs.step.5000',
  'ecs.churn  500 entities, 5%/step': 'ecs.churn.500',
  'ecs.churn 1000 entities, 5%/step': 'ecs.churn.1000',
  'ecs.churn 2000 entities, 5%/step': 'ecs.churn.2000',
  'ecs.churn 5000 entities, 5%/step': 'ecs.churn.5000',
  'physics.step   100 AABB sparse': 'physics.step.100.sparse',
  'physics.step   100 AABB dense ': 'physics.step.100.dense',
  'physics.step   500 AABB sparse': 'physics.step.500.sparse',
  'physics.step   500 AABB dense ': 'physics.step.500.dense',
  'physics.step  1000 AABB sparse': 'physics.step.1000.sparse',
  'physics.step  1000 AABB dense ': 'physics.step.1000.dense',
  'particles.update   500 integrate-only': 'particles.update.500.integrate',
  'particles.update  1000 integrate-only': 'particles.update.1000.integrate',
  'particles.update  2000 integrate-only': 'particles.update.2000.integrate',
  'particles.update  5000 integrate-only': 'particles.update.5000.integrate',
  'particles.update   500 emit+integrate': 'particles.update.500.emit',
  'particles.update  1000 emit+integrate': 'particles.update.1000.emit',
  'particles.update  2000 emit+integrate': 'particles.update.2000.emit',
  'render.flush    100 sprites / 1 atlas': 'render.flush.100.1-atlas',
  'render.flush    500 sprites / 1 atlas': 'render.flush.500.1-atlas',
  'render.flush   1000 sprites / 1 atlas': 'render.flush.1000.1-atlas',
  'render.flush   5000 sprites / 1 atlas': 'render.flush.5000.1-atlas',
  'render.flush    500 sprites / 4 atlas interleaved': 'render.flush.500.4-atlas-interleaved',
  'render.flush    500 sprites / 4 atlas clustered': 'render.flush.500.4-atlas-clustered',
  'render.flush   1000 sprites / 8 atlas interleaved': 'render.flush.1000.8-atlas-interleaved',
  'render.flush   1000 sprites / 8 atlas clustered': 'render.flush.1000.8-atlas-clustered',
  'render.flush   1000 sprites / 50% rotated': 'render.flush.1000.rotated-50',
  'render.flush   1000 sprites / 100% rotated': 'render.flush.1000.rotated-100',
  'render.flush   1000 sprites / 4 alpha runs': 'render.flush.1000.alpha-runs-4',
  'render.flush   1000 sprites / tint effect': 'render.flush.1000.tint',
  'render.flush   1000 sprites / outline effect': 'render.flush.1000.outline',
  'render.flush   1000 sprites / stretch path': 'render.flush.1000.stretch',
  'render.flush   1000 sprites / zone-bg path': 'render.flush.1000.zone-bg',
  'render.sort     500 items (0 swaps)': 'render.sort.500.swaps-0',
  'render.sort     500 items (5 swaps)': 'render.sort.500.swaps-5',
  'render.sort    1000 items (10 swaps)': 'render.sort.1000.swaps-10',
  'integration.frame   500 entities + 300p': 'integration.frame.500',
  'integration.frame  1000 entities + 300p': 'integration.frame.1000',
  'integration.frame  2000 entities + 300p': 'integration.frame.2000',
  'animation.updateTweens    1000 tweens, 4 easings': 'animation.tweens.1000',
  'animation.updateSpring    1000 springs, underdamped': 'animation.springs.1000',
  'animation.updateAnimator  1000 animators, looping': 'animation.animators.1000',
  'postfx.update       5 live: flash + 4 timed': 'postfx.update',
  'postfx.enabled      8 effects, 5 enabled': 'postfx.enabled',
  'postfx.buildPass    8 effects, 5 enabled': 'postfx.build-pass',
  'tilemap.drawInto   256x256 x2 layers, 800x600 view': 'tilemap.draw-into',
  'tilemap.getTileAt  256x256 full-layer scan': 'tilemap.get-tile-at',
  'tilemap.decodeGid     4096 gids, flags + strip': 'tilemap.decode-gid',
  'pathfinding.astar  128x128 open': 'pathfinding.astar.open',
  'pathfinding.astar  128x128 maze': 'pathfinding.astar.maze',
  'pathfinding.jps    128x128 open': 'pathfinding.jps.open',
  'pathfinding.jps    128x128 maze': 'pathfinding.jps.maze',
  'math.vec2         1000 x 6 out-param ops': 'math.vec2.1000',
  'math.transform2d  1000 points, local->world->local': 'math.transform2d.1000',
  'math.mat3         1000 fromTransform x parent': 'math.mat3.1000',
  'render.system  1000 sprites / 3 z layers interleaved': 'render-system.1000',
  'particles.draw  1000 coloured + fading / 1 atlas': 'particles.draw.1000',
  'shapes.draw  1000 baked instances / 8 specs / 1 atlas': 'shapes.draw.1000',

  'integration.heap   500 entities': 'heap.integration.500',
  'integration.heap  1000 entities': 'heap.integration.1000',
  'integration.heap  2000 entities': 'heap.integration.2000',

  'alloc.render  1000 sprites / 1 atlas': 'alloc.render.1-atlas',
  'alloc.render  1000 sprites / 100% rotated': 'alloc.render.rotated-100',
  'alloc.render  1000 sprites / 8 atlas interleaved': 'alloc.render.8-atlas-interleaved',
  'alloc.render  1000 sprites / 8 atlas clustered': 'alloc.render.8-atlas-clustered',
  'alloc.render  1000 sprites / 4 alpha runs': 'alloc.render.alpha-runs-4',
  'alloc.render  1000 sprites / tint effect': 'alloc.render.tint',
  'alloc.render  1000 sprites / outline effect': 'alloc.render.outline',
  'alloc.render  1000 sprites / stretch path': 'alloc.render.stretch',
  'alloc.render  1000 sprites / zone-bg path': 'alloc.render.zone-bg',
  'alloc.frame    500 entities + 300p': 'alloc.frame.500',
  'alloc.frame   1000 entities + 300p': 'alloc.frame.1000',

  'canvaskit.default.raw': 'payload.canvaskit.default.raw',
  'canvaskit.default.gzip': 'payload.canvaskit.default.gzip',
  'canvaskit.full.raw': 'payload.canvaskit.full.raw',
  'canvaskit.full.gzip': 'payload.canvaskit.full.gzip',

  'coldStart.cold': 'cold-start.cold',
  'coldStart.warm': 'cold-start.warm',
  'coldStart.cold4g': 'cold-start.cold-4g',
  'coldStart.warm4g': 'cold-start.warm-4g',

  'light (10 enemies + 50 bullets)': 'device.fps.light',
  'medium (30 enemies + 150 bullets)': 'device.fps.medium',
  'heavy (50 enemies + 300 bullets)': 'device.fps.heavy',
};

/** Human labels for rows whose capture name is a key, not a phrase. */
export const PUBLIC_ROW_LABELS: Readonly<Record<string, string>> = {
  'canvaskit.default.raw': 'CanvasKit default build, raw',
  'canvaskit.default.gzip': 'CanvasKit default build, gzipped',
  'canvaskit.full.raw': 'CanvasKit full build, raw',
  'canvaskit.full.gzip': 'CanvasKit full build, gzipped',
  'coldStart.cold': 'Cold cache, plain network',
  'coldStart.warm': 'Warm cache, plain network',
  'coldStart.cold4g': 'Cold cache, throttled 4G',
  'coldStart.warm4g': 'Warm cache, throttled 4G',
};

export type LaneId =
  | 'node-jsc'
  | 'web-cpu-raster'
  | 'web-gpu'
  | 'web-android-gpu'
  | 'device-native';

export type LanePlatform = 'desktop' | 'desktop-web' | 'android-web' | 'android-native';

export type LaneMeta = {
  readonly id: LaneId;
  /** The runtime is appended in parentheses when the lane has a capture. */
  readonly title: string;
  readonly platform: LanePlatform;
  readonly measures: string;
  readonly doesNotMeasure: readonly string[];
};

const SUBMISSION_NOT_GPU_TIME =
  'GPU execution time: WebGL and CanvasKit calls queue work and return, so the clock sees only ' +
  'what the CPU does to build and hand off the frame.';

export const LANES: readonly LaneMeta[] = [
  {
    id: 'node-jsc',
    title: 'Engine CPU cost per system',
    platform: 'desktop',
    measures:
      'JS cost per operation of the engine hot paths (ECS, physics, particles, render flush and ' +
      'sort, an integration frame, animation, postfx, tilemap, pathfinding, math), off-device. ' +
      'The draw path runs the real frame renderer against a counting Skia stub, up to the point ' +
      'where a batch is handed to Skia.',
    doesNotMeasure: [
      'Skia rasterization, GPU work, the React Native bridge, or any device.',
      'On-device frame times.',
      'Any JS engine other than JavaScriptCore under Bun: V8, Hermes and SpiderMonkey are not measured.',
    ],
  },
  {
    id: 'web-cpu-raster',
    title: 'Render submission cost, CanvasKit CPU raster',
    platform: 'desktop-web',
    measures:
      'Main-thread cost per operation of the 18 render scenarios through real CanvasKit on an ' +
      'offscreen CPU-backed surface, software rasterization included.',
    doesNotMeasure: [
      'GPU-backed rendering.',
      'Browser paint or composite: there is no on-screen canvas in this lane.',
      'Frame rate or frame capacity.',
    ],
  },
  {
    id: 'web-gpu',
    title: 'Render submission cost, desktop GPU',
    platform: 'desktop-web',
    measures:
      'CPU-side submission cost per operation of the 18 render scenarios through real CanvasKit ' +
      'on an on-screen canvas with a WebGL surface.',
    doesNotMeasure: [
      SUBMISSION_NOT_GPU_TIME,
      'Frame rate or frame capacity.',
      'Other hardware: one desktop machine.',
    ],
  },
  {
    id: 'web-android-gpu',
    title: 'Render submission cost, Android device GPU',
    platform: 'android-web',
    measures:
      'CPU-side submission cost per operation of the 18 render scenarios in Chrome on a ' +
      'USB-attached phone, through the same on-screen canvas and WebGL path as the desktop GPU lane.',
    doesNotMeasure: [
      SUBMISSION_NOT_GPU_TIME,
      'Frame rate or frame capacity.',
      'Behaviour under thermal throttling: a window in which the device reported throttling is refused.',
      'A pinned CPU or GPU governor.',
    ],
  },
  {
    id: 'device-native',
    title: 'On-device frame rate',
    platform: 'android-native',
    measures:
      'Frames per second, one sample per second, of a bench scene in a React Native game app at ' +
      'three load levels.',
    doesNotMeasure: [
      'The current engine: this is one historical capture that can no longer be refreshed.',
      'Run-to-run spread: it is a single capture.',
    ],
  },
];

export type SectionId = 'counters' | 'heap' | 'payload' | 'coldStart';

export type SectionMeta = {
  readonly title: string;
  readonly measures: string;
  readonly doesNotMeasure: readonly string[];
};

export const SECTIONS: Readonly<Record<SectionId, SectionMeta>> = {
  counters: {
    title: 'Draw-path allocation counters (exact)',
    measures:
      'Exact integers per scenario from the real frame renderer against a counting Skia stub: ' +
      'pool misses, factory calls, and the draw calls and transform writes repeated every frame.',
    doesNotMeasure: [
      'Allocations that pass through neither a pool nor the injected Skia factory.',
      'Time: these are counts, with no run-to-run variance.',
    ],
  },
  heap: {
    title: 'Integration heap, isolated process per scenario',
    measures:
      'Median per-frame change of the JavaScriptCore heap footprint over measured blocks, after ' +
      'a warm-up to the allocation plateau. An allocation-pressure proxy.',
    doesNotMeasure: [
      'Retention or live bytes: under JavaScriptCore the figure moves with GC scheduling.',
      'GC pause times, the WASM heap, or device memory.',
    ],
  },
  payload: {
    title: 'CanvasKit WASM payload',
    measures: 'Size on disk of the installed canvaskit-wasm binaries, raw and gzipped.',
    doesNotMeasure: ['Brotli size, an application bundle, or the size of any Flare package.'],
  },
  coldStart: {
    title: 'Cold start to first rendered frame',
    measures:
      'Time from navigation to the first surface flush after CanvasKit loads, in headless ' +
      'Chromium on the offscreen CPU-raster surface.',
    doesNotMeasure: [
      'Browser paint or composite timings: there is no on-screen canvas.',
      'Run-to-run spread: each figure is a single capture.',
      'HTTP cache benefit on the throttled pair: headless Chromium did not serve the WASM from its disk cache in this harness.',
      'Any phone.',
    ],
  },
};

export const COVERAGE_PLATFORMS = [
  { id: 'desktopWeb', title: 'Desktop web' },
  { id: 'androidWeb', title: 'Android web' },
  { id: 'iosWeb', title: 'iOS web' },
  { id: 'androidNative', title: 'Android native (React Native + Skia)' },
  { id: 'iosNative', title: 'iOS native (React Native + Skia)' },
] as const;

export type CoveragePlatformId = (typeof COVERAGE_PLATFORMS)[number]['id'];

/**
 * What answers a coverage cell today. `lanes` and `sections` name entries of this export; `issue`
 * is the GitHub issue that tracks the gap when nothing is measured. All empty with `applicable`
 * true means not measured and not yet tracked.
 */
export type CoverageSource = {
  readonly lanes?: readonly LaneId[];
  readonly sections?: readonly SectionId[];
  readonly issue?: number;
  readonly applicable?: false;
};

export type CoverageCategory = {
  readonly id: string;
  readonly title: string;
  readonly cells: Readonly<Record<CoveragePlatformId, CoverageSource>>;
};

/**
 * Category x platform, from `docs/plans/bench-coverage-2026-11.md` (the coverage table and the
 * catalog's issue column). Where the catalog names no platform-specific issue for an Apple cell,
 * the cell points at the plan's general Apple entries: #452 for iOS web, #453 for iOS native.
 */
export const COVERAGE: readonly CoverageCategory[] = [
  {
    id: 'engine-cpu',
    title: 'Engine CPU cost (per system)',
    cells: {
      desktopWeb: { lanes: ['node-jsc'] },
      androidWeb: { issue: 440 },
      iosWeb: { issue: 452 },
      androidNative: { issue: 440 },
      iosNative: { issue: 440 },
    },
  },
  {
    id: 'render-submission',
    title: 'Render submission cost',
    cells: {
      desktopWeb: { lanes: ['web-cpu-raster', 'web-gpu'] },
      androidWeb: { lanes: ['web-android-gpu'] },
      iosWeb: { issue: 452 },
      androidNative: { issue: 162 },
      iosNative: { issue: 453 },
    },
  },
  {
    id: 'frame-capacity',
    title: 'Frame capacity and frame-time distribution',
    cells: {
      desktopWeb: { issue: 438 },
      androidWeb: { issue: 438 },
      iosWeb: { issue: 452 },
      androidNative: { lanes: ['device-native'], issue: 162 },
      iosNative: { issue: 453 },
    },
  },
  {
    id: 'startup-size',
    title: 'Startup and size',
    cells: {
      desktopWeb: { sections: ['payload', 'coldStart'], issue: 443 },
      androidWeb: { issue: 443 },
      iosWeb: { issue: 452 },
      androidNative: { issue: 443 },
      iosNative: { issue: 453 },
    },
  },
  {
    id: 'memory-gc',
    title: 'Memory and GC',
    cells: {
      desktopWeb: { sections: ['heap', 'counters'], issue: 444 },
      androidWeb: { issue: 444 },
      iosWeb: { issue: 452 },
      androidNative: { issue: 444 },
      iosNative: { issue: 453 },
    },
  },
  {
    id: 'idle-background',
    title: 'Idle and background cost',
    cells: {
      desktopWeb: { issue: 445 },
      androidWeb: { issue: 445 },
      iosWeb: { issue: 452 },
      androidNative: { issue: 445 },
      iosNative: { issue: 453 },
    },
  },
  {
    id: 'energy',
    title: 'Energy',
    cells: {
      desktopWeb: { applicable: false },
      androidWeb: { issue: 448 },
      iosWeb: {},
      androidNative: { issue: 448 },
      iosNative: {},
    },
  },
];
