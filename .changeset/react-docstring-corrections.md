---
'@flare-engine/react': patch
---

Two docstring corrections in the published type declarations: `SceneCaptureOptions` now says the
native UI-thread capture runs through `scheduleOnUI` (it named `runOnUI`, which `GameView` stopped
using when the worklets floor rose), and the shader-effect `children` field no longer refers to a
private game's effect set. No behaviour change.
