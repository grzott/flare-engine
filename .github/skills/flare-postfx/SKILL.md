---
name: flare-postfx
description: Deep knowledge of the @flare-engine/postfx package — EffectChain, CRT / bloom / chromatic aberration / vignette / grayscale-flash via Skia RuntimeEffect. Use when adding composable post-processing, hit-flash, or retro / scanline visual effects to a Flare game.
---

# `@flare-engine/postfx`

Layer 3.5. Thin wrapper over Skia `RuntimeEffect`. Stateless effect factories + an ordered chain applied to the scene's render target.

## Exports

```ts
import {
  EffectChain,
  crt,
  bloom,
  chromaticAberration,
  vignette,
  grayscaleFlash,
  // type Effect, type EffectFrameData, …
} from "@flare-engine/postfx";
```

## Usage sketch

```ts
const chain = new EffectChain([
  vignette({ strength: 0.4, radius: 0.7 }),
  bloom({ threshold: 0.9, intensity: 1.2 }),
  grayscaleFlash({ duration: 0.25 }), // stateful — trigger on hit
]);
chain.applyTo(canvas, renderTarget, { time, dt });
```

## Rules

- Effects are composable but order matters — bloom before vignette, grayscale last.
- `grayscaleFlash` and `chromaticAberration` have a duration — call their `.trigger()` method instead of rebuilding the chain.
- On devices without RuntimeEffect support (older iOS), the effect `apply()` is a no-op — your visuals degrade gracefully.

Spec: [docs/design/api-specs.md § @flare-engine/postfx](../../../docs/design/api-specs.md).
