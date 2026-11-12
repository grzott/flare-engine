---
"@flare-engine/scene": patch
---

`SceneManager.push()` and `pop()` called while an animated `go()` is still fading out are now ignored, with a one-time dev warning per manager. Before, a `push` of the pending scene entered it without `onInit`, and the scene was then destroyed and initialized again when the fade-out ended; a `pop` after that push destroyed the pending scene, which was still initialized and entered afterwards; and a `pop` of an older scene with the same name could leave the pending scene without `onDestroy` once a later `go()` superseded it. Both calls work again as soon as the target scene has entered.
