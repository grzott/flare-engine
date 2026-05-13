export const Layer = {
  player: 1 << 0,
  enemy: 1 << 1,
  playerBullet: 1 << 2,
  enemyBullet: 1 << 3,
  pickup: 1 << 4,
} as const;

export const Mask = {
  player: Layer.enemy | Layer.enemyBullet | Layer.pickup,
  enemy: Layer.player | Layer.playerBullet,
  playerBullet: Layer.enemy,
  enemyBullet: Layer.player,
  pickup: Layer.player,
} as const;
