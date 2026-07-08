---
"@flare-engine/render": minor
"@flare-engine/react": patch
---

render: shader-effect + z-order correctness. water/fog/fire SkSL are now source-free procedural overlays fed real sprite resolution (previously declared an unbound `uniform shader src` child and hardcoded resolution 0 → could not render on a real backend); `SpriteBatch.flush` groups maximal consecutive runs keyed on `(image, effect, alpha, stretch)`, preserving global z-order across interleaved textures; the stretch draw path now applies sprite effects (was alpha-only) with an outline fall-back; `Camera2D` dead-zone follow no longer double-counts the target offset. `GameView` (react) now forwards the real `GameLoop.clock.elapsed` to `beginFrame` so time-driven shaders animate (was hardcoded 0).
