/**
 * Worked example — Zone 1 (Dachy Krakowa) as a typed visual spec.
 *
 * Data sourced from existing facts:
 *   - palette: src/palette.ts (zone 1 ambience, hex tokens via theme/colors.ts)
 *   - boss shape: src/shape-catalogue.ts → bosses['smok-krzemionkowski']
 *   - HP / phases: docs/visual-reference.md §10
 *   - phase motifs: docs/visual-reference.md §10 boss specs table
 *
 * Author this kind of file *instead of* a Figma slide. The runtime can
 * later consume it; for now it stands as the design brief.
 */

import type { ZoneVisualSpec } from './types';

export const zone1: ZoneVisualSpec = {
  id: 1,
  nameKey: 'zones.1.name',
  bg: {
    sky: '#B05A3C', // terracotta
    ground: '#8B3A1F', // rust
    accent: '#0E1A12', // ink-black
    hazard: '#C9A24A', // gold
    parallax: [
      { id: 'z1-sky', speed: 0, content: 'tilemap' },
      { id: 'z1-spires', speed: 0.2, content: 'tilemap' },
      { id: 'z1-rooftops', speed: 0.5, content: 'tilemap' },
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
        accent: '#B05A3C', // terracotta
        bullet: '#E84B2A', // hazard
        motif: 'cone-fire sweeps',
        breakTier: 'detonation',
      },
      {
        phase: 2,
        accent: '#8B3A1F', // rust
        bullet: '#D4213D', // crimson
        motif: 'dive-loops with ember trail',
        breakTier: 'cataclysm',
      },
    ],
    particles: { kind: 'ember', count: 128 },
    postfx: ['bloom', 'chrom'],
  },
  // No miniboss in Z1 (matches src/config/zones.ts).
};
