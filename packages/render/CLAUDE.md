# @flare-engine/render — package-specific rules

Layer 2. Depends on `@flare-engine/math`, `@flare-engine/events`, `@flare-engine/core`, `@flare-engine/ecs`, `@flare-engine/assets`. Peer depends on `@shopify/react-native-skia`.

## Frame lifecycle

- `Renderer.canvas` **throws** if accessed outside a `begin()` / `end()` pair. Always guard canvas access behind the active frame.
- `SpriteBatch.flush()` must be called at the end of every frame. A second call in the same frame is a no-op (commands are already drained) — do not depend on it for cleanup.
- `Camera2D.follow(entity)` **replaces** any previous follow target. Call `unfollow()` to stop; do not `follow(null)`.

## Zero-alloc conventions (stricter than repo-wide)

- `sortByDrawOrder` **mutates the input array in place** using insertion sort. It is tuned for nearly-sorted lists (stable frame-to-frame draw order). Do not pass a fresh copy each frame — you will regress from O(n) to O(n²) and lose the point.
- `createRenderSystem` pre-allocates its `entries` array and only shrinks it when the live count is >64 AND less than half the capacity. Do not "fix" the growth/shrink policy without a benchmark — it is intentional to prevent thrashing on variable entity counts.
- Sprite effects (`tint`, `flash`, `grayscale`, `outline`) are **immutable**. `updateEffect(effect, dt)` returns a new effect object — never mutate the existing one. This is so active effects can be held by multiple entities safely.
- `Camera2D` uses exponential smoothing: `factor = 1 - smoothing^dt`. Higher `dt` reduces smoothing strength. Do not convert to linear damping.
- `Camera2D.shake()` uses `pseudoRandom` with an incrementing seed to stay deterministic — do not substitute `Math.random()`.

## Skia integration

- `CanvasLike` is the narrow interface Renderer accepts. Tests mock it; do not import `SkCanvas` directly in this package's hot paths.
- `SpriteBatch.flush()` groups commands by texture identity (reference equality) to match Skia's `Atlas` batching contract. If you introduce texture wrapping/pooling, preserve identity.
