import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { packAtlas } from '../src/pack-atlas.js';

async function makeSprite(path: string, w: number, h: number, r: number, g: number, b: number) {
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r, g, b, alpha: 255 },
    },
  })
    .png()
    .toFile(path);
}

async function setup(): Promise<{ inDir: string; outDir: string }> {
  const base = await mkdtemp(join(tmpdir(), 'flare-cli-pack-'));
  const inDir = join(base, 'in');
  const outDir = join(base, 'out');
  await mkdir(inDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  return { inDir, outDir };
}

describe('packAtlas', () => {
  test('packs sprites into a single atlas JSON + PNG', async () => {
    const { inDir, outDir } = await setup();
    await makeSprite(join(inDir, 'a.png'), 16, 16, 255, 0, 0);
    await makeSprite(join(inDir, 'b.png'), 8, 32, 0, 255, 0);
    await makeSprite(join(inDir, 'c.png'), 24, 8, 0, 0, 255);

    const r = await packAtlas({
      input: inDir,
      out: outDir,
      name: 'atlas',
      padding: 2,
    });

    expect(r.frames.length).toBe(3);
    expect(r.jsonPath).toBe(join(outDir, 'atlas.json'));
    expect(r.imagePath).toBe(join(outDir, 'atlas.png'));
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);

    const frameNames = r.frames.map((f) => f.name).sort();
    expect(frameNames).toEqual(['a', 'b', 'c']);

    const json = JSON.parse(await readFile(r.jsonPath, 'utf8'));
    expect(json.frames.a.frame.w).toBe(16);
    expect(json.frames.b.frame.h).toBe(32);
    expect(json.meta.image).toBe('atlas.png');
    expect(json.meta.size.w).toBe(r.width);

    const outMeta = await sharp(r.imagePath).metadata();
    expect(outMeta.width).toBe(r.width);
    expect(outMeta.height).toBe(r.height);
  });

  test('writes webp output when format=webp', async () => {
    const { inDir, outDir } = await setup();
    await makeSprite(join(inDir, 'x.png'), 8, 8, 128, 128, 128);
    const r = await packAtlas({ input: inDir, out: outDir, format: 'webp' });
    expect(r.imagePath.endsWith('.webp')).toBe(true);
    const meta = await sharp(r.imagePath).metadata();
    expect(meta.format).toBe('webp');
  });

  test('throws when no PNGs in input directory', async () => {
    const { inDir, outDir } = await setup();
    await expect(packAtlas({ input: inDir, out: outDir })).rejects.toThrow(/no \.png files/);
  });

  test('frames are non-overlapping and within atlas bounds', async () => {
    const { inDir, outDir } = await setup();
    for (let i = 0; i < 8; i++) {
      await makeSprite(join(inDir, `s${i}.png`), 10 + i, 10 + i, i * 30, 0, 0);
    }
    const r = await packAtlas({ input: inDir, out: outDir, padding: 2 });
    for (const f of r.frames) {
      expect(f.x + f.w).toBeLessThanOrEqual(r.width);
      expect(f.y + f.h).toBeLessThanOrEqual(r.height);
    }
    for (let i = 0; i < r.frames.length; i++) {
      for (let j = i + 1; j < r.frames.length; j++) {
        const a = r.frames[i];
        const b = r.frames[j];
        if (!a || !b) continue;
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlap).toBe(false);
      }
    }
  });
});
