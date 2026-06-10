# @flare-engine/audio

Web-Audio-shaped runtime audio — `AudioManager` (init / suspend / resume), `SFXPool` (pre-decoded buffers + polyphony cap), `Music` (single-track with crossfade), `createChannels` (master / sfx / music gain mixer). Auto-suspends on app background; resumes on foreground.

## Install

```sh
bun add @flare-engine/audio
```

Native: pair with `react-native-audio-api` (Web Audio API on native).

## Usage

```ts
import { AudioManager, SFXPool, createChannels } from '@flare-engine/audio';

const manager = new AudioManager(audioContext);
const channels = createChannels(audioContext);
const sfx = new SFXPool(audioContext, channels.sfx, { maxVoices: 8 });

await manager.init();
sfx.play('shoot');
```

See [API spec](../../docs/design/api-specs.md#flare-engineaudio--4kb-gzip).

## License

MIT
