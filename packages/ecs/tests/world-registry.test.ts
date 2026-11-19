import { describe, expect, it } from 'bun:test';
import type { ComponentDef } from '../src/component.js';
import { defineComponent } from '../src/component.js';
import { World } from '../src/world.js';

// Hand-built definitions stand in for what a second copy of the package would
// produce: its own counter starts at 0, so its ids and bits repeat the first
// copy's. Literals also keep these tests independent of the global counter.
function literal<T>(id: number, name: string, create: () => T): ComponentDef<T> {
  return { id, bit: 1 << id, name, create };
}

function tag(id: number, name: string): ComponentDef<undefined> {
  return literal(id, name, () => undefined);
}

function tags(count: number, prefix: string): ComponentDef<undefined>[] {
  return Array.from({ length: count }, (_, i) => tag(i, `${prefix}${i}`));
}

const CopyA = defineComponent('RegistryCopyA', () => ({ a: 0 }));
const CopyB = defineComponent('RegistryCopyB', () => ({ b: 0 }));
const CopyC = defineComponent('RegistryCopyC');

describe('World registry: two definitions with equal id and bit', () => {
  it('stores both on one entity and returns each its own data', () => {
    const A = literal(0, 'A', () => ({ a: 1 }));
    const B = literal(0, 'B', () => ({ b: 2 }));
    const world = new World();
    const e = world.spawn();

    world.add(e, A, { a: 10 });
    world.add(e, B, { b: 20 });

    expect(world.get(e, A)).toEqual({ a: 10 });
    expect(world.get(e, B)).toEqual({ b: 20 });
    expect(world.has(e, A)).toBe(true);
    expect(world.has(e, B)).toBe(true);
  });

  it('keeps them apart on different entities', () => {
    const A = literal(0, 'A', () => ({ a: 1 }));
    const B = literal(0, 'B', () => ({ b: 2 }));
    const world = new World();
    const ea = world.spawn();
    const eb = world.spawn();

    world.add(ea, A);
    world.add(eb, B);

    expect(world.get(ea, A)).toEqual({ a: 1 });
    expect(world.get(ea, B)).toBeUndefined();
    expect(world.get(eb, B)).toEqual({ b: 2 });
    expect(world.get(eb, A)).toBeUndefined();
    expect(world.has(ea, B)).toBe(false);
    expect(world.has(eb, A)).toBe(false);
  });

  it('matches query(A) and query(B) independently', () => {
    const A = tag(0, 'A');
    const B = tag(0, 'B');
    const world = new World();
    const ea = world.spawn();
    const eb = world.spawn();
    const both = world.spawn();
    world.add(ea, A);
    world.add(eb, B);
    world.add(both, A);
    world.add(both, B);

    const qa = world.query(A);
    const qb = world.query(B);
    const qab = world.query(A, B);

    expect([...qa.entities].sort()).toEqual([ea, both]);
    expect([...qb.entities].sort()).toEqual([eb, both]);
    expect([...qab.entities]).toEqual([both]);
  });

  it('remove(e, A) leaves B and its data', () => {
    const A = literal(0, 'A', () => ({ a: 1 }));
    const B = literal(0, 'B', () => ({ b: 2 }));
    const world = new World();
    const e = world.spawn();
    world.add(e, A);
    world.add(e, B);
    const qb = world.query(B);

    world.remove(e, A);

    expect(world.has(e, A)).toBe(false);
    expect(world.get(e, A)).toBeUndefined();
    expect(world.has(e, B)).toBe(true);
    expect(world.get(e, B)).toEqual({ b: 2 });
    expect(qb.has(e)).toBe(true);
  });
});

describe('World registry: masks for definitions from one copy', () => {
  it('query mask is the OR of each definition bit', () => {
    const world = new World();
    const q = world.query(CopyA, CopyB);

    expect(q.requiredMask).toBe(CopyA.bit | CopyB.bit);
    expect(q.excludedMask).toBe(0);
    expect(q.matches(CopyA.bit | CopyB.bit)).toBe(true);
    expect(q.matches(CopyA.bit)).toBe(false);
  });

  it('builder masks are the definition bits', () => {
    const world = new World();
    const q = world.queryBuilder().with(CopyA).without(CopyC).build();

    expect(q.requiredMask).toBe(CopyA.bit);
    expect(q.excludedMask).toBe(CopyC.bit);
    expect(q.matches(CopyA.bit | CopyB.bit)).toBe(true);
    expect(q.matches(CopyA.bit | CopyC.bit)).toBe(false);
  });

  it('holds whatever order the definitions are first used in', () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, CopyC);
    world.add(e, CopyA);

    expect(world.query(CopyA).requiredMask).toBe(CopyA.bit);
    expect(world.query(CopyC).requiredMask).toBe(CopyC.bit);
  });
});

