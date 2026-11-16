---
"@flare-engine/postfx": patch
---

`runtime.buildPass` (and `PostFxController.buildPass`, which delegates to it) no longer allocates on a frame where the chain's enabled set is unchanged. Each runtime now returns the same array on every call and rewrites its pass objects and their packed `uniforms` buffers in place, walking the chain by index instead of through the `chain.enabled()` generator. It allocates only when a pass slot is added, when a slot needs a `uniforms` buffer of a different length, or when a `color-grading-lut` effect is given a different image (its `children` array is replaced, never written into). An absent optional `color` on a vignette or weather-rain effect no longer allocates a default array.

Behaviour change to be aware of: the array, the pass objects and the `uniforms` buffers returned by one `buildPass` call are overwritten by the next call on the same runtime, including a call with a different chain. Code that keeps a result to compare against a later one must copy it first. `runtime.packUniforms` still returns a new `Float32Array` per call.
