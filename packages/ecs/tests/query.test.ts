import { describe, expect, it } from 'bun:test';
import { defineComponent } from '../src/component.js';
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
