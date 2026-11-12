/**
 * The frozen scenario surface of the microbench suite.
 *
 * `index.ts` runs the suites as a module side effect, so nothing that needs
 * these names may import it. Both the markdown generator and the smoke gate
 * read them from here instead, which makes a renamed or dropped scenario a
 * test failure rather than a silently missing row in the published doc.
 *
 * Renaming a scenario is a deliberate act: update the suite and this file in
 * the same change, and re-capture the baseline.
 */

export const HEADLINE_PREFIXES = {
  ecs: 'ecs.step  1000',
  particles: 'particles.update  1000 integrate',
  render: 'render.flush   1000 sprites / 1 atlas',
  integration: 'integration.frame  1000',
} as const;

/** The row `bench:promote` checks against {@link FAST_MODE_ANCHOR_NS}: the `ecs` headline. */
export const FAST_MODE_ANCHOR_SCENARIO = 'ecs.step  1000 entities (Pos+Vel)';

/**
 * The fast-mode anchor for {@link FAST_MODE_ANCHOR_SCENARIO}, in nanoseconds. `bench:promote`
 * refuses a window in which any run's median for that row exceeds this times
 * {@link FAST_MODE_ANCHOR_TOLERANCE}.
 *
 * Why (PERF-14b, #160): the reference machine (i9-13900KF, High performance, pinned) runs bimodal.
 * After about eight back-to-back captures this row steps from 8.9-9.8 µs to 16.4-16.5 µs, with
 * `render.flush` and `integration.frame` moving with it. The deviation guard only sees runs that
 * disagree with each other, so five runs wholly inside the slow mode agree and would publish.
 *
 * The value is the published fold: `medianNs` 9455.42 at `0b7ea242ae53` (#258, band 9.30-9.79 µs),
 * rounded. It describes that machine; a capture from a slower one trips it as well.
 *
 * **Re-anchoring is deliberate.** A genuine ECS change that moves this row past the ceiling trips
 * the check too; that refusal is the prompt to re-anchor, never to raise the constant until a
 * window passes. Re-anchor in the same PR as the change that moved the row:
 *
 * 1. Capture the five `bench:pinned` runs; the refusal lists each run's median for this row.
 * 2. Confirm the five agree with each other (the deviation guard passed), then set this constant
 *    to their fold value and add a dated line to the history below with the reason.
 * 3. Commit, then capture the five again and promote. `benchmarks/src` is a freshness path, so
 *    runs captured before the anchor commit are stale.
 *
 * A speedup is not refused, but it leaves the anchor stale and the slow mode possibly under the
 * ceiling, so re-anchor for one too.
 *
 * History:
 * - 2026-11-12: 9455, from the `0b7ea242ae53` fold (#258). First anchor.
 */
export const FAST_MODE_ANCHOR_NS = 9455;

/**
 * How far above {@link FAST_MODE_ANCHOR_NS} a run's median may sit before the window is refused.
 *
 * ×1.3 puts the ceiling at ~12.29 µs, about midway (by ratio) between the two modes: the fast mode
 * tops out around 9.8 µs (~1.04× the anchor) and the slow mode sits at 16.4-16.5 µs (~1.7×). That
 * leaves ~25% of headroom on each side, so ordinary noise inside the fast mode never trips it and
 * the slow mode never fits under it. A run exactly at the ceiling is accepted.
 */
export const FAST_MODE_ANCHOR_TOLERANCE = 1.3;

export const EXPECTED_SUITE_TITLES = [
  'ECS',
  'Physics',
  'Particles',
  'Render',
  'Integration',
  'Animation',
  'PostFx',
  'Tilemap',
  'Pathfinding',
  'Math',
  'RenderSystem',
] as const;

/**
 * The suites added by #159 and #96, absent from the committed baseline until the
 * 0.4.12 recapture, whose PR empties this list. `tests/baseline.test.ts` tolerates a
 * `missing suite` violation only for a title listed here, and fails once a
 * listed title IS in the committed baseline, so an entry cannot outlive the
 * capture that made it unnecessary. A fresh capture is never exempt:
 * `promote.ts` still demands every suite.
 */
export const PENDING_FIRST_CAPTURE: readonly string[] = [
  'Animation',
  'PostFx',
  'Tilemap',
  'Pathfinding',
  'Math',
  'RenderSystem',
];

