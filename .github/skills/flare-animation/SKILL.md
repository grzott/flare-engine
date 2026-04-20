---
name: flare-animation
description: Deep knowledge of the @flare-engine/animation package — createSpriteAnimator, tween, spring, TweenManager, Timeline, 42 easings. Use when playing sprite animations, tweening values, wiring springs, sequencing/staggering animations in Flare.
---

# `@flare-engine/animation`

Layer 3. Functional API — state object + free update function, not class-based, so everything is tree-shakeable.

## Exports

```ts
import {
  createSpriteAnimator,
  playAnimation,
  updateAnimator,
  tween,
  updateTween,
  chainTween,
  spring,
  updateSpring,
  TweenManager,
  addTween,
  updateTweens,
  Timeline,
} from "@flare-engine/animation";
```

## Usage sketch

```ts
const animator = createSpriteAnimator(playerSheet);
playAnimation(animator, "run");
// per frame:
updateAnimator(animator, dt);
sprite.frame = animator.currentFrame;

const hp = tween(100, 0, 1.5, easeOutQuad);
addTween(mgr, hp);
updateTweens(mgr, dt); // auto-removes when complete
```

## Rules

- Animation state is plain objects — pool and reuse them for pooled entities.
- Springs integrate every frame using a semi-implicit Euler step — `dt` above `1/30` can introduce jitter; cap it if you support low FPS.
- `Timeline` sequences multiple tweens; `parallel` and `stagger` live on the same manager.

Spec: [docs/design/api-specs.md § @flare-engine/animation](../../../docs/design/api-specs.md).