describe('World registry: read-only probes', () => {
  it('has / get / remove on unknown definitions do not throw in a full World', () => {
    const world = new World();
    const holder = world.spawn();
    for (const def of tags(32, 'Full')) world.add(holder, def);
    const bare = world.spawn();

    for (let i = 0; i < 8; i++) {
      const unknown = literal(100 + i, `Unknown${i}`, () => ({ v: i }));
      expect(world.has(bare, unknown)).toBe(false);
      expect(world.get(bare, unknown)).toBeUndefined();
      expect(() => world.remove(bare, unknown)).not.toThrow();
      expect(world.has(bare, unknown)).toBe(false);
    }
  });

  it('take no slots', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(30, 'Used')) world.add(e, def);

    for (const probe of tags(8, 'Probe')) {
      expect(world.has(e, probe)).toBe(false);
      expect(world.get(e, probe)).toBeUndefined();
      world.remove(e, probe);
    }

    world.add(e, tag(0, 'Late0'));
    world.add(e, tag(1, 'Late1'));
    expect(() => world.add(e, tag(2, 'Late2'))).toThrow();
  });

  it('remove of an unknown definition leaves a colliding component in place', () => {
    const A = literal(0, 'A', () => ({ a: 1 }));
    const world = new World();
    const e = world.spawn();
    world.add(e, A);

    world.remove(e, tag(0, 'NeverAdded'));

    expect(world.has(e, A)).toBe(true);
    expect(world.get(e, A)).toEqual({ a: 1 });
  });
});

describe('World registry: 32 component types per World', () => {
  it('throws on the 33rd distinct definition', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(32, 'Cap')) world.add(e, def);

    expect(() => world.add(e, tag(0, 'Overflow'))).toThrow(
      'A World holds at most 32 component types (registering "Overflow")',
    );
    expect(() => world.query(tag(1, 'OverflowQuery'))).toThrow(
      'A World holds at most 32 component types (registering "OverflowQuery")',
    );
  });

  it('a second World has its own 32', () => {
    const defs = tags(32, 'Shared');
    const first = new World();
    const e1 = first.spawn();
    for (const def of defs) first.add(e1, def);

    const second = new World();
    const e2 = second.spawn();
    const other = tags(32, 'Other');
    for (const def of other) second.add(e2, def);

    expect(second.query(...other).has(e2)).toBe(true);
    expect(first.query(...defs).has(e1)).toBe(true);
  });

  it('an overflowing query(X, Y) takes no slots', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(31, 'Most')) world.add(e, def);
    const X = tag(0, 'X');
    const Y = tag(1, 'Y');

    expect(() => world.query(X, Y)).toThrow(
      'A World holds at most 32 component types (registering "Y")',
    );

    world.add(e, Y);
    expect(world.has(e, Y)).toBe(true);
    expect(() => world.add(e, X)).toThrow(
      'A World holds at most 32 component types (registering "X")',
    );
  });

  it('an overflowing builder with() / without() takes no slots', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(30, 'Most')) world.add(e, def);
    const X = tag(0, 'X');
    const Y = tag(1, 'Y');
    const Z = tag(2, 'Z');

    expect(() => world.queryBuilder().with(X, Y, Z)).toThrow();
    expect(() => world.queryBuilder().without(X, Y, Z)).toThrow();

    const q = world.queryBuilder().with(X).without(Y).build();
    world.add(e, X);
    expect(q.has(e)).toBe(true);
    world.add(e, Y);
    expect(q.has(e)).toBe(false);
    expect(() => world.add(e, Z)).toThrow();
  });

  it('counts a definition repeated in one call once', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(31, 'Most')) world.add(e, def);
    const X = tag(0, 'X');

    const q = world.query(X, X);
    world.add(e, X);

    expect(q.has(e)).toBe(true);
  });
});

