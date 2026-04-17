import { beforeEach, describe, expect, it } from 'bun:test';
import { _resetComponentIds, defineComponent } from '../src/component.js';
import { definePrefab } from '../src/prefab.js';
import { World } from '../src/world.js';

beforeEach(() => {
  _resetComponentIds();
});

describe('definePrefab', () => {
  it('spawns entity with all components', () => {
    const Pos = defineComponent('Position', () => ({ x: 0, y: 0 }));
    const Vel = defineComponent('Velocity', () => ({ vx: 0, vy: 0 }));
    const world = new World();

    const bullet = definePrefab('Bullet', [Pos, { x: 100, y: 200 }], [Vel, { vx: 5, vy: 0 }]);

    const e = bullet.spawn(world);
    expect(world.has(e, Pos)).toBe(true);
    expect(world.has(e, Vel)).toBe(true);
    expect(world.get(e, Pos)).toEqual({ x: 100, y: 200 });
    expect(world.get(e, Vel)).toEqual({ vx: 5, vy: 0 });
  });

  it('uses component defaults when no data provided', () => {
    const Pos = defineComponent('Position', () => ({ x: 0, y: 0 }));
    const world = new World();

    const prefab = definePrefab('Default', [Pos]);
    const e = prefab.spawn(world);
    expect(world.get(e, Pos)).toEqual({ x: 0, y: 0 });
  });

  it('supports factory functions for unique data per spawn', () => {
    let counter = 0;
    const Id = defineComponent('Id', () => ({ id: 0 }));
    const world = new World();

    const prefab = definePrefab('Counted', [Id, () => ({ id: ++counter })]);
    const a = prefab.spawn(world);
    const b = prefab.spawn(world);
    expect(world.get(a, Id)!.id).toBe(1);
    expect(world.get(b, Id)!.id).toBe(2);
  });

  it('supports tag components', () => {
    const Enemy = defineComponent('Enemy');
    const world = new World();

    const prefab = definePrefab('BadGuy', [Enemy]);
    const e = prefab.spawn(world);
    expect(world.has(e, Enemy)).toBe(true);
  });

  it('stores name', () => {
    const prefab = definePrefab('Player');
    expect(prefab.name).toBe('Player');
  });
});
