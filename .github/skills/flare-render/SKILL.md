---
name: flare-render
description: Deep knowledge of the @flare/render package — SpriteBatch, Camera2D, SpriteEffects, BitmapFont, Renderer, createRenderSystem. Use when implementing GPU sprite rendering, viewport/camera control, tint/flash/outline effects, or bitmap text.
---

# @flare/render

GPU sprite rendering via Skia Atlas. Layer 2 — depends on `@flare/core` and `@flare/assets`.

## Exports

```ts
import {
  SpriteBatch,
  Camera2D,
  Renderer,
  createRenderSystem,
  // Effects
  tint, flash, grayscale, outline, updateEffect, flashIntensity,
  // Font
  parseBMFontJSON, measureText, drawText,
} from "@flare/render";
```

---

## SpriteBatch

Batches all sprites into a single Skia Atlas draw call per frame.

```ts
const batch = new SpriteBatch(atlasImage, maxSprites);

// Each frame, inside Skia <Canvas> draw callback:
batch.begin();

batch.draw({
  src:    { x: 0, y: 0, width: 32, height: 32 },  // atlas source rect
  x: 100, y: 200,                                  // world position
  originX: 0.5, originY: 0.5,                      // pivot (0–1)
  scaleX: 1, scaleY: 1,
  rotation: 0,                                     // radians
  alpha: 1,
  color: undefined,                                // optional tint color
});

batch.end(canvas);   // submits single drawAtlas call
batch.stats;         // { drawCalls: 1, spriteCount: n }
```

**Performance:** All sprites use one GPU draw call. Target: 500–2000 sprites at 60 fps on a modern phone.

---

## Camera2D

Tracks a target entity and transforms world→screen coordinates.

```ts
const camera = new Camera2D({
  viewportWidth: 390,
  viewportHeight: 844,
});

// Each frame — smooth follow
camera.follow(targetX, targetY, {
  lerpFactor: 0.1,     // 0 = instant, 1 = no follow
  deadZoneX: 20,       // pixels of slack before follow starts
  deadZoneY: 20,
});

camera.zoom = 1.5;        // uniform zoom
camera.rotation = 0;      // camera tilt (radians)

// Apply to Skia canvas
const matrix = camera.getMatrix();
canvas.concat(matrix);

// Coordinate conversion
const worldPt  = camera.screenToWorld(touchX, touchY);
const screenPt = camera.worldToScreen(entityX, entityY);

// Culling
camera.isVisible(x, y, width, height); // boolean — skip off-screen draw
```

### Shake

```ts
camera.shake({ intensity: 8, duration: 0.4, decay: true });
camera.update(dt); // must be called each frame to advance shake
```

---

## SpriteEffects

Modifiable visual effects applied per sprite.

```ts
import { tint, flash, grayscale, outline, updateEffect, flashIntensity } from "@flare/render";

// Create effects
const myTint      = tint({ r: 255, g: 0, b: 0, a: 255 });  // red tint
const myFlash     = flash(1.0);                              // white flash at full intensity
const myGrayscale = grayscale();
const myOutline   = outline({ r: 255, g: 255, b: 0, a: 255 }, 2); // yellow outline, 2px

// Advance flash over time (fades intensity → 0)
updateEffect(myFlash, dt);
flashIntensity(myFlash); // number 0–1

// Apply to SpriteBatch.draw()
batch.draw({ ..., effects: [myTint, myFlash] });
```

---

## BitmapFont / drawText

Render bitmap font text via SpriteBatch.

```ts
import { parseBMFontJSON, measureText, drawText } from "@flare/render";

const font = parseBMFontJSON(bmFontAtlasJson);

// Measure before draw
const size = measureText(font, "Hello World!", 1.0);
// { width: number, height: number }

// Draw
drawText(batch, font, "Score: 999", x, y, {
  scale: 1,
  align: "center",  // "left" | "center" | "right"
  color: { r: 255, g: 255, b: 255, a: 255 },
});
```

---

## createRenderSystem

ECS integration — reads `Position`+`Sprite` components and calls `SpriteBatch.draw`.

```ts
import { createRenderSystem } from "@flare/render";

const renderSystem = createRenderSystem(batch, camera);

// Each frame
renderSystem.update(world, dt);

// The system reads:
//   Position: { x, y }
//   SpriteData: { src, originX, originY, scaleX, scaleY, rotation, alpha, effects }
// and draws all visible entities to the batch.
```

---

## Renderer

Low-level canvas wrapper passed to systems.

```ts
const renderer = new Renderer(canvas);
renderer.clear({ r: 0, g: 0, b: 0, a: 255 });
renderer.stats; // { drawCalls, spriteCount } accumulated for current frame
renderer.resetStats();
```
