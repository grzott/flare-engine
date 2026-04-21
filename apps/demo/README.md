# @flare-engine-apps/demo

A vertical-scrolling shoot-em-up built with **Flare engine**. Doubles as the integration smoke test for the full engine stack and as the canonical example for new consumers.

Runs on Android, iOS, and — when the web target lands — the browser.

> **Status:** ✅ **ready to play end-to-end** on Android and iOS. All systems (menu, saves, base, dialogue, gameplay, boss, pause, end screens) are functional. Final art and SFX assets are still pending — everything currently renders with a procedural placeholder atlas and synthesized audio.

> **License:** this demo is distributed under the [PolyForm Noncommercial License 1.0.0](./LICENSE). Hack on it, share it, port it — but do not sell it or ship it commercially. The rest of the engine packages remain MIT.

## Gameplay

- Virtual **joystick** (left) moves the ship; auto-fire is always on.
- Virtual **button** (right) fires a screen-clearing **bomb** (limited charges, short cooldown between shots).
- Survive waves of enemies, fight a boss with two phases, reach victory.
- **Main menu** with three save slots and a settings modal (SFX / Music / Screen-shake).
- **Home base** hub (after slot select) with 2×2 tile grid (Shop / Inventory / Ships / Scores) and a `LAUNCH RUN` button.
- **Pre-run dialogue** plays on the first launch of a slot and once after the first victory.
- **Pause modal** (top-right ⏸ button during play) with Resume / Settings / Main Menu.
- **End screen** summarises run stats (score, kills by enemy type, bombs used, damage taken, duration) and writes results back to the slot.
- **Triple-tap** the `FLARE SHMUP` title on the menu to open the hidden bench scene (FPS stress test across three load tiers).
- **Long-press** the top-left hotspot to toggle the FPS overlay.

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
| `@flare-engine/storage`   | Persistent save slots + settings (MMKV adapter)                |
| `@flare-engine/dialogue`  | Pre-run + post-victory dialogue graphs                         |
| `@flare-engine/events`    | `Signal` for state / UI / dialogue change broadcasts           |

All art is a **procedural atlas of basic shapes** — no external assets. All SFX + music are synthesized via `react-native-audio-api`.

## Scene graph

```
boot → menu ⇄ base → (dialogue?) → play → game-over → base
                                       └─ victory  → (dialogue) → base
menu → bench        (hidden, triple-tap title)
```

## Source layout

```
apps/demo/src/
  App.tsx              // Bootstraps GameView, audio, scenes, save store, FPS overlay
  atlas.ts             // Builds the procedural placeholder sprite atlas
  audio.ts             // Synthesized beep + music buffers
  components.ts        // ECS components (Ship, Enemy, Boss, Bullet, Hp, ...)
  layers.ts            // Physics layer + mask bits
  spawn.ts             // Entity factories (player, enemy, boss, bullet)
  state.ts             // Global game state + settings + run stats + signals
  dialogue/
    intro-graph.ts     // First-run controls dialogue
    victory-graph.ts   // Post-victory showcase dialogue
  save/
    schema.ts          // SaveFile schema + slot/run merge helpers
    store.ts           // MMKV-backed save store (memory fallback)
    ref.ts             // Module-singleton access from scenes
  hud/
    Hud.tsx            // React HUD tree (@flare-engine/ui) — menus, modals, dialogue, end screens
    menu-actions.ts    // Bridge between Modal buttons and scene logic
    ui-state.ts        // Overlay state (settings open, pause open, active base tile, slot picker, reset-confirm)
    use-game-state.ts  // Subscribes to the stateChanged signal
    use-ui-state.ts    // Subscribes to the uiChanged signal
    use-dialogue.ts    // Subscribes to the dialogueChanged signal
  scenes/
    boot.ts            // Splash / init
    menu.ts            // Title screen + slot picker
    base.ts            // Home-base hub (2×2 tiles + launch run)
    dialogue.ts        // Plays intro / victory dialogue then routes on
    play.ts            // Main gameplay scene (with pause)
    game-over.ts       // Defeat summary; commits run to slot
    victory.ts         // Win summary; commits run to slot
    bench.ts           // Hidden FPS stress bench (3 load tiers)
  systems/
    player.ts          // Joystick → ship velocity, auto-fire
    enemy-ai.ts        // Enemy movement patterns
    boss.ts            // Boss FSM (entering → phase1 → phase2 → dying → defeated)
    bomb.ts            // Screen-clear bomb, flash tween, camera shake, cooldown
    integrate.ts       // Position += velocity
    physics-sync.ts    // ECS → collision-world transform sync
    cleanup.ts         // Lifetimes, off-screen culls, death handling, kill tracking
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
