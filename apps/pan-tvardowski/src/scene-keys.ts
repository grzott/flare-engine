export const SCENE_KEYS = [
  'boot',
  'menu',
  'save-select',
  'settings',
  'credits',
  'inventory',
  'codex-shards',
  'achievements',
  'shop',
  'play',
  'game-over',
  'victory',
] as const;

export type SceneKey = (typeof SCENE_KEYS)[number];
