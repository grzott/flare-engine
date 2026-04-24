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

## `createPostFxController` (Phase 11.14)

Game-facing bridge: owns the chain + a `PostFxRuntime`, exposes hit-flash and a single a11y motion knob.

```ts
import {
  createPostFxController,
  bloom,
  vignette,
  grayscaleFlash,
} from "@flare-engine/postfx";

const fx = createPostFxController({
  effects: [
    vignette({ id: "vig", strength: 0.35, radius: 0.82 }),
    bloom({ id: "bloom", threshold: 0.72, intensity: 0.5 }),
    grayscaleFlash({ id: "flash", intensity: 0 }),
  ],
  skia: SkiaModule, // pass `null` to keep buildPass() returning [] (unsupported runtime)
  flash: { id: "flash", decay: 4.2 }, // 4.2 / s ≈ 0.24 s fade from 1
});

// per-frame:
fx.update(dt);
const passes = fx.buildPass(width, height); // CompiledPass[] for the renderer

// on player hit:
fx.triggerHitFlash();

// a11y reduced-motion (forwards to chain.setGlobalIntensity):
fx.setMotionScale(reducedMotion ? 0 : 1);
```

## Rules

- Effects are composable but order matters — bloom before vignette, grayscale last.
- `grayscaleFlash` and `chromaticAberration` have a duration — call their `.trigger()` method instead of rebuilding the chain.
- On devices without RuntimeEffect support (older iOS), the effect `apply()` is a no-op — your visuals degrade gracefully.
- `createPostFxController` is the recommended consumer surface. Build chains directly only if you need fine-grained per-effect timing not covered by the controller.

Spec: [docs/design/api-specs.md § @flare-engine/postfx](../../../docs/design/api-specs.md).
