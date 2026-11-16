import { createFrameRenderer, type FrameRenderer, SpriteBatch } from '@flare-engine/render';
import {
  bakeShapeAtlas,
  drawBakedShape,
  type ShapeAtlas,
  type ShapeAtlasSkia,
  type ShapeSpec,
} from '@flare-engine/shapes';
import { type BenchOverrides, type BenchStats, runBench } from './harness.js';
import { SHAPES_DRAW_SCENARIOS, type ShapesDrawScenario } from './scenarios/shapes-draw.js';
import { createCountingSkiaStub, makeStubImage, type SkiaStub } from './skia-stub.js';

const VIEW_W = 800;
const VIEW_H = 600;

/** Fills, strokes, glows, path kinds and a composite: every draw shape a bake replaces. */
const SPEC_POOL: readonly ShapeSpec[] = [
  { kind: 'circle', r: 10, fill: 0xffc9a24a },
  { kind: 'rect', w: 18, h: 8, fill: 0xff4a90c9, stroke: 0xff102030, strokeWidth: 2 },
  { kind: 'triangle', size: 12, fill: 0xffc94a4a, glow: 'hazard' },
  { kind: 'ngon', n: 6, r: 10, fill: 0xff6fa66b },
  { kind: 'star', points: 5, rOuter: 12, rInner: 5, fill: 0xffffd24a, glow: 'friendly' },
  { kind: 'ring', r: 9, stroke: 0xffffffff, strokeWidth: 2 },
  { kind: 'annulus', rOuter: 11, rInner: 7, fill: 0xff8844cc },
  {
    kind: 'ship',
    hull: { kind: 'triangle', size: 14, fill: 0xffc9a24a },
    weapons: [
      { kind: 'rect', w: 3, h: 8, fill: 0xffc9a24a, ox: -8, oy: 4 },
      { kind: 'rect', w: 3, h: 8, fill: 0xffc9a24a, ox: 8, oy: 4 },
    ],
    engine: { kind: 'square', size: 8, fill: 0xff806020 },
  },
];

/**
 * A Skia that draws nothing. The bake runs once in setup and is not what this
 * suite measures; all the per-frame path needs from it is the atlas layout and
 * an image to key the batch on.
 */
function createNoopShapeSkia(): ShapeAtlasSkia {
  const path = { moveTo() {}, lineTo() {}, close() {}, addArc() {} };
  const canvas = {
    save: () => 0,
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    clear() {},
    drawCircle() {},
    drawRect() {},
    drawPath() {},
  };
  return {
    Surface: {
      Make: (w, h) => ({ getCanvas: () => canvas, makeImageSnapshot: () => makeStubImage(w, h) }),
    },
    Paint: () => ({ setColor() {}, setStyle() {}, setStrokeWidth() {} }),
    Path: { Make: () => path, MakeFromSVGString: () => path },
    XYWHRect: () => null,
  };
}

export type ShapesDrawState = {
  readonly atlas: ShapeAtlas;
  readonly n: number;
  readonly batch: SpriteBatch;
  readonly renderer: FrameRenderer;
  readonly stub: SkiaStub;
  /** Sprites queued by the last run, read before the flush empties the batch. */
  queued: number;
};

export function buildShapesDrawState(
  scenario: ShapesDrawScenario,
  strict = false,
): ShapesDrawState {
  const specs: ShapeSpec[] = [];
  for (let i = 0; i < scenario.specs; i++) {
    specs.push(SPEC_POOL[i % SPEC_POOL.length] as ShapeSpec);
  }
  const stub = createCountingSkiaStub({ strict });
  return {
    atlas: bakeShapeAtlas(createNoopShapeSkia(), specs, 2),
    n: scenario.n,
    batch: new SpriteBatch(),
    renderer: createFrameRenderer(stub.module),
    stub,
    queued: 0,
  };
}

/**
 * One frame of baked-shape drawing: queue every instance, flush, finish the
 * picture. Instance `i` draws spec `i % specs` with its own position, rotation
 * and one of four uniform scales, and no colour, so the frame is a single
 * uncoloured run with every transform on the rotated path.
 */
export function shapesDrawRun(state: ShapesDrawState): void {
  const { atlas, n, batch, renderer } = state;
  const specs = atlas.cells.length;
  renderer.beginFrame(VIEW_W, VIEW_H);
  for (let i = 0; i < n; i++) {
    drawBakedShape(
      batch,
      atlas,
      i % specs,
      (i * 37) % VIEW_W,
      (i * 53) % VIEW_H,
      0.1 + i * 0.01,
      0.5 + (i & 3) * 0.25,
    );
  }
  state.queued = batch.count;
  batch.flush(renderer.drawAtlas);
  renderer.endFrame();
}

export function shapesDrawBenches(overrides?: BenchOverrides): BenchStats[] {
  return SHAPES_DRAW_SCENARIOS.map((scenario) =>
    runBench(
      {
        name: scenario.name,
        setup: () => buildShapesDrawState(scenario),
        run: shapesDrawRun,
        innerIters: scenario.innerIters,
      },
      overrides,
    ),
  );
}
