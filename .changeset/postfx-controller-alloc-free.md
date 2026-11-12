---
"@flare-engine/postfx": patch
---

`createPostFxController().triggerTimed` called again while the effect was still timed overwrote the pre-trigger snapshot with the mid-trigger uniforms, so expiry restored those instead. A re-trigger now only restarts the countdown; expiry restores the uniforms the effect had before the first trigger.

`controller.update(dt)` no longer allocates while a flash fades or a timed effect is pending. Once a flash has fired, the flash effect's `uniforms` is one controller-owned object rewritten in place each frame, instead of a new object per frame; the uniforms object the effect was created with is never written to. `EffectChain.get`, and `setEnabled` / `setUniforms` through it, no longer allocate a closure per call.

`runtime.buildPass` still allocates on every frame (#303), so the postfx frame as a whole is not zero-alloc yet.
