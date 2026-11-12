---
"@flare-engine/render": patch
---

The frame renderer now reads a custom shader's uniform layout (uniform names, slots, sizes and float count) once per compiled shader and keeps it in an internal `WeakMap`, instead of asking the shader for it on every sprite run drawn with a `custom` effect. The uniform array handed to `makeShader` is unchanged, and `makeShader` itself still runs once per run. No behaviour or API change.
