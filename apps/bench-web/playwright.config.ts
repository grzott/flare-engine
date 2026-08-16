/**
 * Shared Playwright launch configuration. Read by `scripts/run.ts` (Bun) and passed through as
 * plain JSON to `scripts/browser-driver.mjs` (Node), which is the process that actually calls
 * `chromium.launch()` — see that file's header for why launching happens there and not here.
 *
 * Not read by the `playwright test` CLI runner: this app drives Playwright directly (plain
 * `chromium.launch()`), not through `@playwright/test`, so there is no test-runner dependency to
 * add on top of `playwright`. This file is the single place the launch/timeout knobs live.
 *
 * Two render modes, two launch-arg sets — see `launchArgsForMode`:
 *
 *  - `cpu-raster` (default): `--disable-gpu` forces Chromium onto SwiftShader software
 *    rasterization instead of a host GPU, trading roughly 50-60s per scenario (~15 minutes for
 *    the full 18-scenario suite) for a baseline with zero GPU-driver/compositor variance — CI
 *    runners have no GPU either, so this is the reproducible number, not a real-world frame-cost
 *    number. Note this flag is defence-in-depth, not the thing that makes this lane CPU-only:
 *    `src/runner.ts`'s render target is `CanvasKit.MakeSurface`, an offscreen CPU-backed surface
 *    per CanvasKit's own type definitions — it never touches a `<canvas>`/WebGL surface, so the
 *    render path is CPU-raster by construction whether or not this flag is present. Every result
 *    is labelled `runtime: 'web-cpu-raster'` (see `scripts/run.ts`), never a bare `'web'`.
 *
 *  - `gpu`: must NOT pass `--disable-gpu` — that is exactly the flag that would silently defeat
 *    this mode. Verified empirically on this dev machine (headless Chromium 151, Windows, NVIDIA
 *    GPU): with no GPU-related flags at all, headless Chromium's WebGL still reports
 *    `ANGLE (Google, Vulkan ... SwiftShader Device ..., SwiftShader driver)` for
 *    `UNMASKED_RENDERER_WEBGL` — i.e. it silently falls back to software even without
 *    `--disable-gpu`. Passing `--use-angle=d3d11` pins ANGLE to the D3D11 backend and reports the
 *    real GPU (`ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti ... Direct3D11 ..., D3D11)`), confirmed
 *    via `WEBGL_debug_renderer_info`. `--enable-unsafe-swiftshader` (the flag that forces
 *    SwiftShader back on) must never appear alongside this mode. `src/runner.ts` verifies the
 *    renderer string at capture time rather than assuming the flag worked.
 *
 * Both modes share the timer/rAF-throttling flags below, which disable the background/occlusion
 * throttling headless Chromium applies to windows it treats as backgrounded — left on, it
 * corrupts rAF-delta timing (see src/runner.ts) — independent of which rasterizer is in play.
 */
export type BenchMode = 'cpu-raster' | 'gpu';

export type BenchPlaywrightConfig = {
  readonly headless: boolean;
  /** Chromium flags that disable the background/occlusion timer throttling headless runs are
   *  otherwise subject to — left on, it corrupts rAF-delta timing (see src/runner.ts). */
  readonly launchArgs: readonly string[];
  readonly waitTimeoutMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
};

const THROTTLE_DEFEAT_ARGS: readonly string[] = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion',
];

const CPU_RASTER_LAUNCH_ARGS: readonly string[] = [...THROTTLE_DEFEAT_ARGS, '--disable-gpu'];

const GPU_LAUNCH_ARGS: readonly string[] = [...THROTTLE_DEFEAT_ARGS, '--use-angle=d3d11'];

/** The launch args for a given render mode — see this file's header for why they differ. */
export function launchArgsForMode(mode: BenchMode): readonly string[] {
  return mode === 'gpu' ? GPU_LAUNCH_ARGS : CPU_RASTER_LAUNCH_ARGS;
}

const config: BenchPlaywrightConfig = {
  headless: true,
  launchArgs: CPU_RASTER_LAUNCH_ARGS,
  // Measured: the full 18-scenario suite takes ~15-18 minutes end to end under CPU-raster
  // (each scenario needs >=P99_MIN_SAMPLES rAF-paced samples, and real CanvasKit software-raster
  // work costs far more per call than the Node counting-stub bench it mirrors — a 5-minute budget
  // timed out mid-suite at scenario ~14/18). 30 minutes leaves real headroom. GPU mode reuses the
  // same ceiling as a safety net even though it is expected to finish far sooner.
  waitTimeoutMs: 30 * 60 * 1000,
  viewport: { width: 800, height: 600 },
};

export default config;
