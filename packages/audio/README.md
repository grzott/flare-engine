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
import { AudioContext } from 'react-native-audio-api';

// One AudioContext, created lazily via the manager's factory.
const ctx = new AudioContext();
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

AppState.addEventListener('change', (state) => {
  if (state === 'active') manager.resume();
  else manager.suspend();
});
```

On web, subscribe to `visibilitychange`:

```ts
document.addEventListener('visibilitychange', () => {
  document.hidden ? manager.suspend() : manager.resume();
});
```

See [API spec](../../docs/design/api-specs.md#flare-engineaudio--4kb-gzip).

## License

MIT
