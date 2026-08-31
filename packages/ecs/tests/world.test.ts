import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';
import { World } from '../src/world.js';

// Components are defined once at module scope.  Each test creates a fresh
// World, so there is no cross-test state even though the ComponentDefs are shared.
const Position = defineComponent('Position', () => ({ x: 0, y: 0 }));
const Velocity = defineComponent('Velocity', () => ({ vx: 0, vy: 0 }));
const Dead = defineComponent('Dead');

describe('World.spawn/destroy', () => {
  it('creates entities with sequential IDs', () => {
    const world = new World();
    expect(world.spawn()).toBe(1);
    expect(world.spawn()).toBe(2);
    expect(world.spawn()).toBe(3);
  });

  it('destroys entities', () => {
    const world = new World();
    const e = world.spawn();
    expect(world.exists(e)).toBe(true);
    world.destroy(e);
    expect(world.exists(e)).toBe(false);
  });

  it('destroy non-existent is no-op', () => {
    const world = new World();
    world.destroy(999); // Should not throw
  });
});

describe('World.add/get/has/remove', () => {
  it('adds and gets component data', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 10, y: 20 });
    expect(world.get(e, Position)).toEqual({ x: 10, y: 20 });
  });

  it('uses defaults when no data provided', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    expect(world.get(e, Position)).toEqual({ x: 0, y: 0 });
  });

  it('has returns true for existing components', () => {
    const world = new World();
    const e = world.spawn();
    expect(world.has(e, Position)).toBe(false);
    world.add(e, Position);
    expect(world.has(e, Position)).toBe(true);
  });

  it('removes component', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    world.remove(e, Position);
    expect(world.has(e, Position)).toBe(false);
    expect(world.get(e, Position)).toBeUndefined();
  });

  it('get returns undefined for missing component', () => {
    const world = new World();
    const e = world.spawn();
    expect(world.get(e, Position)).toBeUndefined();
  });

  it('add to non-existent entity is no-op', () => {
    const world = new World();
    world.add(999, Position); // Should not throw
  });
});

describe('World.query', () => {
  it('matches entities with required components', () => {
    const world = new World();
    const e1 = world.spawn();
    const e2 = world.spawn();
    const e3 = world.spawn();
    world.add(e1, Position);
    world.add(e1, Velocity);
    world.add(e2, Position); // Missing Vel
    world.add(e3, Position);
    world.add(e3, Velocity);

    const q = world.query(Position, Velocity);
    const ids = [...q];
    expect(ids).toContain(e1);
    expect(ids).toContain(e3);
    expect(ids).not.toContain(e2);
    expect(q.count).toBe(2);
  });

  it('updates when components added', () => {
    const world = new World();
    const e = world.spawn();
    const q = world.query(Position);
    expect(q.count).toBe(0);
    world.add(e, Position);
    expect(q.count).toBe(1);
  });

  it('updates when components removed', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    const q = world.query(Position);
    expect(q.count).toBe(1);
    world.remove(e, Position);
    expect(q.count).toBe(0);
  });

  it('updates when entity destroyed', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    const q = world.query(Position);
    expect(q.count).toBe(1);
    world.destroy(e);
    expect(q.count).toBe(0);
  });

  it('fires onEntityAdded/onEntityRemoved', () => {
    const world = new World();
    const q = world.query(Position);
    const added: number[] = [];
    const removed: number[] = [];
    q.onEntityAdded.add((id) => {
      added.push(id);
    });
    q.onEntityRemoved.add((id) => {
      removed.push(id);
    });

    const e = world.spawn();
    world.add(e, Position);
    expect(added).toEqual([e]);

    world.remove(e, Position);
    expect(removed).toEqual([e]);
  });

  it('populates from existing entities', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    // Query created AFTER entity
    const q = world.query(Position);
    expect(q.count).toBe(1);
  });
});

describe('World.queryBuilder', () => {
  it('with/without chaining', () => {
    const world = new World();

    const alive = world.spawn();
    world.add(alive, Position);

    const dead = world.spawn();
    world.add(dead, Position);
    world.add(dead, Dead);

    const q = world.queryBuilder().with(Position).without(Dead).build();
    expect(q.count).toBe(1);
    expect(q.has(alive)).toBe(true);
    expect(q.has(dead)).toBe(false);
  });
});

