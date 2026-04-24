---
name: flare-share
description: Deep knowledge of the @flare-engine/share package — captureScreenshot, shareImage, shareText, Web Share API + expo-sharing fallback. Use when implementing screenshot capture or OS share-sheet integration in a Flare game.
---

# `@flare-engine/share`

Layer 2.5. Thin wrapper over Skia `makeImageSnapshot` + Web Share API + `expo-sharing`.

## Exports

```ts
import {
  captureScreenshot,
  type CaptureOptions,
  shareImage,
  shareText,
  type ShareOptions,
} from "@flare-engine/share";
```

## Usage sketch

```ts
const png = await captureScreenshot({
  canvas: renderer.canvas,
  format: "png",
  quality: 0.9,
});
await shareImage({ data: png, mimeType: "image/png", title: "High score!" });
await shareText({
  text: "Beat level 3 in Flare",
  url: "https://flare-engine.dev",
});
```

## `createScreenshotScene` (Phase 11.14 / M9.6)

Batch-capture store-page screenshots (Play / App Store / Steam) at fixed dimensions. Pure orchestration — the pixel push is owned by the renderer; this controller decides _when_ and _at what size_.

```ts
import { createScreenshotScene } from "@flare-engine/share";

const scene = createScreenshotScene({
  source: renderer.surface, // exposes makeImageSnapshot
  targets: [
    { id: "play_1", width: 1080, height: 1920 },
    { id: "play_feature", width: 1024, height: 500 },
    { id: "appstore_67", width: 1290, height: 2796, format: "jpeg", quality: 0.92 },
  ],
  setup: async (target) => {
    // stage the camera, mute HUD, pause the sim, etc.
    camera.fitTo(target.width, target.height);
    hud.setHidden(true);
    await new Promise(queueMicrotask); // wait one frame to settle
  },
  defaults: { format: "png" },
});

const all = await scene.captureAll();
const one = await scene.capture("play_feature");
```

`capture(id)` returns `null` for unknown ids or failed captures. `setup` may be async so callers can wait for a next-frame settle.

## Rules

- On web, falls back gracefully when `navigator.share` is unavailable (resolves with `{ dismissed: true }`).
- On native, uses `expo-sharing` as peer dep. Don't add a hard require — check availability via the injected module interface.
- `captureScreenshot` works only inside an active `Renderer.begin()` / `end()` pair — the canvas is ephemeral otherwise.
- `createScreenshotScene` is the canonical store-asset workflow — prefer it over hand-rolling `captureScreenshot` loops.

Spec: [docs/design/api-specs.md § @flare-engine/share](../../../docs/design/api-specs.md).
