import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convertTiled } from '../src/tiled-to-flare.js';

async function tmp(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'flare-cli-tiled-'));
}

const BASE_TMJ = {
  width: 4,
  height: 2,
  tilewidth: 16,
  tileheight: 16,
  tilesets: [
    {
      firstgid: 1,
      name: 'tiles',
      tilewidth: 16,
      tileheight: 16,
      columns: 4,
      tilecount: 16,
      image: 'tiles.png',
      imagewidth: 64,
      imageheight: 64,
    },
  ],
  layers: [
    {
      type: 'tilelayer',
      name: 'ground',
      width: 4,
      height: 2,
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      visible: true,
      opacity: 1,
    },
    {
      type: 'objectgroup',
      name: 'spawns',
      objects: [
        {
          id: 1,
          name: 'player',
          type: 'spawn',
          x: 32,
          y: 16,
          width: 16,
          height: 16,
          properties: [{ name: 'hp', type: 'int', value: 10 }],
        },
      ],
    },
  ],
};

describe('convertTiled', () => {
  test('converts tile + object layers to normalized JSON', async () => {
    const dir = await tmp();
    const inPath = join(dir, 'map.tmj');
    await writeFile(inPath, JSON.stringify(BASE_TMJ));

    const r = await convertTiled({
      input: inPath,
      out: join(dir, 'map.flare.json'),
    });
    expect(r.outPath).toBe(join(dir, 'map.flare.json'));
    expect(r.layers.length).toBe(2);

    const tile = r.layers[0];
    const obj = r.layers[1];
    expect(tile?.kind).toBe('tile');
    expect(obj?.kind).toBe('object');
    if (tile?.kind !== 'tile' || obj?.kind !== 'object') throw new Error('unexpected');

    expect(tile.data).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(obj.objects[0]?.properties.hp).toBe(10);

    expect(r.tilesets[0]?.image).toBe('tiles.png');

    const written = JSON.parse(await readFile(r.outPath, 'utf8'));
    expect(written.width).toBe(4);
    expect(written.layers.length).toBe(2);
  });

  test('flattens group layers', async () => {
    const dir = await tmp();
    const inPath = join(dir, 'grouped.tmj');
    const doc = {
      ...BASE_TMJ,
      layers: [
        {
          type: 'group',
          name: 'root',
          layers: [
            {
              type: 'tilelayer',
              name: 'nested',
              width: 4,
              height: 2,
              data: [1, 1, 1, 1, 1, 1, 1, 1],
            },
          ],
        },
      ],
    };
    await writeFile(inPath, JSON.stringify(doc));
    const r = await convertTiled({ input: inPath, out: join(dir, 'out.json') });
    expect(r.layers.length).toBe(1);
    expect(r.layers[0]?.name).toBe('nested');
  });

  test('resolves external tilesets when embedTilesets=true', async () => {
    const dir = await tmp();
    const tsPath = join(dir, 'external.json');
    await writeFile(
      tsPath,
      JSON.stringify({
        name: 'external',
        tilewidth: 32,
        tileheight: 32,
        columns: 2,
        tilecount: 4,
        image: 'ext.png',
        imagewidth: 64,
        imageheight: 64,
      }),
    );
    const inPath = join(dir, 'map.tmj');
    await writeFile(
      inPath,
      JSON.stringify({
        ...BASE_TMJ,
        tilesets: [{ firstgid: 1, source: 'external.json' }],
      }),
    );
    const r = await convertTiled({ input: inPath, out: join(dir, 'out.json') });
    expect(r.tilesets[0]?.name).toBe('external');
    expect(r.tilesets[0]?.tilewidth).toBe(32);
    expect(r.tilesets[0]?.firstgid).toBe(1);
  });

  test('drops image/editor-only layers', async () => {
    const dir = await tmp();
    const inPath = join(dir, 'map.tmj');
    const doc = {
      ...BASE_TMJ,
      layers: [
        {
          type: 'tilelayer',
          name: 'a',
          width: 4,
          height: 2,
          data: [0, 0, 0, 0, 0, 0, 0, 0],
        },
        { type: 'imagelayer', name: 'bg' },
      ],
    };
    await writeFile(inPath, JSON.stringify(doc));
    const r = await convertTiled({ input: inPath, out: join(dir, 'o.json') });
    expect(r.layers.length).toBe(1);
    expect(r.layers[0]?.name).toBe('a');
  });
});
