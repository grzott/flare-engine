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

## Rules

- On web, falls back gracefully when `navigator.share` is unavailable (resolves with `{ dismissed: true }`).
- On native, uses `expo-sharing` as peer dep. Don't add a hard require — check availability via the injected module interface.
- `captureScreenshot` works only inside an active `Renderer.begin()` / `end()` pair — the canvas is ephemeral otherwise.

Spec: [docs/design/api-specs.md § @flare-engine/share](../../../docs/design/api-specs.md).