describe('World registry: destroy', () => {
  it('deletes only from the stores the entity has', () => {
    const world = new World();
    const defs = tags(10, 'Store');
    for (const def of defs) world.add(world.spawn(), def);
    const e = world.spawn();
    const own = defs[4] as ComponentDef<undefined>;
    world.add(e, own);

    const original = Map.prototype.delete;
    let deletesOfEntity = 0;
    try {
      Map.prototype.delete = function (this: Map<unknown, unknown>, key: unknown): boolean {
        if (key === e) deletesOfEntity++;
        return original.call(this, key);
      };
      world.destroy(e);
    } finally {
      Map.prototype.delete = original;
    }

    // One for the archetype entry, one for the single store it was in.
    expect(deletesOfEntity).toBe(2);
    expect(world.exists(e)).toBe(false);
    expect(world.get(e, own)).toBeUndefined();
  });

  it('removes every component the entity had', () => {
    const world = new World();
    const defs = [0, 5, 31].map((i) => literal(i, `Held${i}`, () => ({ i })));
    const e = world.spawn();
    const keep = world.spawn();
    for (const def of defs) {
      world.add(e, def);
      world.add(keep, def);
    }

    world.destroy(e);

    for (const def of defs) {
      expect(world.get(e, def)).toBeUndefined();
      expect(world.get(keep, def)).toEqual({ i: def.id });
    }
  });
});

describe('World registry: slot 31', () => {
  it('a definition on the sign bit adds, queries, removes and destroys', () => {
    const Top = literal(31, 'Top', () => ({ t: 1 }));
    const Low = literal(0, 'Low', () => ({ l: 1 }));
    expect(Top.bit).toBe(-2147483648);
    const world = new World();
    const e = world.spawn();
    const q = world.query(Top);
    const qWithout = world.queryBuilder().with(Low).without(Top).build();

    world.add(e, Low);
    expect(qWithout.has(e)).toBe(true);
    world.add(e, Top, { t: 7 });

    expect(q.requiredMask).toBe(Top.bit);
    expect(world.has(e, Top)).toBe(true);
    expect(world.get(e, Top)).toEqual({ t: 7 });
    expect(q.has(e)).toBe(true);
    expect(qWithout.has(e)).toBe(false);

    world.remove(e, Top);
    expect(world.has(e, Top)).toBe(false);
    expect(world.get(e, Top)).toBeUndefined();
    expect(world.has(e, Low)).toBe(true);
    expect(q.has(e)).toBe(false);

    world.add(e, Top);
    world.destroy(e);
    expect(world.get(e, Top)).toBeUndefined();
    expect(world.get(e, Low)).toBeUndefined();
    expect(q.count).toBe(0);
  });
});

describe('World registry: a colliding definition', () => {
  it('gets the lowest free bit, not the one already held', () => {
    const A = tag(0, 'A');
    const Third = tag(2, 'Third');
    const ACopy = tag(0, 'ACopy');
    const world = new World();
    const e = world.spawn();
    world.add(e, A);
    world.add(e, Third);

    const q = world.query(ACopy);

    expect(world.query(A).requiredMask).toBe(1);
    expect(world.query(Third).requiredMask).toBe(4);
    expect(q.requiredMask).toBe(2);
    expect(q.has(e)).toBe(false);
    expect(world.has(e, ACopy)).toBe(false);

    world.add(e, ACopy);
    expect(q.has(e)).toBe(true);
    expect(world.has(e, ACopy)).toBe(true);
    expect(world.has(e, A)).toBe(true);
  });

  it('can land on the sign bit when it is the last one free', () => {
    const world = new World();
    const e = world.spawn();
    for (const def of tags(31, 'Low')) world.add(e, def);
    const Last = literal(0, 'Last', () => ({ v: 3 }));
    const other = world.spawn();

    world.add(other, Last);

    expect(world.query(Last).requiredMask).toBe(-2147483648);
    expect(world.has(other, Last)).toBe(true);
    expect(world.has(e, Last)).toBe(false);
    expect(world.get(other, Last)).toEqual({ v: 3 });
    world.destroy(other);
    expect(world.get(other, Last)).toBeUndefined();
  });

  it('a definition whose bit is not a single bit gets a free one', () => {
    const Zero: ComponentDef<undefined> = { id: 0, bit: 0, name: 'Zero', create: () => undefined };
    const Multi: ComponentDef<undefined> = {
      id: 1,
      bit: 6,
      name: 'Multi',
      create: () => undefined,
    };
    const world = new World();
    const e = world.spawn();

    world.add(e, Zero);
    world.add(e, Multi);

    expect(world.query(Zero).requiredMask).toBe(1);
    expect(world.query(Multi).requiredMask).toBe(2);
    expect(world.has(e, Zero)).toBe(true);
    expect(world.has(e, Multi)).toBe(true);
  });
});
