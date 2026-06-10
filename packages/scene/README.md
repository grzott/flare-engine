# @flare-engine/scene

Scene lifecycle + transitions — `SceneManager` with `register` / `go(name, data?)` / `push` / `pop`, `Scene` interface (`onPreload` / `onInit` / `onEnter` / `onUpdate` / `onDraw` / `onExit` / `onDestroy`), and three transition factories (`noneTransition`, `fadeTransition`, `slideTransition`).

## Install

```sh
bun add @flare-engine/scene
```

## Usage

```ts
import { SceneManager, fadeTransition } from '@flare-engine/scene';

const manager = new SceneManager();
manager.register('menu', () => ({
  onEnter() { /* ... */ },
  onUpdate(dt) { /* ... */ },
  onExit() { /* ... */ },
}));

await manager.go('menu', undefined, fadeTransition(0.3));
```

See [API spec](../../docs/design/api-specs.md#flare-enginescene--4kb-gzip).

## License

MIT
