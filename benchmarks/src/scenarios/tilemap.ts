/**
 * Pure-data tilemap scenario matrix — no map, renderer, camera or batch, no
 * closure. Consumed by `../tilemap.bench.ts`, which binds each row to a real
 * `TilemapRenderer` over a generated 256x256 two-layer map.
 *
 * `innerIters` puts one sample near 1.5 ms pinned to P-cores, the window the
 * other suites use; measured 2026-11-12 across five pinned processes.
 */
export type TilemapKind = 'drawInto' | 'getTileAt' | 'decodeGid';

export type TilemapScenario = {
  readonly name: string;
  readonly kind: TilemapKind;
  readonly innerIters: number;
};

export const TILEMAP_SCENARIOS: readonly TilemapScenario[] = [
  {
    name: 'tilemap.drawInto   256x256 x2 layers, 800x600 view',
    kind: 'drawInto',
    innerIters: 22,
  },
  {
    name: 'tilemap.getTileAt  256x256 full-layer scan',
    kind: 'getTileAt',
    innerIters: 20,
  },
  {
    name: 'tilemap.decodeGid     4096 gids, flags + strip',
    kind: 'decodeGid',
    innerIters: 220,
  },
];
