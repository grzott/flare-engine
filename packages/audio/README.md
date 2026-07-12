# @flare-engine/audio

Web-Audio-shaped runtime audio — `AudioManager` (init / suspend / resume), `SFXPool` (pre-decoded buffers + polyphony cap), `Music` (single-track with crossfade), `createChannels` (master / sfx / music gain mixer). Lifecycle is manual: call `suspend()`/`resume()` from your own background/foreground handler (see below).

## Install

```sh
bun add @flare-engine/audio
```

Native: pair with `react-native-audio-api` (Web Audio API on native).

## Usage

```ts
import { AudioManager, SFXPool, createChannels } from '@flare-engine/audio';
import type { AudioContextLike, AudioBufferLike } from '@flare-engine/audio';

// AudioContextLike is the engine's interface — obtain a real one from
// `new AudioContext()` (react-native-audio-api on native, the Web Audio global on web).
declare const ctx: AudioContextLike;
declare const shootBuffer: AudioBufferLike;

// One AudioContext, created lazily via the manager's factory.
const manager = new AudioManager();
manager.init(() => ctx);

// master ← sfx / music gain mixer.
const channels = createChannels(ctx);

// SFX pool: cap simultaneous voices, route through the sfx channel.
const sfx = new SFXPool(8);
sfx.connect(ctx, channels.get('sfx')!.node);

// Register pre-decoded buffers (decode with react-native-audio-api), then play.
sfx.register('shoot', shootBuffer);
sfx.play('shoot', { volume: 0.8, rate: 1.25 });
```

## Lifecycle (manual)

There is no automatic background/foreground handling — nothing subscribes to `AppState` or `visibilitychange` for you. Drive `suspend()`/`resume()` from your own lifecycle event:

```ts
import { AppState } from 'react-native';
import { AudioManager } from '@flare-engine/audio';

declare const manager: AudioManager;

AppState.addEventListener('change', (state) => {
  if (state === 'active') manager.resume();
  else manager.suspend();
});
```

On web, subscribe to `visibilitychange`:

```ts
import { AudioManager } from '@flare-engine/audio';

declare const manager: AudioManager;

document.addEventListener('visibilitychange', () => {
  document.hidden ? manager.suspend() : manager.resume();
});
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineaudio--4kb-gzip).

## License

MIT
