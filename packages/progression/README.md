# @flare-engine/progression

Meta-progression primitives: geometric upgrade tracks, pity-aware weighted drop rolling, unlock DAG, tier resolution, and collectible-unlock registry. Pure, zero-alloc on hot paths. Depends on `@flare-engine/math`.

## Install

```sh
bun add @flare-engine/progression
```

## Usage

```ts
import {
  createUpgradeTrack,
  createDropTable,
  rollDrop,
  createUnlockDag,
  resolveTier,
  createCollectibleRegistry,
} from '@flare-engine/progression';

// Upgrade track — geometric price curve
const track = createUpgradeTrack({ base: 500, growth: 1.5, cap: 10 });
const price = track.price(3); // 500 * 1.5^3
const wallet = 1000;
const result = track.buy(wallet, 3); // { ok, wallet, level }

// Drop roll with pity — create once, reuse across frames (zero-alloc rollInto)
const entries = [
  { item: 'rare' as const, weight: 8 },
  { item: 'common' as const, weight: 60 },
];
const table = createDropTable(entries);
const pity = { rare: 0, common: 0 };
const thresholds = { rare: 25 };
const isAllowed = (_item: 'rare' | 'common') => true;

// Hot path — zero-alloc in-place roll
const out = { item: 'none' as 'rare' | 'common' | 'none', pity: { ...pity } };
table.rollInto(0.0, 0.0, 0.12, pity, thresholds, isAllowed, out);

// Cold path / test helper — allocating wrapper
const result2 = rollDrop(table, 0.0, 0.0, 0.12, pity, thresholds);

// Unlock DAG
const dag = createUnlockDag([
  { id: 'b', requires: ['a'] },
  { id: 'a', requires: [] },
]);
const frontier = dag.frontier(new Set(['a']));

// Tier resolve
const tier = resolveTier([{ at: 1, tier: 'bronze' }, { at: 10, tier: 'silver' }], 5);

// Collectible registry
const reg = createCollectibleRegistry(['item-1', 'item-2', 'item-3'], 'set-complete');
const reg2 = reg.unlock('item-1').unlock('item-2').unlock('item-3');
reg2.isCapstone; // true
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineprogression).

## License

MIT
