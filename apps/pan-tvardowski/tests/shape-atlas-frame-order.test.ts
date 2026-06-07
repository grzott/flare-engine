import { describe, expect, test } from 'bun:test';
import { buildBulletFrames } from '../src/shape-atlas/bullet-frames';
import { buildParticleFrames } from '../src/shape-atlas/particle-frames';
import { buildPickupFrames } from '../src/shape-atlas/pickup-frames';
import { buildShipFrames } from '../src/shape-atlas/ship-frames';
import { buildTileFrames } from '../src/shape-atlas/tile-frames';

describe('shape-atlas frame order', () => {
  test('frame names are emitted in the exact canonical order', () => {
    const names = [
      ...buildShipFrames(),
      ...buildPickupFrames(),
      ...buildBulletFrames(),
      ...buildParticleFrames(),
      ...buildTileFrames(),
    ].map((f) => f.name);

    expect(names).toEqual([
      // Ships — enemies (14)
      'skrzat',
      'latawiec',
      'czart',
      'bies',
      'licho',
      'strzyga',
      'topielec',
      'mamuna',
      'nocnica',
      'poludnica',
      'wapierz',
      'hound',
      'dziwozona',
      'moon-wraith',
      // Ships — mini-bosses (4)
      'rokita',
      'leszy',
      'nocny-lowca',
      'madej',
      // Ships — bosses (8)
      'smok-krzemionkowski',
      'borowy-krol',
      'wodnik-wislanny',
      'boruta',
      'baba-jaga',
      'bazyliszek-warszawski',
      'mefistofeles',
      'lucyper-ksiezycowy',
      // Ships — player (3)
      'kogut-zloty',
      'alembik',
      'zwierciadlo',
      // Pickups — weapon-swap (4)
      'pickup-iskry',
      'pickup-piorun',
      'pickup-sol-swiecona',
      'pickup-znak-pentagramu',
      // Pickups — upgrade (6)
      'pickup-czarna-ksiega',
      'pickup-siedmiomilowe-buty',
      'pickup-amulet-wegrowski',
      'pickup-koguci-pioro',
      'pickup-srebrna-tarcza',
      'pickup-kamien-filozoficzny',
      // Bullets (5 defs, 6 frames — enemy-bullet emits enemy-bullet-b)
      'iskry-bullet',
      'piorun-bullet',
      'sol-swiecona-bullet',
      'znak-pentagramu-bullet',
      'enemy-bullet',
      'enemy-bullet-b',
      // Particles (2)
      'particle-spark',
      'particle-smoke',
      // Tiles (3)
      'tile-fire',
      'tile-water',
      'tile-fog',
    ]);
  });
});