export const EXPECTED_SCENARIOS: Readonly<Record<string, readonly string[]>> = {
  ECS: [
    'ecs.step   500 entities (Pos+Vel)',
    'ecs.step  1000 entities (Pos+Vel)',
    'ecs.step  2000 entities (Pos+Vel)',
    'ecs.step  5000 entities (Pos+Vel)',
    'ecs.churn  500 entities, 5%/step',
    'ecs.churn 1000 entities, 5%/step',
    'ecs.churn 2000 entities, 5%/step',
    'ecs.churn 5000 entities, 5%/step',
  ],
  Physics: [
    'physics.step   100 AABB sparse',
    'physics.step   100 AABB dense ',
    'physics.step   500 AABB sparse',
    'physics.step   500 AABB dense ',
    'physics.step  1000 AABB sparse',
    'physics.step  1000 AABB dense ',
  ],
  Particles: [
    'particles.update   500 integrate-only',
    'particles.update  1000 integrate-only',
    'particles.update  2000 integrate-only',
    'particles.update  5000 integrate-only',
    'particles.update   500 emit+integrate',
    'particles.update  1000 emit+integrate',
    'particles.update  2000 emit+integrate',
  ],
  Render: [
    'render.flush    100 sprites / 1 atlas',
    'render.flush    500 sprites / 1 atlas',
    'render.flush   1000 sprites / 1 atlas',
    'render.flush   5000 sprites / 1 atlas',
    'render.flush    500 sprites / 4 atlas interleaved',
    'render.flush    500 sprites / 4 atlas clustered',
    'render.flush   1000 sprites / 8 atlas interleaved',
    'render.flush   1000 sprites / 8 atlas clustered',
    'render.flush   1000 sprites / 50% rotated',
    'render.flush   1000 sprites / 100% rotated',
    'render.flush   1000 sprites / 4 alpha runs',
    'render.flush   1000 sprites / tint effect',
    'render.flush   1000 sprites / outline effect',
    'render.flush   1000 sprites / stretch path',
    'render.flush   1000 sprites / zone-bg path',
    'render.sort     500 items (0 swaps)',
    'render.sort     500 items (5 swaps)',
    'render.sort    1000 items (10 swaps)',
  ],
  Integration: [
    'integration.frame   500 entities + 300p',
    'integration.frame  1000 entities + 300p',
    'integration.frame  2000 entities + 300p',
  ],
  Animation: [
    'animation.updateTweens    1000 tweens, 4 easings',
    'animation.updateSpring    1000 springs, underdamped',
    'animation.updateAnimator  1000 animators, looping',
  ],
  PostFx: [
    'postfx.update       5 live: flash + 4 timed',
    'postfx.enabled      8 effects, 5 enabled',
    'postfx.buildPass    8 effects, 5 enabled',
  ],
  Tilemap: [
    'tilemap.drawInto   256x256 x2 layers, 800x600 view',
    'tilemap.getTileAt  256x256 full-layer scan',
    'tilemap.decodeGid     4096 gids, flags + strip',
  ],
  Pathfinding: [
    'pathfinding.astar  128x128 open',
    'pathfinding.astar  128x128 maze',
    'pathfinding.jps    128x128 open',
    'pathfinding.jps    128x128 maze',
  ],
  Math: [
    'math.vec2         1000 x 6 out-param ops',
    'math.transform2d  1000 points, local->world->local',
    'math.mat3         1000 fromTransform x parent',
  ],
  RenderSystem: ['render.system  1000 sprites / 3 z layers interleaved'],
};

export const EXPECTED_HEAP_SCENARIOS: readonly string[] = [
  'integration.heap   500 entities',
  'integration.heap  1000 entities',
  'integration.heap  2000 entities',
];

/**
 * Exact-counter rows. Unlike the timing scenarios these have no run-to-run
 * variance at all: every number is an integer the draw path must reproduce
 * exactly, so a missing row is a silently dropped guarantee rather than a
 * missing measurement.
 */
export const EXPECTED_ALLOC_SCENARIOS: readonly string[] = [
  'alloc.render  1000 sprites / 1 atlas',
  'alloc.render  1000 sprites / 100% rotated',
  'alloc.render  1000 sprites / 8 atlas interleaved',
  'alloc.render  1000 sprites / 8 atlas clustered',
  'alloc.render  1000 sprites / 4 alpha runs',
  'alloc.render  1000 sprites / tint effect',
  'alloc.render  1000 sprites / outline effect',
  'alloc.render  1000 sprites / stretch path',
  'alloc.render  1000 sprites / zone-bg path',
  'alloc.frame    500 entities + 300p',
  'alloc.frame   1000 entities + 300p',
];

type SuiteShape = {
  readonly title: string;
  readonly results: readonly { readonly scenario: string }[];
};

/**
 * Reconciles a set of suites against the frozen contract. Used on both sides of
 * the pipeline: the smoke gate checks the live suites, and `--markdown` checks
 * the stored baseline before publishing it — a baseline captured before a rename
 * would otherwise publish a doc with a headline row silently missing.
 */
export function findContractViolations(suites: readonly SuiteShape[]): string[] {
  const problems: string[] = [];
  const titles = suites.map((s) => s.title);
  const expectedTitles = EXPECTED_SUITE_TITLES as readonly string[];

  for (const expected of expectedTitles) {
    if (!titles.includes(expected)) problems.push(`missing suite: ${expected}`);
  }
  for (const actual of titles) {
    if (!expectedTitles.includes(actual)) problems.push(`unexpected suite: ${actual}`);
  }

  const names = suites.flatMap((s) => s.results.map((r) => r.scenario));
  for (const expected of Object.values(EXPECTED_SCENARIOS).flat()) {
    if (!names.includes(expected)) problems.push(`missing scenario: ${expected}`);
  }
  const allExpected = new Set(Object.values(EXPECTED_SCENARIOS).flat());
  for (const actual of names) {
    if (!allExpected.has(actual)) problems.push(`unexpected scenario: ${actual}`);
  }

  for (const prefix of Object.values(HEADLINE_PREFIXES)) {
    const hits = names.filter((n) => n.startsWith(prefix)).length;
    if (hits !== 1) {
      problems.push(`headline prefix "${prefix}" matches ${hits} scenarios, expected exactly 1`);
    }
  }

  return problems;
}

/**
 * Same fail-closed reconciliation for the exact-counter section. Kept separate
 * from the suite check because an old baseline legitimately carries no alloc
 * rows at all, and that has to read as one missing section rather than as
 * eleven missing scenarios.
 */
export function findAllocViolations(rows: readonly { readonly scenario: string }[]): string[] {
  const problems: string[] = [];
  const names = rows.map((r) => r.scenario);
  for (const expected of EXPECTED_ALLOC_SCENARIOS) {
    if (!names.includes(expected)) problems.push(`missing alloc scenario: ${expected}`);
  }
  const allExpected = new Set(EXPECTED_ALLOC_SCENARIOS);
  for (const actual of names) {
    if (!allExpected.has(actual)) problems.push(`unexpected alloc scenario: ${actual}`);
  }
  return problems;
}
