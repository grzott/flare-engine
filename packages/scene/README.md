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
// SceneManager passes the World and Camera2D it created for this scene into
// the factory — a zero-argument factory would also be a valid SceneFactory.
manager.register('menu', (world, camera) => ({
  name: 'menu',
  world,
  camera,
  onEnter() {},
  onUpdate(_dt: number) {},
  onExit() {},
}));

manager.setTransition(fadeTransition(0.3));
await manager.go('menu');
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginescene--4kb-gzip).

## License

Apache-2.0
