import { describe, expect, it } from 'bun:test';
import { createBody } from '../src/body.js';
import { addBody, createWorld, step, type World } from '../src/world.js';

const DT = 1 / 120;

function floorWorld(): World {
  const world = createWorld({ gravity: { x: 0, y: 1800 } });
  addBody(world, createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }));
  return world;
}

function settle(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) step(world, DT);
}

describe('step', () => {
  it('is inert for a non-positive dt', () => {
    const world = floorWorld();
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    step(world, 0);
    step(world, -1);
    expect(b.position.y).toBe(0);
    expect(b.velocity.y).toBe(0);
  });

  it('accelerates a free body under gravity', () => {
    const world = createWorld({ gravity: { x: 0, y: 1800 } });
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    step(world, DT);
    expect(b.velocity.y).toBeCloseTo(1800 * DT, 12);
    expect(b.position.y).toBeCloseTo(1800 * DT * DT, 12);
  });

  it('never moves a static body', () => {
    const world = floorWorld();
    const floor = world.bodies[0]!;
    addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    settle(world, 600);
    expect(floor.position.y).toBe(100);
    expect(floor.angle).toBe(0);
  });

  it('stops a falling box on the floor and holds it there', () => {
    const world = floorWorld();
    const b = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    settle(world, 600);
    const settled = b.position.y;

    // Floor top is y=90; a half-height-5 box rests centered near y=85.
    expect(settled).toBeLessThan(96);
    expect(settled).toBeGreaterThan(78);

    // It has STOPPED, not merely passed through: 600 further steps move it less
    // than a tenth of a unit. This is what catches a solver that lets a box sink
    // or creep along the floor.
    settle(world, 600);
    expect(Math.abs(b.position.y - settled)).toBeLessThan(0.1);

    // The residual contact jitter is BOUNDED, not decaying to zero. A sequential-
    // impulse solver with Baumgarte bias and no sleeping sustains a small limit
    // cycle at the penetration-slop equilibrium. This asserts it does not grow —
    // energy injection would blow past this bound. See the note in world.ts.
    expect(Math.abs(b.velocity.y)).toBeLessThan(5);
  });

  it('does not let a stack sink through the floor', () => {
    const world = floorWorld();
    const boxes = [];
    for (let i = 0; i < 5; i++) {
      boxes.push(
        addBody(world, createBody({ position: { x: 0, y: -i * 12 }, half: { x: 5, y: 5 } })),
      );
    }
    settle(world, 1200);
    for (const b of boxes) expect(b.position.y).toBeLessThan(96);
  });

  it('does not gain energy over a long run', () => {
    const world = floorWorld();
    const b = addBody(
      world,
      createBody({
        position: { x: 0, y: 0 },
        half: { x: 5, y: 5 },
        velocity: { x: 40, y: 0 },
        angularVelocity: 3,
      }),
    );
    settle(world, 60);
    const peak = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
    settle(world, 2400);
    const final = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
    expect(final).toBeLessThan(peak);
  });

  it('steps a structurally copied world without crashing', () => {
    const world = createWorld({ gravity: { x: 0, y: 1800 } });
    addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));
    const copy = { ...world };
    expect(() => step(copy, 1 / 60)).not.toThrow();
  });

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const world = floorWorld();
      const bodies = [];
      for (let i = 0; i < 8; i++) {
        bodies.push(
          addBody(
            world,
            createBody({
              position: { x: i * 3 - 12, y: -i * 11 },
              half: { x: 5, y: 5 },
              angle: i * 0.37,
              angularVelocity: i * 0.11,
            }),
          ),
        );
      }
      settle(world, 900);
      return bodies.flatMap((b) => [b.position.x, b.position.y, b.angle]);
    };
    expect(run()).toEqual(run());
  });
});
