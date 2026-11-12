---
'@flare-engine/render-web': patch
---

`createWebSkiaModule`'s `PictureRecorder().beginRecording()` now returns the same `DrawSurfaceLike`
object on every call for a given recorder, re-pointed at the new recording's canvas, instead of
building a new wrapper per recording. The object is valid only between `beginRecording` and the
matching `finishRecordingAsPicture`: a reference kept across recordings draws into whichever
recording that recorder began last. `createFrameRenderer` drops its reference at `endFrame`, so
frame-renderer consumers are unaffected. `drawAtlas` now passes CanvasKit views cached per run
length instead of cutting two new views per run; the cache is dropped when the scratch buffers grow.
