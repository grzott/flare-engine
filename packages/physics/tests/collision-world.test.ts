import { describe, expect, it } from 'bun:test';
import { createCollider } from '../src/collider.js';
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

  it('re-add keeps exactly one broadphase record', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(1, AABB(20, 20), 50, 0); // Same entity id
    expect(world.size).toBe(1);
    expect(world.broadphaseSize).toBe(1);
  });

  it('collisions stay correct after a re-add that moves the entity away', () => {
    const world = new CollisionWorld();
    world.add(1, AABB(20, 20), 0, 0);
    world.add(2, AABB(20, 20), 5, 0); // Overlapping

    const starts: CollisionPair[] = [];
    const ends: CollisionPair[] = [];
    world.onCollisionStart.add((p) => starts.push(p));
    world.onCollisionEnd.add((p) => ends.push(p));

    world.step();
    expect(starts.length).toBe(1);
    expect(ends.length).toBe(0);

    // Re-add entity 1 at a non-overlapping position
    world.add(1, AABB(20, 20), 100, 0);

    world.step();
    expect(starts.length).toBe(1); // No new starts
    expect(ends.length).toBe(1); // Old pair ends

    // Confirm no stale phantom on the next step
    world.step();
    expect(starts.length).toBe(1);
    expect(ends.length).toBe(1);
  });

  describe('getColliderBoundsInto / getColliderBounds', () => {
    it('returns null for an absent entity (Into form)', () => {
      const world = new CollisionWorld();
      const out = { x: 0, y: 0, width: 0, height: 0 };
      expect(world.getColliderBoundsInto(99, out)).toBeNull();
    });

    it('returns null for an absent entity (allocating form)', () => {
      const world = new CollisionWorld();
      expect(world.getColliderBounds(99)).toBeNull();
    });

    it('returns correct AABB bounds for a registered AABB collider', () => {
      const world = new CollisionWorld();
      world.add(1, AABB(20, 10), 5, 8);
      const out = { x: 0, y: 0, width: 0, height: 0 };
      const result = world.getColliderBoundsInto(1, out);
      expect(result).toBe(out);
      expect(out.x).toBe(-5);
      expect(out.y).toBe(3);
      expect(out.width).toBe(20);
      expect(out.height).toBe(10);
    });

    it('returns correct bounds for a circle collider', () => {
      const world = new CollisionWorld();
      world.add(2, CircleShape(15), 10, 20);
      const result = world.getColliderBounds(2);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(-5);
      expect(result!.y).toBe(5);
      expect(result!.width).toBe(30);
      expect(result!.height).toBe(30);
    });

    it('Into form returns the same out object (not a new allocation)', () => {
      const world = new CollisionWorld();
      world.add(3, AABB(4, 4), 0, 0);
      const out = { x: 0, y: 0, width: 0, height: 0 };
      const result = world.getColliderBoundsInto(3, out);
      expect(result).toBe(out);
    });

    it('reflects position after setPosition', () => {
      const world = new CollisionWorld();
      world.add(4, AABB(10, 10), 0, 0);
      world.setPosition(4, 50, 30);
      const result = world.getColliderBounds(4);
      expect(result!.x).toBe(45);
      expect(result!.y).toBe(25);
    });
  });
});

describe('CollisionWorld.addCollider (F049)', () => {
  it('honours the Collider isTrigger flag — trigger enter, not collision start', () => {
    const world = new CollisionWorld();
    world.addCollider(1, createCollider(AABB(20, 20), { isTrigger: true }), 0, 0);
    world.add(2, AABB(20, 20), 15, 0);

    const triggers: CollisionPair[] = [];
    const starts: CollisionPair[] = [];
    world.onTriggerEnter.add((p) => triggers.push(p));
    world.onCollisionStart.add((p) => starts.push(p));

    world.step();
    expect(triggers.length).toBe(1);
    expect(starts.length).toBe(0);
  });

  it('copies the Collider at add time — later edits to it do not reach the world', () => {
    const world = new CollisionWorld();
    const c = createCollider(AABB(20, 20), { layer: 1, mask: 1 });
    world.addCollider(1, c, 0, 0);
    world.add(2, AABB(20, 20), 15, 0, false, 1, 1);

    const starts: CollisionPair[] = [];
    const ends: CollisionPair[] = [];
    world.onCollisionStart.add((p) => starts.push(p));
    world.onCollisionEnd.add((p) => ends.push(p));

    world.step();
    expect(starts.length).toBe(1);

    c.layer = 2;
    c.mask = 2;
    c.shape = AABB(200, 200);
    world.step();
    expect(starts.length).toBe(1);
    expect(ends.length).toBe(0);
    expect(world.getColliderBounds(1)!.width).toBe(20);
  });

  it('re-adding an entity replaces its collider and updates the broadphase', () => {
    const world = new CollisionWorld();
    world.addCollider(1, createCollider(AABB(10, 10)), 0, 0);
    world.addCollider(1, createCollider(AABB(40, 40)), 100, 100);
    expect(world.size).toBe(1);
    expect(world.broadphaseSize).toBe(1);
    const b = world.getColliderBounds(1)!;
    expect(b.x).toBe(80);
    expect(b.y).toBe(80);
    expect(b.width).toBe(40);
    expect(b.height).toBe(40);
  });
});
