import { describe, expect, it, mock } from 'bun:test';

// Import createProceduralAtlas directly from src to bypass any @flare-engine/assets
// package-level mock left by earlier test files (game-view, safe-area, virtual-controls
// all replace the package with a partial stub via mock.module).
const { createProceduralAtlas } = await import('../../assets/src/procedural-atlas.js');

// Canvas call recorder — used by the integration test below.
const drawRectCalls: Array<{ rect: unknown; paint: unknown }> = [];

const fakeCanvas = {
  drawRect: (rect: unknown, paint: unknown) => {
    drawRectCalls.push({ rect, paint });
  },
};
const fakeImage = { width: () => 4, height: () => 2, readPixels: () => null };
const fakeSurface = {
  getCanvas: () => fakeCanvas,
  makeImageSnapshot: () => fakeImage,
};

// Build the Skia stub ONCE so we can reference it in the identity assertion.
const mockSkia = {
  Surface: { Make: (_w: number, _h: number) => fakeSurface },
  Paint: () => ({ setColor: (_c: unknown) => {} }),
  XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h }),
};

// Register mock BEFORE the dynamic import so the module-level `Skia` reference
// in skia-atlas.ts picks up the stub.
mock.module('@shopify/react-native-skia', () => ({
  Skia: mockSkia,
}));

const { skiaAtlasModule } = await import('../src/skia-atlas.js');

describe('skiaAtlasModule identity', () => {
  it('is the exact same reference as the mocked Skia module (pure pass-through)', () => {
    // skia-atlas.ts does: `export const skiaAtlasModule = Skia as unknown as SkiaAtlasModuleLike`.
    // The cast is erased at runtime, so skiaAtlasModule === the Skia stub we injected.
    // If react-native-skia renames `Skia`, this would fail at import time — caught here.
    expect(skiaAtlasModule).toBe(mockSkia);
  });
});

describe('skiaAtlasModule integration: createProceduralAtlas', () => {
  it('produces the expected sprite frame and invokes the Skia draw surface', () => {
    drawRectCalls.length = 0;

    const atlas = createProceduralAtlas(skiaAtlasModule, [
      { name: 'ship', w: 8, h: 12, color: 0xff0000ff },
    ]);

    // Frame metadata is correct.
    expect(atlas.sheet.frames).toHaveLength(1);
    expect(atlas.sheet.frames[0]?.name).toBe('ship');
    expect(atlas.sheet.frames[0]?.w).toBe(8);
    expect(atlas.sheet.frames[0]?.h).toBe(12);

    // The Skia canvas was actually used — drawRect called once per frame.
    // This would fail if SkiaAtlasModuleLike's Surface/Paint/XYWHRect API changed.
    expect(drawRectCalls.length).toBe(1);

    // Returned image is the fake snapshot — confirms makeImageSnapshot path.
    expect(atlas.image).toBe(fakeImage);
  });

  it('passes the correct frame name for multiple frames', () => {
    drawRectCalls.length = 0;

    const atlas = createProceduralAtlas(skiaAtlasModule, [
      { name: 'a', w: 4, h: 4, color: 0xffff0000 },
      { name: 'b', w: 4, h: 4, color: 0xff00ff00 },
    ]);

    expect(atlas.sheet.frames.map((f) => f.name)).toEqual(['a', 'b']);
    // One drawRect per frame.
    expect(drawRectCalls.length).toBe(2);
  });
});
