import { describe, expect, it } from 'bun:test';
import { createCollectibleRegistry } from '../src/index.js';

const IDS = ['shard-1', 'shard-2', 'shard-3'] as const;
type ShardId = (typeof IDS)[number];
const CAPSTONE = 'mirror-complete' as const;

describe('createCollectibleRegistry — initial state', () => {
  const reg = createCollectibleRegistry<ShardId | 'mirror-complete'>([...IDS], CAPSTONE);

  it('all contains all ids', () => {
    expect([...reg.all]).toEqual([...IDS]);
  });

  it('unlocked is empty', () => {
    expect(reg.unlocked.size).toBe(0);
  });

  it('isComplete is false', () => {
    expect(reg.isComplete).toBe(false);
  });

  it('isCapstone is false', () => {
    expect(reg.isCapstone).toBe(false);
  });

  it('capstoneId is set', () => {
    expect(reg.capstoneId).toBe(CAPSTONE);
  });
});

describe('createCollectibleRegistry — unlock', () => {
  it('returns new instance, original unchanged', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    const reg2 = reg.unlock('shard-1');
    expect(reg.unlocked.size).toBe(0);
    expect(reg2.unlocked.has('shard-1')).toBe(true);
  });

  it('idempotent: unlocking same id twice', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    const r1 = reg.unlock('shard-1');
    const r2 = r1.unlock('shard-1');
    expect(r1).toBe(r2);
  });

  it('throws on unknown id', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    expect(() => reg.unlock('ghost' as ShardId)).toThrow();
  });
});

describe('createCollectibleRegistry — capstone auto-unlock', () => {
  it('capstone fires on full completion', () => {
    const reg = createCollectibleRegistry<ShardId | 'mirror-complete'>([...IDS], CAPSTONE);
    const final = reg.unlock('shard-1').unlock('shard-2').unlock('shard-3');
    expect(final.isComplete).toBe(true);
    expect(final.isCapstone).toBe(true);
    expect(final.unlocked.has(CAPSTONE)).toBe(true);
  });

  it('capstone not fired before all ids unlocked', () => {
    const reg = createCollectibleRegistry<ShardId | 'mirror-complete'>([...IDS], CAPSTONE);
    const partial = reg.unlock('shard-1').unlock('shard-2');
    expect(partial.isCapstone).toBe(false);
    expect(partial.isComplete).toBe(false);
  });

  it('no capstone when capstoneId is undefined', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    const final = reg.unlock('shard-1').unlock('shard-2').unlock('shard-3');
    expect(final.isComplete).toBe(true);
    expect(final.capstoneId).toBeNull();
    expect(final.isCapstone).toBe(false);
  });
});

describe('createCollectibleRegistry — partition', () => {
  it('empty: all in missing', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    const { have, missing } = reg.partition();
    expect(have).toHaveLength(0);
    expect(missing).toEqual([...IDS]);
  });

  it('partial unlock', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    const reg2 = reg.unlock('shard-1');
    const { have, missing } = reg2.partition();
    expect(have).toContain('shard-1');
    expect(missing).toContain('shard-2');
    expect(missing).toContain('shard-3');
  });

  it('capstone excluded from partition (not in all)', () => {
    const reg = createCollectibleRegistry<ShardId | 'mirror-complete'>([...IDS], CAPSTONE);
    const final = reg.unlock('shard-1').unlock('shard-2').unlock('shard-3');
    const { have, missing } = final.partition();
    expect(have).not.toContain(CAPSTONE);
    expect(missing).not.toContain(CAPSTONE);
  });
});

describe('createCollectibleRegistry — list', () => {
  it('returns ids in insertion order', () => {
    const reg = createCollectibleRegistry<ShardId>([...IDS]);
    expect(reg.list()).toEqual([...IDS]);
  });
});

describe('createCollectibleRegistry — duplicate id throws', () => {
  it('throws on duplicate', () => {
    expect(() => createCollectibleRegistry(['a', 'a'] as const)).toThrow();
  });
});

describe('createCollectibleRegistry — PT shard pattern', () => {
  it('mirrors shardCodexUnlocksForZoneClear: unlock z1..z7 → capstone fires on last', () => {
    type ZoneId = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'z7';
    const zones: ZoneId[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];
    let reg = createCollectibleRegistry<ZoneId | 'mirror-whole'>(zones, 'mirror-whole');
    for (let i = 0; i < 6; i++) {
      reg = reg.unlock(zones[i] as ZoneId);
      expect(reg.isCapstone).toBe(false);
    }
    reg = reg.unlock('z7');
    expect(reg.isCapstone).toBe(true);
    expect(reg.isComplete).toBe(true);
  });
});
