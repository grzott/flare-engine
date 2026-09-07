import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';
import { type Query, QueryBuilder } from '../src/query.js';
import { World } from '../src/world.js';

// Shared at module scope — each test builds a fresh World (see world.test.ts).
const Pos = defineComponent('QPos', () => ({ x: 0, y: 0 }));
const Vel = defineComponent('QVel', () => ({ vx: 0, vy: 0 }));

/** Membership is the contract; array order explicitly is not (XR-7). */
const idsOf = (q: Iterable<number>): number[] => [...q].sort((a, b) => a - b);

describe('Query removal (swap-remove)', () => {
  it('removes an entity from the MIDDLE without losing or duplicating others', () => {
    const w = new World();
    const q = w.query(Pos, Vel);
    const ids = [0, 1, 2, 3, 4].map(() => {
      const id = w.spawn();
      w.add(id, Pos, { x: 0, y: 0 });
      w.add(id, Vel, { vx: 0, vy: 0 });
      return id;
    });

    w.destroy(ids[2] as number);

    expect(q.count).toBe(4);
    expect(idsOf(q)).toEqual([ids[0], ids[1], ids[3], ids[4]] as number[]);
    expect(q.has(ids[2] as number)).toBe(false);
    for (const keep of [ids[0], ids[1], ids[3], ids[4]]) {
      expect(q.has(keep as number)).toBe(true);
    }
  });

  it('removes the LAST entity — the self-swap case', () => {
    // swapRemove writes entities[idx] = lastId and index.set(lastId, idx)
    // before deleting. When the victim IS the last element those two touch the
    // same id, so a delete-before-set ordering would resurrect it in the index.
    const w = new World();
    const q = w.query(Pos, Vel);
    const a = w.spawn();
    const b = w.spawn();
    for (const id of [a, b]) {
      w.add(id, Pos, { x: 0, y: 0 });
      w.add(id, Vel, { vx: 0, vy: 0 });
    }

    w.destroy(b);

    expect(q.count).toBe(1);
    expect(q.has(b)).toBe(false);
    expect(idsOf(q)).toEqual([a]);
  });

  it('empties cleanly and accepts entities again afterwards', () => {
    const w = new World();
    const q = w.query(Pos, Vel);
    const a = w.spawn();
    w.add(a, Pos, { x: 0, y: 0 });
    w.add(a, Vel, { vx: 0, vy: 0 });

    w.destroy(a);
    expect(q.count).toBe(0);
    expect(q.has(a)).toBe(false);

    const b = w.spawn();
    w.add(b, Pos, { x: 0, y: 0 });
    w.add(b, Vel, { vx: 0, vy: 0 });
    expect(q.count).toBe(1);
    expect(idsOf(q)).toEqual([b]);
  });

  it('keeps the id->index map consistent across heavy interleaved churn', () => {
    // The regression this pins: a stale index entry after a swap makes a LATER
    // removal write into the wrong slot, which silently drops a live entity or
    // leaves a dead one iterable. Only a long interleaved run surfaces it.
    const w = new World();
    const q = w.query(Pos, Vel);
    const live: number[] = [];
    const spawn = (): number => {
      const id = w.spawn();
      w.add(id, Pos, { x: 0, y: 0 });
      w.add(id, Vel, { vx: 0, vy: 0 });
      live.push(id);
      return id;
    };

    for (let i = 0; i < 50; i++) spawn();
    // Remove from the front each round, so the victim is never the last slot.
    for (let round = 0; round < 40; round++) {
      const victim = live.shift() as number;
      w.destroy(victim);
      spawn();
      expect(q.count).toBe(live.length);
    }

    expect(idsOf(q)).toEqual([...live].sort((a, b) => a - b));
    for (const id of live) expect(q.has(id)).toBe(true);

    // Drain to empty. This half is what actually reaches the stale-index bug:
    // swap-remove moves the LAST entity into the hole, so only removing an
    // entity that has itself been swapped exercises the updated index. FIFO
    // churn above never does — verified by mutation, where dropping the
    // `index.set(lastId, idx)` line left the loop above entirely green.
    while (live.length > 0) {
      const victim = live.shift() as number;
      w.destroy(victim);
      expect(q.has(victim)).toBe(false);
      expect(q.count).toBe(live.length);
      expect(idsOf(q)).toEqual([...live].sort((a, b) => a - b));
    }
    expect(q.count).toBe(0);
  });

  it('drops an entity that stops matching, and restores it when it matches again', () => {
    const w = new World();
    const q = w.query(Pos, Vel);
    const a = w.spawn();
    const b = w.spawn();
    for (const id of [a, b]) {
      w.add(id, Pos, { x: 0, y: 0 });
      w.add(id, Vel, { vx: 0, vy: 0 });
    }

    w.remove(a, Vel);
    expect(q.count).toBe(1);
    expect(q.has(a)).toBe(false);
    expect(idsOf(q)).toEqual([b]);

    w.add(a, Vel, { vx: 1, vy: 1 });
    expect(q.count).toBe(2);
    expect(idsOf(q)).toEqual([a, b].sort((x, y) => x - y));
  });
});

