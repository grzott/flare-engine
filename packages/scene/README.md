# @flare-engine/scene

Scene lifecycle + transitions — `SceneManager` with `register` / `go(name, data?)` / `push` / `pop`, `Scene` interface (`onPreload` / `onInit` / `onEnter` / `onUpdate` / `onDraw` / `onExit` / `onDestroy`), and three transition factories (`noneTransition`, `fadeTransition`, `slideTransition`).

## Install

```sh
bun add @flare-engine/scene
```

## Usage

```ts
import { SceneManager, fadeTransition } from '@flare-engine/scene';
import type { World } from '@flare-engine/ecs';
import type { Camera2D } from '@flare-engine/render';

// world and camera are injected by SceneManager after the factory runs
declare const world: World;
declare const camera: Camera2D;

const manager = new SceneManager();
manager.register('menu', () => ({
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

MIT
