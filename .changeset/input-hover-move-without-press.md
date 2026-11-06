---
'@flare-engine/input': patch
---

`InputManager.onPointerMove` now treats a move for an id that was never pressed, while no primary
touch is active, as a hover: `pointer.position` and `pointer.delta` follow it, `isDown` and
`justPressed` are left alone, and no pressed `TouchPoint` is recorded. Before, a host feeding mouse
moves with no button held (a desktop shell, a browser) never moved `pointer`, and each such move
inserted a phantom touch with `isDown: true`. A move for a tracked, pressed id behaves as before.
