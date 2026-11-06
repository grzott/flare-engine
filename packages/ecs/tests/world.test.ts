import { describe, expect, it } from 'bun:test';
import { type ComponentDef, defineComponent } from '../src/component.js';
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

// Hand-built definitions stand in for a second loaded copy of this module: its
// counter also starts at 0, so its definitions carry the same `id` / `bit` as
// ours. Literals keep the module-global counter untouched, so this file never
// needs _resetComponentIds and cannot push a later file past the 32 cap.
const literalDef = <T>(name: string, id: number, create: () => T): ComponentDef<T> => ({
  id,
  bit: 1 << id,
  name,
  create,
});

describe('World component registry (keyed by ComponentDef identity)', () => {
  it('stores and queries two definitions with equal id and bit independently', () => {
    const A = literalDef('A', 0, () => ({ a: 1 }));
    const B = literalDef('B', 0, () => ({ b: 2 }));
    expect(A.id).toBe(B.id);
    expect(A.bit).toBe(B.bit);

    const world = new World();
    const e1 = world.spawn();
    const e2 = world.spawn();
    world.add(e1, A);
    world.add(e2, B);

    expect(world.has(e1, A)).toBe(true);
    expect(world.has(e1, B)).toBe(false);
    expect(world.has(e2, B)).toBe(true);
    expect(world.has(e2, A)).toBe(false);
    expect(world.get(e1, A)).toEqual({ a: 1 });
    expect(world.get(e1, B)).toBeUndefined();
    expect(world.get(e2, B)).toEqual({ b: 2 });

    const qA = world.query(A);
    const qB = world.query(B);
    const qAnotB = world.queryBuilder().with(A).without(B).build();
    expect([...qA]).toEqual([e1]);
    expect([...qB]).toEqual([e2]);
    expect([...qAnotB]).toEqual([e1]);

    world.add(e1, B);
    expect([...qAnotB]).toEqual([]);
    expect(qB.count).toBe(2);

    world.remove(e1, A);
    expect(world.has(e1, B)).toBe(true);
    expect(world.get(e1, B)).toEqual({ b: 2 });
    expect(qA.count).toBe(0);
    expect(qB.count).toBe(2);
  });

  it('each World assigns its own slots, so the same definitions work in two Worlds', () => {
    const X = literalDef('X', 5, () => ({ x: 1 }));
    const Y = literalDef('Y', 5, () => ({ y: 2 }));
    const w1 = new World();
    const w2 = new World();
    const a = w1.spawn();
    const b = w2.spawn();
    w1.add(a, X);
    w2.add(b, Y);
    w2.add(b, X);

    expect(w1.query(X).count).toBe(1);
    expect(w1.query(Y).count).toBe(0);
    expect(w2.query(X, Y).count).toBe(1);
    expect(w1.get(a, X)).toEqual({ x: 1 });
    expect(w2.get(b, Y)).toEqual({ y: 2 });
  });

  it('has / get / remove on a definition never added read absent and spend no slot', () => {
    const world = new World();
    const e = world.spawn();
    for (let i = 0; i < 40; i++) {
      const Probe = literalDef(`Probe${i}`, i, () => i);
      expect(world.has(e, Probe)).toBe(false);
      expect(world.get(e, Probe)).toBeUndefined();
      world.remove(e, Probe);
    }
    // 40 reads consumed nothing: all 32 slots are still free.
    for (let i = 0; i < 32; i++) {
      world.add(
        e,
        literalDef(`Real${i}`, i, () => i),
      );
    }
  });

  it('registers at most 32 component types per World, independent of the global counter', () => {
    // Every definition carries id 0 / bit 1: the per-World cap counts distinct
    // definitions, not ids, and the slot a World hands out is its own.
    const defs = Array.from({ length: 32 }, (_, i) => literalDef(`Cap${i}`, 0, () => i));
    const world = new World();
    const e = world.spawn();
    for (const def of defs) world.add(e, def);
    for (const def of defs) expect(world.has(e, def)).toBe(true);

    // The 32nd registration lands in slot 31, whose bit is negative in int32.
    const Slot31 = defs[31] as ComponentDef<number>;
    const q31 = world.query(Slot31);
    expect(q31.requiredMask).toBe(-2147483648);
    expect(q31.count).toBe(1);
    expect(world.get(e, Slot31)).toBe(31);
    world.remove(e, Slot31);
    expect(world.has(e, Slot31)).toBe(false);
    expect(q31.count).toBe(0);

    const Overflow = literalDef('Overflow', 0, () => 0);
    expect(() => world.add(e, Overflow)).toThrow(
      'Maximum 32 component types per World exceeded (registering "Overflow")',
    );
    expect(() => world.query(Overflow)).toThrow(
      'Maximum 32 component types per World exceeded (registering "Overflow")',
    );
    expect(world.has(e, Overflow)).toBe(false);
    expect(world.get(e, Overflow)).toBeUndefined();

    // A second World starts with every slot free.
    const fresh = new World();
    const f = fresh.spawn();
    fresh.add(f, Overflow);
    expect(fresh.has(f, Overflow)).toBe(true);
  });
});
