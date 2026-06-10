# @flare-engine/animation

Functional sprite animation, tweens, and springs. State-object + free-function design (no classes) — tree-shakeable and trivially poolable. `createSpriteAnimator` advances frames against a `SpriteSheet` from `@flare-engine/assets`; `tween` / `spring` produce immutable state mutated by `updateTween` / `updateSpring`; `TweenManager` handles auto-removal on completion.

## Install

```sh
bun add @flare-engine/animation
```

## Usage

```ts
import { createSpriteAnimator, playAnimation, updateAnimator,
         tween, updateTween, easeOutQuad } from '@flare-engine/animation';

const anim = createSpriteAnimator(sheet);
playAnimation(anim, 'walk');
updateAnimator(anim, dt);

const t = tween(0, 100, 0.5, easeOutQuad);
const value = updateTween(t, dt);
```

See [API spec](../../docs/design/api-specs.md#flare-engineanimation--5kb-gzip).

## License

MIT
