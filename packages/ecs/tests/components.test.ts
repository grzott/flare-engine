import { describe, expect, it } from 'bun:test';
import { Parent, Position, Rotation, Scale, Velocity } from '../src/components.js';
import { World } from '../src/world.js';

describe('built-in components', () => {
  it('all have correct names', () => {
    expect(Position.name).toBe('Position');
    expect(Velocity.name).toBe('Velocity');
    expect(Rotation.name).toBe('Rotation');
    expect(Scale.name).toBe('Scale');
    expect(Parent.name).toBe('Parent');
  });

  it('all have unique IDs', () => {
    const ids = new Set([Position.id, Velocity.id, Rotation.id, Scale.id, Parent.id]);
    expect(ids.size).toBe(5);
  });

  it('Position defaults to { x: 0, y: 0 }', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position);
    expect(world.get(e, Position)).toEqual({ x: 0, y: 0 });
  });

  it('Velocity defaults to { x: 0, y: 0 }', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Velocity);
    expect(world.get(e, Velocity)).toEqual({ x: 0, y: 0 });
  });

  it('Rotation defaults to { angle: 0 }', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Rotation);
    expect(world.get(e, Rotation)).toEqual({ angle: 0 });
  });

  it('Scale defaults to { x: 1, y: 1 }', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Scale);
    expect(world.get(e, Scale)).toEqual({ x: 1, y: 1 });
  });

  it('Parent defaults to { entity: 0 }', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Parent);
    expect(world.get(e, Parent)).toEqual({ entity: 0 });
  });

  it('works together with queries', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Position, { x: 10, y: 20 });
    world.add(e, Velocity, { x: 1, y: 2 });
    const q = world.query(Position, Velocity);
    expect(q.count).toBe(1);
    expect([...q]).toEqual([e]);
  });
});
