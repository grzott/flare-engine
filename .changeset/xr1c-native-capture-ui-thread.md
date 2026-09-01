---
"@flare-engine/react": patch
---

XR-1c: build the native scene-capture surface on the UI thread. A surface created on the JS thread belongs to a different GL context than the on-screen canvas, so `<GameView>` rendered a black frame on device while the game loop ran normally. Web keeps its single-threaded capture path.
