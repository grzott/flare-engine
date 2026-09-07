import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';
import { definePrefab, type Prefab } from '../src/prefab.js';
import { World } from '../src/world.js';

// Module-scope components shared across all tests in this file.
const PPos = defineComponent('PPos', () => ({ x: 0, y: 0 }));
const PVel = defineComponent('PVel', () => ({ vx: 0, vy: 0 }));
const PId = defineComponent('PId', () => ({ id: 0 }));
const PEnemy = defineComponent('PEnemy');

describe('definePrefab', () => {
  it('spawns entity with all components', () => {
    const world = new World();

    const bullet = definePrefab('Bullet', [PPos, { x: 100, y: 200 }], [PVel, { vx: 5, vy: 0 }]);

    const e = bullet.spawn(world);
    expect(world.has(e, PPos)).toBe(true);
    expect(world.has(e, PVel)).toBe(true);
    expect(world.get(e, PPos)).toEqual({ x: 100, y: 200 });
    expect(world.get(e, PVel)).toEqual({ vx: 5, vy: 0 });
  });

  it('uses component defaults when no data provided', () => {
    const world = new World();

    const prefab = definePrefab('Default', [PPos]);
    const e = prefab.spawn(world);
    expect(world.get(e, PPos)).toEqual({ x: 0, y: 0 });
  });

  it('supports factory functions for unique data per spawn', () => {
    let counter = 0;
    const world = new World();

    const prefab = definePrefab('Counted', [PId, () => ({ id: ++counter })]);
    const a = prefab.spawn(world);
    const b = prefab.spawn(world);
    expect(world.get(a, PId)!.id).toBe(1);
    expect(world.get(b, PId)!.id).toBe(2);
  });

  it('shares plain-object data by reference across spawns', () => {
    const world = new World();
    const shared = { x: 1, y: 2 };
    const prefab = definePrefab('Shared', [PPos, shared]);

    const a = prefab.spawn(world);
    const b = prefab.spawn(world);

    // The documented contract: the object is stored as given, exactly like
    // world.add(e, def, data). Both entities alias it — identity, not equality.
    expect(world.get(a, PPos)).toBe(shared);
    expect(world.get(b, PPos)).toBe(shared);
  });

  it('spawn(world) takes no overrides argument', () => {
    // Type-level pin: the old optional `overrides` was never read. A
    // `[World, X?]` tuple does not extend `[World]`, so reintroducing the
    // parameter stops this line compiling (root tsc covers tests).
    const worldOnly: Parameters<Prefab['spawn']> extends [World] ? true : false = true;
    expect(worldOnly).toBe(true);
  });

  it('supports tag components', () => {
    const world = new World();

    const prefab = definePrefab('BadGuy', [PEnemy]);
    const e = prefab.spawn(world);
    expect(world.has(e, PEnemy)).toBe(true);
  });

  it('stores name', () => {
    const prefab = definePrefab('Player');
    expect(prefab.name).toBe('Player');
  });
});