describe('Query iteration order', () => {
  it('is NOT sorted by entity id — the old docstring was wrong', () => {
    // Pinning the real contract rather than the one that was documented. An
    // entity that starts matching later is appended, so ids come out in match
    // order. render-system's sortByDrawOrder is a *stable* sort on z alone, so
    // this is the tie-break between equal-z sprites — depend on z, not on this.
    const w = new World();
    const a = w.spawn();
    const b = w.spawn();
    const c = w.spawn();
    for (const id of [a, b, c]) w.add(id, Pos, { x: 0, y: 0 });

    const q = w.query(Pos, Vel);
    w.add(c, Vel, { vx: 0, vy: 0 });
    w.add(a, Vel, { vx: 0, vy: 0 });
    w.add(b, Vel, { vx: 0, vy: 0 });

    expect([...q]).toEqual([c, a, b]);
    expect([...q]).not.toEqual([a, b, c]);
  });
});

describe('Query.entities (zero-alloc walk)', () => {
  it('is the live array of matching ids, not a snapshot', () => {
    const w = new World();
    const q = w.query(Pos, Vel);
    const ids = q.entities;
    expect(ids.length).toBe(0);

    const a = w.spawn();
    w.add(a, Pos, { x: 0, y: 0 });
    w.add(a, Vel, { vx: 0, vy: 0 });
    const b = w.spawn();
    w.add(b, Pos, { x: 0, y: 0 });
    w.add(b, Vel, { vx: 0, vy: 0 });

    // The reference read before the adds already sees them: reading it per
    // frame copies nothing, which is the whole point of the accessor.
    expect(ids.length).toBe(2);
    expect(ids.length).toBe(q.count);
    expect([...ids]).toEqual([...q]);

    w.destroy(a);
    expect(ids.length).toBe(1);
    expect(ids[0]).toBe(b);
  });

  it('is typed read-only so a walk cannot mutate membership', () => {
    const w = new World();
    const q = w.query(Pos);
    // Type-level pin (root tsc covers tests; the per-package gate is src-only):
    // `readonly number[]` does not extend `number[]`, so a mutable getter turns
    // this alias into `false` and the assignment below stops compiling.
    type ReadonlyWalk = typeof q.entities extends number[] ? false : true;
    const readonlyWalk: ReadonlyWalk = true;
    expect(readonlyWalk).toBe(true);
  });
});

describe('QueryBuilder', () => {
  it('build() hands the finished query to the registration callback', () => {
    const registered: Query[] = [];
    const builder = new QueryBuilder((q) => registered.push(q));
    const q = builder.with(Pos).without(Vel).build();
    expect(registered.length).toBe(1);
    expect(registered[0]).toBe(q);
    expect(q.requiredMask).toBe(Pos.bit);
    expect(q.excludedMask).toBe(Vel.bit);
  });

  it('cannot be constructed without a registration callback', () => {
    // Type-level pin: an empty argument list must NOT satisfy the constructor,
    // so a bare `new QueryBuilder()` is a compile error, not a silently
    // orphaned query. Checked as `[] extends Params` rather than via
    // `Params['length']`, because an optional parameter makes the length
    // `0 | 1` and `1` would still be assignable — the pin would then pass
    // while the trap had silently reopened.
    type RequiresRegister = [] extends ConstructorParameters<typeof QueryBuilder> ? false : true;
    const requiresRegister: RequiresRegister = true;
    expect(requiresRegister).toBe(true);
  });

  it('a query from world.queryBuilder() keeps updating after build()', () => {
    const w = new World();
    const q = w.queryBuilder().with(Pos).without(Vel).build();
    const a = w.spawn();
    w.add(a, Pos, { x: 0, y: 0 });
    expect(q.has(a)).toBe(true);
    w.add(a, Vel, { vx: 0, vy: 0 });
    expect(q.has(a)).toBe(false);
    w.remove(a, Vel);
    expect(q.has(a)).toBe(true);
  });
});
