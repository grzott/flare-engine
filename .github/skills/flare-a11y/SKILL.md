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

## Rules

- Respect the flag — don't gate cosmetic shake/flash/CRT effects on anything else.
- Consumers should wire the OS flag into the provider; the package never polls native APIs itself.

Spec: [docs/design/api-specs.md § @flare-engine/a11y](../../../docs/design/api-specs.md).