describe('World.removeQuery', () => {
  it('stops a removed query from updating', () => {
    const world = new World();
    const q = world.query(Position);
    const e1 = world.spawn();
    world.add(e1, Position);
    expect(q.count).toBe(1);

    world.removeQuery(q);

    // A matching entity added AFTER removal must not update the query...
    const e2 = world.spawn();
    world.add(e2, Position);
    expect(q.count).toBe(1);
    // ...and destroying a tracked entity no longer touches it either.
    world.destroy(e1);
    expect(q.count).toBe(1);
  });

  it('removes a queryBuilder-created query too', () => {
    const world = new World();
    const q = world.queryBuilder().with(Position).without(Dead).build();
    const e = world.spawn();
    world.add(e, Position);
    expect(q.count).toBe(1);

    world.removeQuery(q);
    const e2 = world.spawn();
    world.add(e2, Position);
    expect(q.count).toBe(1);
  });

  it('is a no-op for a query not registered on this world', () => {
    const world = new World();
    const other = new World();
    world.removeQuery(other.query(Position)); // should not throw
  });

  it('is safe when a query removes itself from inside a signal handler', () => {
    const world = new World();
    const qA = world.query(Position); // registered first
    const qB = world.query(Position); // both match Position
    qA.onEntityAdded.add(() => world.removeQuery(qA)); // one-shot self-dispose

    const e = world.spawn();
    world.add(e, Position);
    // qB must still update despite qA splicing itself mid-iteration — the removal
    // is deferred until the add() notify-loop unwinds.
    expect(qB.count).toBe(1);
    expect(qB.has(e)).toBe(true);

    // qA disposed itself; a later matching entity updates qB but not qA.
    const e2 = world.spawn();
    world.add(e2, Position);
    expect(qA.count).toBe(1);
    expect(qB.count).toBe(2);
  });
});

describe('World.forEachEntity', () => {
  it('visits every live entity across archetype moves and destroys', () => {
    const world = new World();
    const e1 = world.spawn();
    const e2 = world.spawn();
    const e3 = world.spawn();
    world.add(e1, Position); // archetype move — entity key unchanged
    world.add(e2, Position);
    world.add(e2, Velocity);
    world.remove(e2, Position); // another archetype move
    world.destroy(e3);

    const seen: number[] = [];
    world.forEachEntity((id) => seen.push(id));
    expect(seen.sort((a, b) => a - b)).toEqual([e1, e2]);
  });

  it('visits nothing for an empty world', () => {
    const world = new World();
    const seen: number[] = [];
    world.forEachEntity((id) => seen.push(id));
    expect(seen).toEqual([]);
  });
});

describe('World.entityCount', () => {
  it('tracks the live entity count', () => {
    const world = new World();
    expect(world.entityCount).toBe(0);
    const e1 = world.spawn();
    world.spawn();
    expect(world.entityCount).toBe(2);
    world.destroy(e1);
    expect(world.entityCount).toBe(1);
  });
});

describe('World.addSystem/step', () => {
  it('runs systems on step', () => {
    const world = new World();
    const log: string[] = [];
    world.addSystem(() => {
      log.push('a');
    });
    world.step(1 / 60);
    expect(log).toEqual(['a']);
  });

  it('runs systems in priority order', () => {
    const world = new World();
    const log: string[] = [];
    world.addSystem(() => {
      log.push('b');
    }, 10);
    world.addSystem(() => {
      log.push('a');
    }, 1);
    world.addSystem(() => {
      log.push('c');
    }, 20);
    world.step(1 / 60);
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('passes world and dt to systems', () => {
    const world = new World();
    let receivedDt = 0;
    let receivedWorld: World | null = null;
    world.addSystem((w, dt) => {
      receivedWorld = w;
      receivedDt = dt;
    });
    world.step(0.016);
    expect(receivedWorld === world).toBe(true);
    expect(receivedDt).toBeCloseTo(0.016);
  });

  it('removeSystem works', () => {
    const world = new World();
    let count = 0;
    const sys = () => {
      count++;
    };
    world.addSystem(sys);
    world.step(0);
    expect(count).toBe(1);
    world.removeSystem(sys);
    world.step(0);
    expect(count).toBe(1);
  });
});

describe('component data mutation', () => {
  it('allows direct mutation of component data', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 0, y: 0 });
    const data = world.get(e, Position)!;
    data.x = 42;
    expect(world.get(e, Position)!.x).toBe(42);
  });
});
