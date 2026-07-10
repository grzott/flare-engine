import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { MaxRectsPacker } from 'maxrects-packer';
import sharp from 'sharp';
import type { AtlasFrame, AtlasPackerOptions, AtlasResult } from './types.js';

interface SpriteInput {
  name: string;
  path: string;
  width: number;
  height: number;
}

function absPath(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

async function listPngs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (extname(e.name).toLowerCase() === '.png') result.push(join(dir, e.name));
  }
  result.sort();
  return result;
}

async function readSprite(path: string): Promise<SpriteInput> {
  const meta = await sharp(path).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`[pack-atlas] unable to read dimensions for ${path}`);
  }
  return {
    name: basename(path, extname(path)),
    path,
    width: meta.width,
    height: meta.height,
  };
}

/**
 * Pack a directory of PNG sprites into a single TexturePacker-compatible
 * atlas (JSON + image) consumable by `@flare-engine/assets`.
 */
export async function packAtlas(opts: AtlasPackerOptions): Promise<AtlasResult> {
  const inputDir = absPath(opts.input);
  const outDir = absPath(opts.out ?? opts.input);
  const name = opts.name ?? 'atlas';
  const padding = opts.padding ?? 2;
  const maxSize = opts.maxSize ?? 2048;
  const format = opts.format ?? 'png';

  await mkdir(outDir, { recursive: true });

  const files = await listPngs(inputDir);
  if (files.length === 0) {
    throw new Error(`[pack-atlas] no .png files found in ${inputDir}`);
  }

  const sprites: SpriteInput[] = [];
  for (const f of files) sprites.push(await readSprite(f));

  const packer = new MaxRectsPacker(maxSize, maxSize, padding, {
    smart: true,
    pot: false,
    square: false,
    allowRotation: false,
    tag: false,
    border: 0,
  });
  for (const s of sprites) packer.add(s.width, s.height, s);

  if (packer.bins.length !== 1) {
    throw new Error(
      `[pack-atlas] sprites do not fit in a single ${maxSize}x${maxSize} atlas (got ${packer.bins.length} bins)`,
    );
  }
  const bin = packer.bins[0];
  if (!bin) throw new Error('[pack-atlas] packing produced no bin');

  const atlasWidth = bin.width;
  const atlasHeight = bin.height;

  const frames: AtlasFrame[] = [];
  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const rect of bin.rects) {
    const sprite = rect.data as SpriteInput;
    const buf = await readFile(sprite.path);
    composites.push({ input: buf, left: rect.x, top: rect.y });
    frames.push({
      name: sprite.name,
      x: rect.x,
      y: rect.y,
      w: sprite.width,
      h: sprite.height,
    });
  }
  frames.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const imageName = `${name}.${format}`;
  const jsonName = `${name}.json`;
  const imagePath = join(outDir, imageName);
  const jsonPath = join(outDir, jsonName);

  let pipeline = sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites);
  pipeline = format === 'webp' ? pipeline.webp() : pipeline.png();
  await pipeline.toFile(imagePath);

  // TexturePacker-compatible JSON (hash format).
  const jsonFrames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (const f of frames) {
    jsonFrames[f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h } };
  }
  const jsonDoc = {
    frames: jsonFrames,
    meta: {
      app: '@flare-engine/cli',
      version: '1.0',
      image: imageName,
      format: 'RGBA8888',
      size: { w: atlasWidth, h: atlasHeight },
      scale: '1',
    },
  };
  await writeFile(jsonPath, `${JSON.stringify(jsonDoc, null, 2)}\n`, 'utf8');

  return {
    jsonPath,
    imagePath,
    frames,
    width: atlasWidth,
    height: atlasHeight,
  };
}
