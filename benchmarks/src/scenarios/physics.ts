/**
 * Pure-data physics scenario matrix — no CollisionWorld, no closure. Consumed
 * by `../physics.bench.ts`, which binds each row to a real `CollisionWorld`.
 */
export type PhysicsDensity = 'sparse' | 'dense';

export type PhysicsScenario = {
  readonly name: string;
  readonly n: number;
  readonly density: PhysicsDensity;
  readonly innerIters: number;
};

const SWEEP: readonly {
  readonly n: number;
  readonly density: PhysicsDensity;
  readonly innerIters: number;
}[] = [
  { n: 100, density: 'sparse', innerIters: 28 },
  { n: 100, density: 'dense', innerIters: 18 },
  { n: 500, density: 'sparse', innerIters: 1 },
  { n: 500, density: 'dense', innerIters: 1 },
  { n: 1000, density: 'sparse', innerIters: 1 },
  { n: 1000, density: 'dense', innerIters: 1 },
];

export const PHYSICS_SCENARIOS: readonly PhysicsScenario[] = SWEEP.map(
  ({ n, density, innerIters }) => ({
    name: `physics.step  ${n.toString().padStart(4)} AABB ${density === 'sparse' ? 'sparse' : 'dense '}`,
    n,
    density,
    innerIters,
  }),
);

/**
 * The bullet-curtain workload (#579): a dense field of enemy-layer bodies that
 * never collide with each other, a volley of player shots and one ship. The
 * enemy bodies collide with both player layers; the two player layers do not
 * collide with each other. Bodies move a few pixels per frame, so most moves
 * stay inside the cells they already occupy.
 *
 * `move` times the `setPosition` pass alone, `step` times `world.step()` alone
 * on a frozen frame, and `frame` times both — one game frame.
 */
export type PhysicsCurtainPass = 'move' | 'step' | 'frame';

export type PhysicsCurtainScenario = {
  readonly name: string;
  readonly pass: PhysicsCurtainPass;
  readonly bolts: number;
  readonly shots: number;
  readonly innerIters: number;
};

const CURTAIN_BOLTS = 2000;
const CURTAIN_SHOTS = 100;

const CURTAIN_PASSES: readonly {
  readonly pass: PhysicsCurtainPass;
  readonly label: string;
  readonly innerIters: number;
}[] = [
  { pass: 'move', label: 'setPosition', innerIters: 8 },
  { pass: 'step', label: 'step       ', innerIters: 8 },
  { pass: 'frame', label: 'frame      ', innerIters: 4 },
];

export const PHYSICS_CURTAIN_SCENARIOS: readonly PhysicsCurtainScenario[] = CURTAIN_PASSES.map(
  ({ pass, label, innerIters }) => ({
    name: `physics.curtain  ${label}  ${CURTAIN_BOLTS} bolts + ${CURTAIN_SHOTS} shots + 1 ship`,
    pass,
    bolts: CURTAIN_BOLTS,
    shots: CURTAIN_SHOTS,
    innerIters,
  }),
);
