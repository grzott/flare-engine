---
"@flare-engine/audio": patch
---

audio: implement the `rate` play option and drop the false auto-suspend claim. `SFXPool.play`'s `rate` now applies when the injected source node exposes a `playbackRate` param (Web-Audio shape) and is a no-op when it doesn't — previously the option was declared but never read. The `AudioBufferSourceNodeLike` interface gains an optional `playbackRate` and a writable `onended` (removing the internal readonly casts in both `sfx-pool.ts` and `music.ts`). README and api-specs no longer claim automatic background/foreground suspend — none was ever wired; both now document the manual `AppState`/`visibilitychange` → `suspend()`/`resume()` recipe. The README usage example is corrected to the real `AudioManager`/`SFXPool`/`createChannels` API.
