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

export const EXPECTED_SUITE_TITLES = [
  'ECS',
  'Physics',
  'Particles',
  'Render',
  'Integration',
] as const;

export const EXPECTED_SCENARIOS: Readonly<Record<string, readonly string[]>> = {
  ECS: [
    'ecs.step   500 entities (Pos+Vel)',
    'ecs.step  1000 entities (Pos+Vel)',
    'ecs.step  2000 entities (Pos+Vel)',
    'ecs.step  5000 entities (Pos+Vel)',
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
