import type { GameContextValue, Scene } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface AchievementEntry {
  id: string;
  nameKey: string;
  descKey: string;
  hint: 'always' | 'on-unlock';
}

export interface AchievementPartition {
  unlocked: AchievementEntry[];
  locked: AchievementEntry[];
}

export const ACHIEVEMENT_ENTRIES: readonly AchievementEntry[] = [
  {
    id: 'first_shard',
    nameKey: 'achievements.first_shard.name',
    descKey: 'achievements.first_shard.desc',
    hint: 'always',
  },
  {
    id: 'no_bomb_boss',
    nameKey: 'achievements.no_bomb_boss.name',
    descKey: 'achievements.no_bomb_boss.desc',
    hint: 'always',
  },
  {
    id: 'all_shards',
    nameKey: 'achievements.all_shards.name',
    descKey: 'achievements.all_shards.desc',
    hint: 'always',
  },
  {
    id: 'three_ships',
    nameKey: 'achievements.three_ships.name',
    descKey: 'achievements.three_ships.desc',
    hint: 'on-unlock',
  },
  {
    id: 'iskry_master',
    nameKey: 'achievements.iskry_master.name',
    descKey: 'achievements.iskry_master.desc',
    hint: 'on-unlock',
  },
  {
    id: 'piorun_master',
    nameKey: 'achievements.piorun_master.name',
    descKey: 'achievements.piorun_master.desc',
    hint: 'on-unlock',
  },
  {
    id: 'sol_master',
    nameKey: 'achievements.sol_master.name',
    descKey: 'achievements.sol_master.desc',
    hint: 'on-unlock',
  },
  {
    id: 'pentagram_master',
    nameKey: 'achievements.pentagram_master.name',
    descKey: 'achievements.pentagram_master.desc',
    hint: 'on-unlock',
  },
  {
    id: 'no_hit_z1',
    nameKey: 'achievements.no_hit_z1.name',
    descKey: 'achievements.no_hit_z1.desc',
    hint: 'always',
  },
  {
    id: 'twelve_enemies',
    nameKey: 'achievements.twelve_enemies.name',
    descKey: 'achievements.twelve_enemies.desc',
    hint: 'always',
  },
  {
    id: 'karczma_perfect',
    nameKey: 'achievements.karczma_perfect.name',
    descKey: 'achievements.karczma_perfect.desc',
    hint: 'on-unlock',
  },
  {
    id: 'rome_condition',
    nameKey: 'achievements.rome_condition.name',
    descKey: 'achievements.rome_condition.desc',
    hint: 'on-unlock',
  },
];

export function filterAchievements(
  all: readonly AchievementEntry[],
  unlocked: readonly string[],
): AchievementPartition {
  const unlockedSet = new Set(unlocked);
  const result: AchievementPartition = { unlocked: [], locked: [] };
  for (const entry of all) {
    if (unlockedSet.has(entry.id)) {
      result.unlocked.push(entry);
    } else {
      result.locked.push(entry);
    }
  }
  return result;
}

export function createAchievementsScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'achievements',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'achievements';
      notifyStateChanged();
    },
  });
}
