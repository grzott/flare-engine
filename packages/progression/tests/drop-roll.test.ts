import { describe, expect, it } from 'bun:test';
import { createDropTable, rollDrop } from '../src/index.js';

type MyKind = 'medikit' | 'ammo' | 'bomb';

const TABLE = [
  { item: 'medikit' as MyKind, weight: 8 },
  { item: 'ammo' as MyKind, weight: 60 },
  { item: 'bomb' as MyKind, weight: 4 },
];
const THRESHOLDS: Partial<Record<MyKind, number>> = { medikit: 25, bomb: 40 };
const CHANCE = 0.12;
const ZERO_PITY: Record<MyKind, number> = { medikit: 0, ammo: 0, bomb: 0 };

describe('createDropTable — pity override', () => {
  it('fires medikit when medikit dry count + 1 == threshold', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 0 };
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).toBe('medikit');
  });

  it('does NOT fire medikit when dry count + 1 < threshold (one below)', () => {
    const table = createDropTable(TABLE);
    // medikit: 23 -> 23 + 1 = 24 < 25 (threshold), must NOT trigger pity
    const pity: Record<MyKind, number> = { medikit: 23, ammo: 0, bomb: 0 };
    // chance gate closed (rollChance01 >= chancePerRoll) so only pity could fire
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).not.toBe('medikit');
  });

  it('fires bomb when bomb threshold reached and medikit not yet due', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 0, ammo: 0, bomb: 39 };
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).toBe('bomb');
  });

  it('medikit pity wins over bomb pity (first entry order)', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 39 };
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).toBe('medikit');
  });

  it('pity fires even when rollChance01 is above chancePerRoll', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 0 };
    const out = rollDrop(table, 0.5, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).toBe('medikit');
  });
});

describe('createDropTable — chance gate', () => {
  it('rollChance01 >= chancePerRoll yields none without pity', () => {
    const table = createDropTable(TABLE);
    const out = rollDrop(table, 0.5, CHANCE, CHANCE, ZERO_PITY, {});
    expect(out.item).toBe('none');
  });

  it('rollChance01 < chancePerRoll triggers the table pick', () => {
    const table = createDropTable(TABLE);
    const out = rollDrop(table, 0.0, 0.0, CHANCE, ZERO_PITY, {});
    expect(out.item).toBe('medikit');
  });
});

describe('createDropTable — pity counter updates', () => {
  it('dropped item resets its counter to 0', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 0 };
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.pity.medikit).toBe(0);
  });

  it('non-dropped items advance counter by 1', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 5, bomb: 0 };
    const out = rollDrop(table, 0.99, 0.99, CHANCE, pity, THRESHOLDS);
    expect(out.item).toBe('medikit');
    expect(out.pity.ammo).toBe(6);
    expect(out.pity.bomb).toBe(1);
  });

  it('none result advances all counters by 1', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 3, ammo: 1, bomb: 2 };
    const out = rollDrop(table, 0.5, 0.99, CHANCE, pity, {});
    expect(out.item).toBe('none');
    expect(out.pity.medikit).toBe(4);
    expect(out.pity.ammo).toBe(2);
    expect(out.pity.bomb).toBe(3);
  });
});

describe('createDropTable — isAllowed gate', () => {
  it('gated kind excluded even on pity', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 39 };
    const out = rollDrop(
      table,
      0.99,
      0.99,
      CHANCE,
      pity,
      THRESHOLDS,
      (k) => k !== 'medikit' && k !== 'bomb',
    );
    expect(out.item).not.toBe('medikit');
    expect(out.item).not.toBe('bomb');
  });

  it('fully-gated pool with open chance gate fizzles to none', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 0, ammo: 0, bomb: 0 };
    // rollChance01=0.0 < chancePerRoll=1.0 — gate is open, but every entry blocked
    const out = rollDrop(table, 0.5, 0.0, 1.0, pity, {}, () => false);
    expect(out.item).toBe('none');
  });
});

describe('createDropTable — rollInto zero-alloc form', () => {
  it('writes into out object in-place', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 0, bomb: 0 };
    const out = { item: 'none' as MyKind | 'none', pity: { ...pity } };
    table.rollInto(0.99, 0.99, CHANCE, pity, THRESHOLDS, () => true, out);
    expect(out.item).toBe('medikit');
  });

  it('out.pity aliased to input pity — safe (reads before writes)', () => {
    const table = createDropTable(TABLE);
    const pity: Record<MyKind, number> = { medikit: 24, ammo: 5, bomb: 3 };
    const out = { item: 'none' as MyKind | 'none', pity };
    table.rollInto(0.99, 0.99, CHANCE, pity, THRESHOLDS, () => true, out);
    expect(out.item).toBe('medikit');
    expect(out.pity.medikit).toBe(0);
    expect(out.pity.ammo).toBe(6);
    expect(out.pity.bomb).toBe(4);
  });

  it('repeated rollInto calls are stable (no closure pollution)', () => {
    const table = createDropTable(TABLE);
    const zero: Record<MyKind, number> = { medikit: 0, ammo: 0, bomb: 0 };
    const out = { item: 'none' as MyKind | 'none', pity: { ...zero } };
    for (let i = 0; i < 20; i++) {
      table.rollInto(0.0, 0.0, CHANCE, zero, {}, () => true, out);
      expect(out.item).toBe('medikit');
    }
  });
});

describe('createDropTable — weighted distribution', () => {
  it('ammo dominates at uniform rolls when no pity/chance gate', () => {
    const table = createDropTable(TABLE);
    const zero: Record<MyKind, number> = { medikit: 0, ammo: 0, bomb: 0 };
    const counts: Record<string, number> = {};
    const N = 200;
    for (let i = 0; i < N; i++) {
      const roll = i / N;
      const out = rollDrop(table, roll, 0.0, 1.0, zero, {});
      counts[out.item] = (counts[out.item] ?? 0) + 1;
    }
    expect(counts.ammo ?? 0).toBeGreaterThan(counts.medikit ?? 0);
  });
});
