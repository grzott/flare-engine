import { beforeEach, describe, expect, it } from 'bun:test';
import { _resetComponentIds, defineComponent } from '../src/component.js';
import { defineSystem } from '../src/system.js';
import { World } from '../src/world.js';

beforeEach(() => {
  _resetComponentIds();
});

describe('defineSystem', () => {
  it('creates a system that processes matching entities', () => {
    const Pos = defineComponent('Position', () => ({ x: 0, y: 0 }));
    const Vel = defineComponent('Velocity', () => ({ vx: 1, vy: 2 }));
    const world = new World();

    const e1 = world.spawn();
    world.add(e1, Pos, { x: 0, y: 0 });
    world.add(e1, Vel, { vx: 10, vy: 20 });

    const e2 = world.spawn();
    world.add(e2, Pos, { x: 0, y: 0 }); // No velocity

    const q = world.query(Pos, Vel);
    const moveSys = defineSystem(q, (entities, dt, w) => {
      for (const id of entities) {
        const pos = w.get(id, Pos)!;
        const vel = w.get(id, Vel)!;
        pos.x += vel.vx * dt;
        pos.y += vel.vy * dt;
      }
    });

    world.addSystem(moveSys._worldFn);
    world.step(1);

    expect(world.get(e1, Pos)).toEqual({ x: 10, y: 20 });
    expect(world.get(e2, Pos)).toEqual({ x: 0, y: 0 }); // Unaffected
  });

  it('system receives correct dt', () => {
    const Tag = defineComponent('Tag');
    const world = new World();
    const q = world.query(Tag);
    let receivedDt = 0;
    const sys = defineSystem(q, (_entities, dt) => {
      receivedDt = dt;
    });
    world.addSystem(sys._worldFn);
    world.step(0.016);
    expect(receivedDt).toBeCloseTo(0.016);
  });

  it('system can be removed via _worldFn', () => {
    const Tag = defineComponent('Tag');
    const world = new World();
    const q = world.query(Tag);
    let count = 0;
    const sys = defineSystem(q, () => {
      count++;
    });
    world.addSystem(sys._worldFn);
    world.step(0);
    expect(count).toBe(1);
    world.removeSystem(sys._worldFn);
    world.step(0);
    expect(count).toBe(1);
  });
});
