/**
 * Geometric upgrade track with an immutable buy operation.
 * price(level) = round(base × growth^level) — the next-level cost from `level`.
 * Consolidates the common geometric-cost upgrade pattern.
 */

export interface UpgradeTrackConfig {
  /** Base price at level 0 → 1. */
  readonly base: number;
  /** Multiplicative growth factor per level. */
  readonly growth: number;
  /** Hard level cap (inclusive). */
  readonly cap: number;
}

export interface UpgradeBuyResult {
  readonly ok: boolean;
  readonly wallet: number;
  readonly level: number;
}

export interface UpgradeTrack {
  readonly config: UpgradeTrackConfig;
  /**
   * Cost to advance from `currentLevel` to `currentLevel + 1`.
   * Returns Infinity when at or above cap.
   */
  price(currentLevel: number): number;
  /** Whether `wallet` is sufficient and `currentLevel` is below cap. */
  canBuy(wallet: number, currentLevel: number): boolean;
  /**
   * Pure spend: deduct `price(currentLevel)` from `wallet` and return
   * the new state. Returns `{ ok: false, wallet, level }` when blocked.
   */
  buy(wallet: number, currentLevel: number): UpgradeBuyResult;
  /**
   * Fold all per-level stat deltas into a running accumulator.
   * `getLevel` is a caller-supplied reader so the resolver is unit-testable
   * without any save/store dep. `deltas` maps a stat key to the per-level delta;
   * `base` is the starting value for each key.
   * Returns a plain Record with the accumulated values.
   */
  resolveStats<K extends string>(
    base: Record<K, number>,
    deltas: Record<K, number>,
    getLevel: (key: K) => number,
  ): Record<K, number>;
}

/**
 * Returns an `UpgradeTrack` backed by `config`.
 * The returned object is a plain object (no class) — safe to freeze or copy.
 */
export function createUpgradeTrack(config: UpgradeTrackConfig): UpgradeTrack {
  function price(currentLevel: number): number {
    if (currentLevel >= config.cap) return Number.POSITIVE_INFINITY;
    return Math.round(config.base * config.growth ** currentLevel);
  }

  function canBuy(wallet: number, currentLevel: number): boolean {
    if (currentLevel >= config.cap) return false;
    return wallet >= price(currentLevel);
  }

  function buy(wallet: number, currentLevel: number): UpgradeBuyResult {
    if (!canBuy(wallet, currentLevel)) {
      return { ok: false, wallet, level: currentLevel };
    }
    return { ok: true, wallet: wallet - price(currentLevel), level: currentLevel + 1 };
  }

  function resolveStats<K extends string>(
    base: Record<K, number>,
    deltas: Record<K, number>,
    getLevel: (key: K) => number,
  ): Record<K, number> {
    const out = {} as Record<K, number>;
    for (const key of Object.keys(base) as K[]) {
      const level = Math.max(0, Math.floor(getLevel(key)));
      out[key] = (base[key] ?? 0) + (deltas[key] ?? 0) * level;
    }
    return out;
  }

  return { config, price, canBuy, buy, resolveStats };
}
