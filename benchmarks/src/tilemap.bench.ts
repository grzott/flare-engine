import { Camera2D, SpriteBatch } from '@flare-engine/render';
import { createBenchSession } from '@flare-engine/testing';
import {
  createTilemapData,
  decodeGidFlags,
  getTileAt,
  stripGidFlags,
  type TileLayer,
  type TilemapData,
  TilemapRenderer,
  type TilesetRef,
} from '@flare-engine/tilemap';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { TILEMAP_SCENARIOS, type TilemapScenario } from './scenarios/tilemap.js';
import { makeStubImage } from './skia-stub.js';

const MAP_TILES = 256;
const TILE = 16;
const VIEW_W = 800;
const VIEW_H = 600;
const DECODE_GIDS = 4096;

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

type TileImage = Parameters<TilemapRenderer['setTilesetImage']>[1];

function tileset(name: string, firstGid: number, columns: number, rows: number): TilesetRef {
  return {
    firstGid,
    name,
    tileWidth: TILE,
    tileHeight: TILE,
    columns,
    tileCount: columns * rows,
    image: `${name}.png`,
    imageWidth: columns * TILE,
    imageHeight: rows * TILE,
    tileProperties: new Map(),
    solidTiles: new Set(),
  };
}

function tileLayer(name: string, tiles: Uint32Array): TileLayer {
  return {
    type: 'tile',
    name,
    width: MAP_TILES,
    height: MAP_TILES,
    tiles,
    visible: true,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    properties: {},
  };
}

/**
 * Two tilesets and two layers: a fully painted ground layer and a sparse decor
 * layer drawn from the second tileset, so every visible cell resolves a tileset
 * and a quarter of the decor carries Tiled flip bits, including the diagonal
 * (quarter-turn) case the renderer branches on.
 */
export function buildMap(): TilemapData {
  const session = createBenchSession({ seed: 0x711e });
  try {
    const map = createTilemapData(MAP_TILES, MAP_TILES, TILE, TILE);
    const terrain = tileset('terrain', 1, 16, 16);
    const props = tileset('props', 1 + terrain.tileCount, 8, 8);
    map.tilesets.push(terrain, props);

    const cells = MAP_TILES * MAP_TILES;
    const ground = new Uint32Array(cells);
    const decor = new Uint32Array(cells);
    const flips = [0, FLIP_H, FLIP_V, FLIP_D | FLIP_H];
    for (let i = 0; i < cells; i++) {
      ground[i] = terrain.firstGid + session.rng.int(0, terrain.tileCount - 1);
      if (session.rng.float(0, 1) < 0.25) {
        const flip = flips[session.rng.int(0, flips.length - 1)] as number;
        decor[i] = ((props.firstGid + session.rng.int(0, props.tileCount - 1)) | flip) >>> 0;
      }
    }
    map.layers.push(tileLayer('ground', ground), tileLayer('decor', decor));
    return map;
  } finally {
    session.end();
  }
}

export type DrawState = {
  readonly renderer: TilemapRenderer;
  readonly camera: Camera2D;
  readonly batch: SpriteBatch;
  queued: number;
};

export function buildDrawState(): DrawState {
  const map = buildMap();
  const renderer = new TilemapRenderer(map);
  for (const ts of map.tilesets) {
    renderer.setTilesetImage(ts.name, makeStubImage(ts.imageWidth, ts.imageHeight) as TileImage);
  }
  const camera = new Camera2D();
  camera.setViewport(VIEW_W, VIEW_H);
  camera.x = (MAP_TILES * TILE) / 2;
  camera.y = (MAP_TILES * TILE) / 2;
  return { renderer, camera, batch: new SpriteBatch(), queued: 0 };
}

/**
 * Queues the visible tiles, then hands the commands back to the batch's pool
 * with `clear()`. Flushing would also time `@flare-engine/render`'s run grouping
 * and the frame renderer, which the Render suite already measures; this row is
 * the tilemap's own share of a frame: culling, tileset lookup, source rects and
 * flip decoding.
 */
export function drawRun(state: DrawState): void {
  state.renderer.drawInto(state.camera, state.batch);
  state.queued = state.batch.count;
  state.batch.clear();
}

export type ScanState = { readonly layer: TileLayer; sum: number };

export function buildScanState(): ScanState {
  return { layer: buildMap().layers[0] as TileLayer, sum: 0 };
}

export function scanRun(state: ScanState): void {
  const { layer } = state;
  let sum = 0;
  for (let row = 0; row < layer.height; row++) {
    for (let col = 0; col < layer.width; col++) sum += getTileAt(layer, col, row);
  }
  state.sum = sum;
}

export type DecodeState = { readonly gids: Uint32Array; flags: number; ids: number };

export function buildDecodeState(): DecodeState {
  const decor = (buildMap().layers[1] as TileLayer).tiles;
  const gids = new Uint32Array(DECODE_GIDS);
  let n = 0;
  for (let i = 0; i < decor.length && n < DECODE_GIDS; i++) {
    const gid = decor[i] as number;
    if (gid !== 0) gids[n++] = gid;
  }
  return { gids, flags: 0, ids: 0 };
}

export function decodeRun(state: DecodeState): void {
  const { gids } = state;
  let flags = 0;
  let ids = 0;
  for (let i = 0; i < gids.length; i++) {
    const gid = gids[i] as number;
    const f = decodeGidFlags(gid);
    if (f.horizontal) flags++;
    if (f.vertical) flags++;
    if (f.diagonal) flags++;
    ids += stripGidFlags(gid);
  }
  state.flags = flags;
  state.ids = ids;
}

function benchFor(scenario: TilemapScenario, overrides?: BenchOverrides): BenchStats {
  const { name, innerIters } = scenario;
  switch (scenario.kind) {
    case 'drawInto':
      return runBench({ name, setup: buildDrawState, run: drawRun, innerIters }, overrides);
    case 'getTileAt':
      return runBench({ name, setup: buildScanState, run: scanRun, innerIters }, overrides);
    case 'decodeGid':
      return runBench({ name, setup: buildDecodeState, run: decodeRun, innerIters }, overrides);
  }
}

export function tilemapBenches(overrides?: BenchOverrides): BenchStats[] {
  return TILEMAP_SCENARIOS.map((scenario) => benchFor(scenario, overrides));
}
