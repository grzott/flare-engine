/**
 * Shared Playwright launch configuration. Read by `scripts/run.ts` (Bun) and passed through as
 * plain JSON to `scripts/browser-driver.mjs` (Node), which is the process that actually calls
 * `chromium.launch()` — see that file's header for why launching happens there and not here.
 *
 * Not read by the `playwright test` CLI runner: this app drives Playwright directly (plain
 * `chromium.launch()`), not through `@playwright/test`, so there is no test-runner dependency to
 * add on top of `playwright`. This file is the single place the launch/timeout knobs live.
 *
 * `--disable-gpu` is deliberate, not a bug to "fix" away. It forces Chromium onto SwiftShader
 * software rasterization instead of a host GPU, trading roughly 50-60s per scenario (~15 minutes
 * for the full 18-scenario suite) for a baseline with zero GPU-driver/compositor variance — CI
 * runners have no GPU either, so this is the reproducible number, not a real-world frame-cost
 * number. Every result this produces is labelled `runtime: 'web-swiftshader'` in the output record
 * (see scripts/run.ts), never a bare `'web'`, precisely so it can't be conflated with GPU-backed
 * numbers from the future real-browser device matrix — the two lanes are complementary, not
 * redundant. Removing this flag silently changes what is being measured; don't.
 */
export type BenchPlaywrightConfig = {
  readonly headless: boolean;
  /** Chromium flags that disable the background/occlusion timer throttling headless runs are
   *  otherwise subject to — left on, it corrupts rAF-delta timing (see src/runner.ts). */
  readonly launchArgs: readonly string[];
  readonly waitTimeoutMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
};

const config: BenchPlaywrightConfig = {
  headless: true,
  launchArgs: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
    '--disable-gpu',
  ],
  // Measured: the full 18-scenario suite takes ~15-18 minutes end to end under CPU-raster
  // SwiftShader (each scenario needs >=P99_MIN_SAMPLES rAF-paced samples, and real CanvasKit
  // software-raster work costs far more per call than the Node counting-stub bench it mirrors —
  // a 5-minute budget timed out mid-suite at scenario ~14/18). 30 minutes leaves real headroom.
  waitTimeoutMs: 30 * 60 * 1000,
  viewport: { width: 800, height: 600 },
};

export default config;
