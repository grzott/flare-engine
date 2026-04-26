/**
 * Static achievement display list — maps achievement ids to their locale keys.
 * The 12 achievements defined in §14 of the build plan.
 */

export interface AchievementDisplayEntry {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
}

export const ACHIEVEMENTS: readonly AchievementDisplayEntry[] = [
  {
    id: 'first_shard',
    nameKey: 'achievements.first_shard.name',
    descKey: 'achievements.first_shard.desc',
  },
  {
    id: 'no_bomb_boss',
    nameKey: 'achievements.no_bomb_boss.name',
    descKey: 'achievements.no_bomb_boss.desc',
  },
  {
    id: 'all_shards',
    nameKey: 'achievements.all_shards.name',
    descKey: 'achievements.all_shards.desc',
  },
  {
    id: 'three_ships',
    nameKey: 'achievements.three_ships.name',
    descKey: 'achievements.three_ships.desc',
  },
  {
    id: 'iskry_master',
    nameKey: 'achievements.iskry_master.name',
    descKey: 'achievements.iskry_master.desc',
  },
  {
    id: 'piorun_master',
    nameKey: 'achievements.piorun_master.name',
    descKey: 'achievements.piorun_master.desc',
  },
  {
    id: 'sol_master',
    nameKey: 'achievements.sol_master.name',
    descKey: 'achievements.sol_master.desc',
  },
  {
    id: 'pentagram_master',
    nameKey: 'achievements.pentagram_master.name',
    descKey: 'achievements.pentagram_master.desc',
  },
  {
    id: 'no_hit_z1',
    nameKey: 'achievements.no_hit_z1.name',
    descKey: 'achievements.no_hit_z1.desc',
  },
  {
    id: 'twelve_enemies',
    nameKey: 'achievements.twelve_enemies.name',
    descKey: 'achievements.twelve_enemies.desc',
  },
  {
    id: 'karczma_perfect',
    nameKey: 'achievements.karczma_perfect.name',
    descKey: 'achievements.karczma_perfect.desc',
  },
  {
    id: 'rome_condition',
    nameKey: 'achievements.rome_condition.name',
    descKey: 'achievements.rome_condition.desc',
  },
];
