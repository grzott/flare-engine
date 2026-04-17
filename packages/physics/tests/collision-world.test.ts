import { describe, expect, it } from 'bun:test';
import { type CollisionPair, CollisionWorld } from '../src/collision-world.js';
import { AABB, CircleShape } from '../src/shape.js';

describe('CollisionWorld', () => {
  it('starts empty', () => {
    const world = new CollisionWorld();
    expect(world.size).toBe(0);
  });

  it('adds and removes entities', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    expect(world.size).toBe(1);
    world.remove(1);
    expect(world.size).toBe(0);
  });

  it('detects collision start between two AABBs', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 15, 0);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));

    world.step();
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.entityA).toBe(1);
    expect(pairs[0]!.entityB).toBe(2);
  });

  it('does not re-emit collision start for ongoing collision', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 15, 0);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));

    world.step();
    world.step(); // Second step — same overlap, no new event
    expect(pairs.length).toBe(1);
  });

  it('emits collision end when entities separate', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 15, 0);

    world.step(); // Start collision

    const ends: CollisionPair[] = [];
    world.onCollisionEnd.add((p) => ends.push(p));

    world.setPosition(2, 100, 0); // Move far away
    world.step();
    expect(ends.length).toBe(1);
  });

  it('emits trigger enter/exit for trigger shapes', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0, true); // isTrigger
    world.add(2, AABB(20, 20), 15, 0);

    const enters: CollisionPair[] = [];
    const exits: CollisionPair[] = [];
    world.onTriggerEnter.add((p) => enters.push(p));
    world.onTriggerExit.add((p) => exits.push(p));

    world.step();
    expect(enters.length).toBe(1);

    world.setPosition(2, 100, 0);
    world.step();
    expect(exits.length).toBe(1);
  });

  it('respects layer/mask filtering', () => {
    const world = new CollisionWorld();
    // Layer 1 can only collide with mask 2, and vice versa
    world.add(1, AABB(20, 20), 0, 0, false, 1, 2);
    world.add(2, AABB(20, 20), 5, 0, false, 2, 1);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));
    world.step();
    expect(pairs.length).toBe(1); // They match each other's masks
  });

  it('filters out non-matching layers', () => {
    const world = new CollisionWorld();
    // Layer 1 only collides with layer 1 mask, but entity 2 is layer 4
    world.add(1, AABB(20, 20), 0, 0, false, 1, 1);
    world.add(2, AABB(20, 20), 5, 0, false, 4, 4);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));
    world.step();
    expect(pairs.length).toBe(0);
  });

  it('handles non-overlapping entities', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 0, 0);
    world.add(2, AABB(10, 10), 100, 100);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));
    world.step();
    expect(pairs.length).toBe(0);
  });

  it('detects circle vs AABB collisions', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, CircleShape(10), 14, 0);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));
    world.step();
    expect(pairs.length).toBe(1);
  });

  it('setPosition updates broadphase', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(10, 10), 0, 0);
    world.add(2, AABB(10, 10), 100, 100);

    const pairs: CollisionPair[] = [];
    world.onCollisionStart.add((p) => pairs.push(p));
    world.step();
    expect(pairs.length).toBe(0);

    world.setPosition(2, 5, 0); // Overlap
    world.step();
    expect(pairs.length).toBe(1);
  });

  it('clear removes everything', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 5, 0);
    world.step();
    world.clear();
    expect(world.size).toBe(0);
  });

  it('emits collision end when entity is removed during active collision', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 5, 0);
    world.step(); // Start collision

    const ends: CollisionPair[] = [];
    world.onCollisionEnd.add((p) => ends.push(p));

    world.remove(2); // Should fire exit signal immediately
    expect(ends.length).toBe(1);
    expect(ends[0]!.entityA).toBe(1);
    expect(ends[0]!.entityB).toBe(2);
  });

  it('emits trigger exit when trigger entity is removed during active overlap', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0, true); // isTrigger
    world.add(2, AABB(20, 20), 5, 0);
    world.step(); // Trigger enter

    const exits: CollisionPair[] = [];
    world.onTriggerExit.add((p) => exits.push(p));

    world.remove(1); // Should fire trigger exit immediately
    expect(exits.length).toBe(1);
  });

  it('no duplicate exit signals after entity removal', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 5, 0);
    world.step();

    world.remove(2);

    const ends: CollisionPair[] = [];
    world.onCollisionEnd.add((p) => ends.push(p));
    world.step(); // Next step — pair already gone, no extra signals
    expect(ends.length).toBe(0);
  });
});
