# A postfx pass

How to run a `@flare-engine/postfx` effect chain over a `GameView` scene, change it at runtime, and fire a hit flash.

No `@flare-engine/create` template uses postfx. Add the package to a scaffolded app (`bun add @flare-engine/postfx`) or import the same names from `@flare-engine/engine`, which re-exports them; its only peer, `@shopify/react-native-skia`, is already there.

---

## Build the chain and the runtime once

An `EffectChain` is an ordered list of effects; the passes run in chain order. Each `create*` factory returns an `Effect` — `{ id, enabled: true, uniforms }` with defaults for anything you leave out — and duplicate ids throw. `createPostFxRuntime(skia)` compiles each effect kind's SkSL the first time a pass needs it and caches the result. `Skia` from `@shopify/react-native-skia` satisfies the structural `SkiaPostFxModuleLike` it takes.

```ts
import {
  createCrt,
  createGrayscaleFlash,
  createPostFxRuntime,
  createVignette,
  EffectChain,
} from '@flare-engine/postfx';
import { Skia } from '@shopify/react-native-skia';

export const chain = new EffectChain();
chain.add(createVignette('vignette', { intensity: 0.4 }));
chain.add(createGrayscaleFlash('flash', { intensity: 0 }));
chain.add(createCrt('crt', { scanlineIntensity: 0.3 }));

export const runtime = createPostFxRuntime(Skia);
```

Build both once — at module scope as here, or in a `useRef` / `useMemo` — never inside a render hook: a chain built per frame allocates, and a runtime built per frame recompiles every shader.

---

## Bind it every frame

`GameView` calls `GameConfig.onRenderPostFx(ctx, canvas, bridge)` once per frame, after the sprite batch is flushed and before the frame ends. The hook's job is one call: `bridge.setPostFxBinding(runtime, chain)`. The binding lasts for the current frame only — `beginFrame` clears it — so this is a per-frame call, not a one-time registration; a hook that binds once and then skips renders an unfiltered scene from the next frame on.

```tsx
import type { EffectChain, PostFxRuntime } from '@flare-engine/postfx';
import type { GameConfig } from '@flare-engine/react';
import { GameView } from '@flare-engine/react';
import { useMemo } from 'react';

// From the previous section.
declare const chain: EffectChain;
declare const runtime: PostFxRuntime;

export function App() {
  // GameView reads `config` once on mount — keep the object stable.
  const config = useMemo<GameConfig>(
    () => ({
      onRenderPostFx: (_ctx, _canvas, bridge) => {
        bridge?.setPostFxBinding(runtime, chain);
      },
    }),
    [],
  );

  return <GameView config={config} />;
}
```

After the frame is recorded, `GameView` resolves the bound runtime and chain and builds one pass per enabled effect. On native each pass becomes a `<RuntimeShader>` filter on the scene image (a pass with extra sampler children, such as the colour-grading LUT, is mounted as a nested `<Shader>` instead); the pass list is pushed to React only when an id, a shader, a child image or a uniform value changed, so a static chain costs no re-render. On web the same binding is compiled at physical pixels and composited inside the scene capture before the frame is shown; no shader node is mounted. `bridge` is typed nullable for render paths without Skia; `GameView` always creates one today.

---

## Change it at runtime

Everything below is a plain write on the chain and shows on the next frame, because the passes are rebuilt from the chain every frame.

```ts
import type { EffectChain } from '@flare-engine/postfx';

declare const chain: EffectChain;

// A disabled effect is skipped when the passes are built. Nothing else changes.
chain.setEnabled('crt', false);

// setUniforms replaces the uniforms object whole: pass every field, and `kind`
// must match the effect's kind — a mismatch throws.
chain.setUniforms('vignette', { kind: 'vignette', intensity: 0.6, radius: 0.7 });

// Scale every effect's strength uniform at once (reduced motion); 0 neutralises them.
chain.setGlobalIntensity(0.5);
```

`setGlobalIntensity` scales only strength-like uniforms (`intensity`, `amount`, `scanlineIntensity`); geometry such as `radius`, `curvature` and `threshold` is left alone.

---

## A hit flash with the controller

`createPostFxController` owns a chain and a runtime and adds the game-common conveniences on top: a hit flash that spikes a `grayscale-flash` effect to 1 and decays it, timed one-shot effects, and a motion scale. Bind `fx.runtime` and `fx.chain` in `onRenderPostFx` exactly as above, and advance it from `onUpdate`.

```ts
import {
  createCrt,
  createGrayscaleFlash,
  createPostFxController,
  createVignette,
} from '@flare-engine/postfx';
import type { GameContextValue } from '@flare-engine/react';
import { Skia } from '@shopify/react-native-skia';

declare const ctx: GameContextValue;

export const fx = createPostFxController({
  effects: [createVignette('vignette'), createGrayscaleFlash('flash'), createCrt('crt')],
  skia: Skia,
  flash: { id: 'flash' }, // must name a grayscale-flash effect in `effects`
});

ctx.loop.onUpdate.add((dt) => fx.update(dt));

export function onPlayerHit(): void {
  fx.triggerHitFlash();
}

export function onBossPhase(): void {
  fx.triggerTimed('crt', 800); // enable for 800 ms, then restore and disable
}
```

`triggerHitFlash()` sets the flash intensity to 1; each `update(dt)` lowers it by `flash.decay` per second (default 4.2, so a flash fades in about a quarter second). The flash pass stays enabled at intensity 0 in between — the controller never toggles its `enabled` flag. `triggerTimed(id, ms)` snapshots the effect's uniforms, enables it, and on expiry restores the snapshot and disables it; re-triggering before expiry resets the countdown. `setMotionScale(k)` forwards to `chain.setGlobalIntensity`.

---

## Without RuntimeEffect

`createPostFxRuntime` reports `supported: false` when the module is `null` or has no `RuntimeEffect.Make` function. An unsupported runtime builds no passes, so `GameView` draws the scene exactly as it would with no chain bound — nothing in game code needs to branch. Read `supported` only for UI, such as hiding an effects toggle in settings.

```ts
import { createPostFxRuntime, type SkiaPostFxModuleLike } from '@flare-engine/postfx';

declare const skia: SkiaPostFxModuleLike | null;

const runtime = createPostFxRuntime(skia);

/** False on a device without RuntimeEffect: every frame renders unfiltered. */
export const effectsAvailable = runtime.supported;
```

A single effect whose SkSL fails to compile (`RuntimeEffect.Make` returns `null`) is skipped with a one-time `console.warn`; the rest of the chain still runs.
