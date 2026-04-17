# Flare

> Modular 2D game engine for React Native, built on Skia

```mermaid
graph TB
    subgraph "Layer 4 — Integration"
        engine["@flare/engine"]
        react_pkg["@flare/react"]
    end
    subgraph "Layer 3 — Features"
        scene["@flare/scene"]
        animation["@flare/animation"]
        particles["@flare/particles"]
        tilemap["@flare/tilemap"]
        debug["@flare/debug"]
    end
    subgraph "Layer 2 — Systems"
        render["@flare/render"]
        input["@flare/input"]
        physics["@flare/physics"]
        audio["@flare/audio"]
        assets["@flare/assets"]
    end
    subgraph "Layer 1 — Runtime"
        core["@flare/core"]
        ecs["@flare/ecs"]
    end
    subgraph "Layer 0 — Foundation"
        math["@flare/math"]
        events["@flare/events"]
    end

    engine --> react_pkg
    react_pkg --> render
    react_pkg --> input
    scene --> core
    animation --> core
    particles --> render
    tilemap --> render
    debug --> core
    render --> core
    render --> assets
    input --> core
    physics --> core
    audio --> core
    assets --> core
    core --> math
    core --> events
    ecs --> events
```

## Packages

| Package            | Layer | Description                                               |
| ------------------ | ----- | --------------------------------------------------------- |
| `@flare/math`      | 0     | Vec2, Rect, Transform, Color, easings, intersection tests |
| `@flare/events`    | 0     | Type-safe EventEmitter and Signal                         |
| `@flare/core`      | 1     | GameLoop, Clock, AppLifecycle, Pool, Coroutines           |
| `@flare/ecs`       | 1     | Entity-Component-System with archetype queries            |
| `@flare/render`    | 2     | SpriteBatch (Skia Atlas), Camera2D, SpriteEffects         |
| `@flare/input`     | 2     | InputManager, VirtualJoystick, gestures                   |
| `@flare/physics`   | 2     | AABB collision, spatial index, raycasting                 |
| `@flare/audio`     | 2     | AudioManager, SFX pool, music crossfade                   |
| `@flare/assets`    | 2     | Asset loading, sprite sheet parsing                       |
| `@flare/scene`     | 3     | Scene manager, transitions, lifecycle                     |
| `@flare/animation` | 3     | Sprite animation, tweens, springs                         |
| `@flare/particles` | 3     | Particle emitter, pool, immediate-mode Skia               |
| `@flare/tilemap`   | 3     | Tiled/LDtk parser, culled tilemap renderer                |
| `@flare/debug`     | 3     | Dev overlay, stats, entity inspector                      |
| `@flare/react`     | 4     | `<GameView>`, hooks, UI components                        |
| `@flare/engine`    | 4     | Convenience entry point, re-exports                       |

## Getting Started

> **Status:** All 16 packages are implemented and tested — 862 tests, 0 failures.

```bash
bun install
bun run build
bun run test
```

### Quick Example

```tsx
import { createGame } from "@flare/engine";
import { GameView } from "@flare/react";

const game = createGame({
  width: 390,
  height: 844,
  targetFps: 60,
});

export function App() {
  return <GameView game={game} style={{ flex: 1 }} />;
}
```

## Tech Stack

- **Runtime:** Bun
- **Monorepo:** Turborepo
- **Lint + Format:** Biome
- **Build:** tsup (dual CJS/ESM)
- **Test:** Bun test
- **Commits:** Conventional Commits (commitlint)
- **Versioning:** SemVer via Changesets

## License

MIT
