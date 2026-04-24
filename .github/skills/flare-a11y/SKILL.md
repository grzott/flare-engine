---
name: flare-a11y
description: Deep knowledge of the @flare-engine/a11y package — reduced-motion flag, contrast tokens, motionScale, dampenedMotion, pickContrast helpers. Use when respecting OS reduced-motion / high-contrast preferences in Flare animations, postfx, and UI.
---

# `@flare-engine/a11y`

Layer 2.5. Light accessibility layer for 0.1.0 — screen-reader integration lands in 0.3.0.

## Exports

```ts
import {
  type A11yContextValue,
  A11yProvider,
  useA11y,
  motionScale,
  dampenedMotion,
  pickContrast,
} from "@flare-engine/a11y";
```

## Usage sketch

```tsx
<A11yProvider reducedMotion={RN.AccessibilityInfo.isReduceMotionEnabled}>
  <GameView config={config} />
</A11yProvider>
```

```ts
const shakeAmt = motionScale(ctx, baseShake); // scales to 0 when reduce-motion is on
const tween = dampenedMotion(ctx, { duration: 0.6 }); // shortens durations
const color = pickContrast(ctx, { normal: "#888", highContrast: "#fff" });
```

## `createA11yBridge` (Phase 11.14)

One-liner wiring of an `A11yManager` into any runtime that exposes `setMotionScale(k)` — typical targets are `Camera2D` (screen-shake amplitude) and `PostFxController` (global effect intensity).

```ts
import { createA11yBridge } from "@flare-engine/a11y";

const a11y = createA11yBridge();
const offCam = a11y.attachCamera(camera); // duck-typed: { setMotionScale(k) }
const offFx = a11y.attachPostfx(fx); // PostFxController matches

// push OS preference in (caller-owned — package never polls native APIs):
import { AccessibilityInfo } from "react-native";
AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
  a11y.manager.update({ reducedMotion: reduce });
});

// on disposal:
offCam();
offFx();
```

`attach`, `attachCamera`, and `attachPostfx` are the same function — the named aliases just document intent. The bridge calls `motionScale(manager.settings)` and pushes the result whenever `manager.onChange` fires; targets receive `1` (full motion) or `0` (reduced) by default.

## Rules

- Respect the flag — don't gate cosmetic shake/flash/CRT effects on anything else.
- Consumers should wire the OS flag into the provider; the package never polls native APIs itself.
- The bridge is duck-typed on `{ setMotionScale(k) }` so `@flare-engine/a11y` keeps zero hard deps on render/postfx.

Spec: [docs/design/api-specs.md § @flare-engine/a11y](../../../docs/design/api-specs.md).
