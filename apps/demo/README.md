# @flare-engine-apps/demo

A vertical-scrolling shoot-em-up built with **Flare engine**. Doubles as the integration smoke test for the full engine stack and as the canonical example for new consumers.

Runs on Android, iOS, and — when the web target lands — the browser.

## Gameplay

- Virtual **joystick** (left) moves the ship; auto-fire is always on.
- Virtual **button** (right) fires a screen-clearing **bomb** (limited charges).
- Survive waves of enemies, fight a boss with two phases, reach victory.
- **Triple-tap** the `FLARE SHMUP` title on the menu to open the hidden bench scene (FPS stress test across three load tiers).
- **Long-press** the top-right corner to toggle the FPS overlay.

## Engine modules used

| Package                   | What it drives                                                 |
| ------------------------- | -------------------------------------------------------------- |
| `@flare-engine/engine`    | `GameView`, lifecycle, scene manager, ECS world, camera, input |
| `@flare-engine/ui`        | HUD, menus, buttons, modals, HP bars                           |
| `@flare-engine/ecs`       | Entities, components, `FSM` for boss phases                    |
| `@flare-engine/physics`   | AABB collision + trigger callbacks                             |
| `@flare-engine/render`    | Sprite batch, camera, camera shake                             |
| `@flare-engine/animation` | `tween` + `easeOutQuad` for the bomb flash                     |
| `@flare-engine/math`      | `clamp`, easings, `SeededRNG`                                  |
| `@flare-engine/scene`     | `fadeTransition` between scenes                                |
| `@flare-engine/debug`     | `StatsTracker`, `createFpsWidget`                              |
| `@flare-engine/assets`    | Procedural placeholder atlas                                   |
| `@flare-engine/audio`     | `SFXPool`, `Music` (crossfade per scene)                       |

All art is a **procedural atlas of basic shapes** — no external assets. All SFX + music are synthesized via `react-native-audio-api`.

## Source layout

```
apps/demo/src/
  App.tsx              // Bootstraps GameView, audio, scenes, FPS overlay
  atlas.ts             // Builds the procedural placeholder sprite atlas
  audio.ts             // Synthesized beep + music buffers
  components.ts        // ECS components (Ship, Enemy, Boss, Bullet, Hp, ...)
  layers.ts            // Physics layer + mask bits
  spawn.ts             // Entity factories (player, enemy, boss, bullet)
  state.ts             // Global UI-visible game state + signal
  hud/
    Hud.tsx            // React HUD tree (@flare-engine/ui)
    menu-actions.ts    // Bridge between Modal buttons and scene logic
    use-game-state.ts  // Subscribes to the stateChanged signal
  scenes/
    boot.ts            // Splash / init
    menu.ts            // Title screen
    play.ts            // Main gameplay scene
    game-over.ts       // Defeat screen
    victory.ts         // Win screen
    bench.ts           // Hidden FPS stress bench (3 load tiers)
  systems/
    player.ts          // Joystick → ship velocity, auto-fire
    enemy-ai.ts        // Enemy movement patterns
    boss.ts            // Boss FSM (entering → phase1 → phase2 → dying → defeated)
    bomb.ts            // Screen-clear bomb, flash tween, camera shake
    integrate.ts       // Position += velocity
    physics-sync.ts    // ECS → collision-world transform sync
    cleanup.ts         // Lifetimes, off-screen culls, death handling
    spawner.ts         // Wave schedule
```

## Run

From the repo root:

```bash
bun install
```

Then from `apps/demo`:

```bash
bun run start      # Expo dev server
bun run android    # Build + run on Android
bun run ios        # Build + run on iOS (macOS only)
```

## Test / lint / typecheck

```bash
bun run test       # bun test
bun run lint       # biome check src/
bun run typecheck  # tsc --noEmit
```
