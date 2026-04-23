import { gameEvents } from '../events';
import { getTier2Providers } from './providers';

/**
 * Mount the Tier-2 provider bus. Subscribes to gameplay events and dispatches
 * to analytics / leaderboards / achievements. Called once from `App.tsx`
 * after the providers are ready. Returns an unsubscribe fn for hot-reload /
 * tests.
 *
 * Achievement IDs mirror the build-plan §15 and locale keys:
 *   - `first_shard`    — zone 1 cleared
 *   - `all_shards`     — zone 8 (Lucyper) cleared
 *   - `no_bomb_boss`   — boss defeated without using a bomb (emitted elsewhere)
 *   - `three_ships`    — all three ships unlocked (emitted elsewhere)
 */
export function mountTier2Wiring(): () => void {
  const { analytics, leaderboards, achievements } = getTier2Providers();
  const unsubs: Array<() => void> = [];

  unsubs.push(
    gameEvents.on('zone-start', (zone) => {
      void analytics.track('zone_start', { zone });
    }),
  );

  unsubs.push(
    gameEvents.on('zone-complete', (zone, score) => {
      void analytics.track('zone_complete', { zone, score });
      void leaderboards.submitScore(`zone_${zone}_high_score`, score);
      if (zone === 'z1') void achievements.unlock('first_shard');
      if (zone === 'z8') void achievements.unlock('all_shards');
    }),
  );

  unsubs.push(
    gameEvents.on('miniboss-defeated', (zone) => {
      void analytics.track('miniboss_defeated', { zone });
    }),
  );

  unsubs.push(
    gameEvents.on('boss-phase-change', (zone, phase) => {
      void analytics.track('boss_phase_change', { zone, phase });
    }),
  );

  return () => {
    for (const u of unsubs) u();
  };
}
