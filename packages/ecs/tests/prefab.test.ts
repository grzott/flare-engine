import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';
import { definePrefab } from '../src/prefab.js';
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
