import { describe, expect, it } from 'bun:test';
import { createUpgradeTrack } from '../src/index.js';

const track = createUpgradeTrack({ base: 500, growth: 1.5, cap: 10 });

describe('createUpgradeTrack — price', () => {
  it('level 0 returns base', () => {
    expect(track.price(0)).toBe(500);
  });

  it('level 1 = round(base * growth^1)', () => {
    expect(track.price(1)).toBe(Math.round(500 * 1.5));
  });

  it('level 3 = round(base * growth^3)', () => {
    expect(track.price(3)).toBe(Math.round(500 * 1.5 ** 3));
  });

  it('at cap returns Infinity', () => {
    expect(track.price(10)).toBe(Number.POSITIVE_INFINITY);
  });

  it('above cap returns Infinity', () => {
    expect(track.price(99)).toBe(Number.POSITIVE_INFINITY);
  });

  it('matches PT formula byte-for-byte: round(base * growth^level)', () => {
    for (let l = 0; l < 10; l++) {
      const ptRef = Math.round(500 * 1.5 ** l);
      expect(track.price(l)).toBe(ptRef);
    }
  });
});

describe('createUpgradeTrack — canBuy', () => {
  it('returns false when at cap', () => {
    expect(track.canBuy(999999, 10)).toBe(false);
  });

  it('returns false when wallet insufficient', () => {
    expect(track.canBuy(499, 0)).toBe(false);
  });

  it('returns true when wallet exactly meets price', () => {
    expect(track.canBuy(500, 0)).toBe(true);
  });

  it('returns true with surplus wallet', () => {
    expect(track.canBuy(10000, 3)).toBe(true);
  });
});

describe('createUpgradeTrack — buy', () => {
  it('blocked when at cap', () => {
    const r = track.buy(99999, 10);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(99999);
    expect(r.level).toBe(10);
  });

  it('blocked when wallet insufficient', () => {
    const r = track.buy(100, 0);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(100);
    expect(r.level).toBe(0);
  });

  it('successful buy deducts price and increments level', () => {
    const price0 = track.price(0);
    const r = track.buy(1000, 0);
    expect(r.ok).toBe(true);
    expect(r.wallet).toBe(1000 - price0);
    expect(r.level).toBe(1);
  });

  it('wallet-neutral on block — mirrors PT buyShipUpgrade guard', () => {
    const wallet = 499;
    const r = track.buy(wallet, 0);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(wallet);
  });
});

describe('createUpgradeTrack — resolveStats', () => {
  it('zero level: stat stays at base', () => {
    const r = track.resolveStats({ hp: 100 }, { hp: 15 }, () => 0);
    expect(r.hp).toBe(100);
  });

  it('level 3: base + delta * 3', () => {
    const r = track.resolveStats({ hp: 100 }, { hp: 15 }, () => 3);
    expect(r.hp).toBe(145);
  });

  it('negative level clamped to 0', () => {
    const r = track.resolveStats({ hp: 100 }, { hp: 15 }, () => -5);
    expect(r.hp).toBe(100);
  });

  it('multiple keys resolved independently', () => {
    const r = track.resolveStats({ hp: 100, speed: 1.0 }, { hp: 15, speed: 0.03 }, (k) =>
      k === 'hp' ? 2 : 5,
    );
    expect(r.hp).toBe(130);
    expect(r.speed).toBeCloseTo(1.15, 10);
  });

  it('matches PT effectiveShipStats pattern', () => {
    const base = { hp: 100, speed: 1.0 };
    const deltas = { hp: 15, speed: 0.03 };
    const levels = { hp: 4, speed: 3 };
    const r = track.resolveStats(base, deltas, (k) => levels[k as keyof typeof levels] ?? 0);
    expect(r.hp).toBe(100 + 15 * 4);
    expect(r.speed).toBeCloseTo(1.0 + 0.03 * 3, 10);
  });
});
