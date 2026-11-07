---
'@flare-engine/audio': patch
---

Adds procedural SFX synthesis: `renderSynth(sound, sampleRate, out)` renders a `SynthSound` (sine,
square, saw or seeded noise, an ADSR `envelope`, a linear sweep from `frequency` to `endFrequency`)
as mono PCM into a caller-owned `Float32Array` without allocating; `synthSampleCount` sizes that
array and `fillPCMBuffer` copies it into every channel of a `PCMBufferLike`. `AudioContextLike`
gains an optional `createBuffer?` returning one. Nothing existing changes.
