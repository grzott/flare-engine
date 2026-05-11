/**
 * Worked example — Zone 1 (Dachy Krakowa) as a typed visual spec.
 *
 * Data sourced from existing facts:
 *   - palette: visual-spec/zones-palette.ts (zone 1 ambience, hex tokens)
 *   - boss shape: visual-spec/shapes-catalogue.ts → bosses['smok-krzemionkowski']
 *   - HP / phases: docs/visual-reference.md §10
 *   - phase motifs: docs/visual-reference.md §10 boss specs table
 *
 * Author this kind of file *instead of* a Figma slide. The runtime can
 * later consume it; for now it stands as the design brief.
 */

import { THEME_SPEC } from './theme';
import type { ZoneVisualSpec } from './types';

export const zone1: ZoneVisualSpec = {
  id: 1,
  nameKey: 'zones.1.name',
  bg: {
    sky: THEME_SPEC.colors.terracotta, // terracotta
    ground: THEME_SPEC.colors.rust, // rust
    accent: THEME_SPEC.colors.inkBlack, // ink-black
    hazard: THEME_SPEC.colors.gold, // gold
    parallax: [
      { id: 'z1-fire', speed: 0, content: 'fire-shader' },
      { id: 'z1-smoke', speed: 0, content: 'fog-shader' },
    ],
    ambience: { kind: 'ember', count: 32 },
  },
  entityIds: [
    'skrzat',
    'latawiec',
    'smok-krzemionkowski',
    'iskry',
    'piorun',
    'sol-swiecona',
    'znak-pentagramu',
    'czarna-ksiega',
    'siedmiomilowe-buty',
    'amulet-wegrowski',
    'koguci-pioro',
    'srebrna-tarcza',
    'kamien-filozoficzny',
  ],
  boss: {
    id: 'smok-krzemionkowski',
    hpTotal: 800,
    phases: [
      {
        phase: 1,
        accent: THEME_SPEC.colors.terracotta, // terracotta
        bullet: THEME_SPEC.colors.hazard, // hazard
        motif: 'cone-fire sweeps',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: THEME_SPEC.colors.rust, // rust
        bullet: THEME_SPEC.colors.crimson, // crimson
        motif: 'dive-loops with ember trail',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'ember', count: 128 },
    postfx: ['bloom', 'chrom'],
  },
  // No miniboss in Z1 (matches src/config/zones.ts).
};
