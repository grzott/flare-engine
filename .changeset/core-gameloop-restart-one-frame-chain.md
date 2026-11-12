---
"@flare-engine/core": patch
---

`GameLoop` keeps a single frame chain when it is stopped or restarted from inside a frame handler. Before, calling `stop()` then `start()` inside a handler (for example in `onUpdate`) left two frame callbacks scheduled instead of one; and calling `stop()` inside a handler still scheduled one more frame, so a `start()` issued before that frame fired also left two scheduled. The frame callback now schedules the next frame only if the loop is still running and no frame is already pending.
