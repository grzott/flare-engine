---
name: flare-audio
description: Deep knowledge of the @flare-engine/audio package — AudioManager, SFXPool, Music, channels. Use when playing sound effects, background music with crossfade, managing polyphony / volume channels, or wiring app-lifecycle audio suspend/resume in Flare.
---

# `@flare-engine/audio`

Layer 2. Peer-depends on `react-native-audio-api` (native) or uses Web Audio on web. Auto-suspends on app background.

## Exports

```ts
import {
  AudioManager,
  SFXPool,
  type SFXHandle,
  type PlaySFXOptions,
  Music,
  createChannels,
  type Channel,
  type ChannelName,
} from "@flare-engine/audio";
```

## Usage sketch

```ts
await audio.init();
const channels = createChannels(audio.context);
channels.sfx.gain = 0.7;

const sfx = new SFXPool(audio.context, channels.sfx, { maxPolyphony: 8 });
await sfx.load("laser", laserBuffer);
sfx.play("laser", { volume: 0.9 });

const music = new Music(audio.context, channels.music);
await music.crossfadeTo(menuTrack, 0.5);
```

## Rules

- `AudioManager.init()` must be called from a user-gesture handler on web (browser autoplay policy).
- `SFXPool` kills the oldest voice when `maxPolyphony` is exceeded — don't assume `play()` always starts a new voice.
- Channels are in-memory only — MMKV persistence is deferred. Persist volumes yourself via `@flare-engine/storage` if needed.
- Always `sfxPool.stopAll()` on scene exit to prevent bleed across scene transitions (the demo learned this the hard way).

Spec: [docs/design/api-specs.md § @flare-engine/audio](../../../docs/design/api-specs.md).
