---
name: flare-game-dev
description: "Cross-cutting workflow for implementing a milestone in a Flare game app (apps/<game>/). Use when: building a zone/level/scene, adding gameplay entities, wiring HUD, scripting boss fights, executing a milestone from a Flare game build plan. Covers scene bootstrapping, ECS patterns, shape-atlas visuals (no sprite art), zero-alloc bullet loops, localization-first strings, scene-transition cleanup, and the milestone gate sequence. Reusable across any Flare game, not only Pan Tvardowski."
---

# Flare Game Development Workflow

Package-level skills in `.github/skills/flare-*/` cover individual engine packages. This skill is the **cross-cutting game-building workflow**: how to take a milestone from a `docs/plans/<game>-build-plan.md` and turn it into shipping gameplay.

## When to load this skill

- Starting a new milestone in any `apps/<game>/`
- Adding a scene, zone, level, or chapter
- Wiring a new entity type (enemy, boss, projectile, pickup)
- Porting a HUD or menu from ad-hoc RN views to `@flare-engine/ui`
- Scripting a boss FSM
- Debugging a device-only issue (audio leak, touch-responder, camera centering)

---

## Milestone execution loop

```
1. Read       docs/plans/<game>-build-plan.md §17  → pick lowest incomplete M<n>
2. Read       engine-coverage row for M<n>          → know which packages you touch
3. Load       matching flare-* skill(s) on demand
4. Plan       list files + tests + coverage ticks   → STOP for user approval
5. Implement  scenes → systems → entities → UI
6. Test       deterministic tests where payoff > cost
7. Gate       typecheck → lint → test → build → device smoke (manual)
8. Plan-doc   tick engine-coverage boxes in the build plan
9. Commit-msg produce Conventional Commits for user to paste
```

Never skip step 4. Never commit in step 9.

---

## Engine package ↔ game-mechanic cheatsheet

What to reach for when you need a specific game feature:

| Mechanic                                      | Primary package(s)                                      | Secondary                              |
| --------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| Player ship movement                          | `input`, `ecs`, `math`                                  | `animation` for thruster               |
| Auto-fire weapon                              | `core` (Pool for bullets), `ecs`, `events`              | —                                      |
| Enemy spawn waves                             | `core` (Coroutine), `ecs` (Prefab), `math` (seeded RNG) | —                                      |
| Boss phase FSM                                | `ecs` (FSM component), `core` (Coroutine for scripts)   | `events` for phase transitions         |
| Bullet-hell collision                         | `physics` (SpatialIndex + AABB), `ecs`                  | —                                      |
| Particle effects                              | `particles`                                             | `math` (Color lerp)                    |
| Screen shake                                  | `render` (Camera2D.shake)                               | `a11y` (reduced-motion gate)           |
| Hit flash on player / boss                    | `render` (SpriteEffects tint), `animation` (Tween)      | —                                      |
| Scrolling background                          | `tilemap` (parallax)                                    | `math` for scroll speed                |
| Music + SFX                                   | `audio` (Music crossfade, SFXPool)                      | `core` (AppLifecycle for pause/resume) |
| Menus + HUD + pause                           | `ui`, `react`                                           | `animation` (Spring for HUD pops)      |
| Save progress + settings                      | `storage`                                               | —                                      |
| Dialogue / cutscenes                          | `dialogue`                                              | `localization` for translated lines    |
| PL + EN strings                               | `localization`                                          | —                                      |
| Deep-link `game://zone/N`                     | `deep-links`                                            | —                                      |
| Victory screenshot share                      | `share`                                                 | —                                      |
| Reduced-motion toggle                         | `a11y`                                                  | gates shake + heavy postfx             |
| CRT / vignette / bloom                        | `postfx`                                                | —                                      |
| Achievements / leaderboards / IAP / analytics | Tier-2 stubs (NoopProvider)                             | real adapters land in 0.2.0            |
| FPS overlay, entity inspect                   | `debug`, `devtools` (dev only)                          | —                                      |
| Deterministic boss tests                      | `testing` (FakeClock)                                   | —                                      |
| Error boundary + crash report                 | `errors`                                                | —                                      |
| ECS bootstrap                                 | `engine` (`createGame`)                                 | —                                      |

---

## Patterns

### Pattern: scene bootstrap

A zone is a `Scene`. Minimal shape:

```ts
// apps/<game>/src/scenes/zone-2.ts
import type { Scene } from "@flare-engine/scene";
import { defineSystem, Query } from "@flare-engine/ecs";

export function createZone2Scene(): Scene {
  return {
    onEnter(ctx) {
      // 1. pre-create queries here (NOT in systems per-frame)
      const moveQuery = ctx.world.query(["Position", "Velocity"]);
      const bossQuery = ctx.world.query(["Boss", "Health"]);

      // 2. spawn player + HUD + initial enemies via Prefab
      // 3. subscribe to events (shard pickup, boss defeat)
      // 4. start music: ctx.audio.music.play('zone-2', { crossfade: 0.5 })
      // 5. center camera to viewport/2 (see pitfall below)
    },
    onUpdate(ctx, dt) {
      /* run systems */
    },
    onExit(ctx) {
      // MANDATORY: ctx.audio.sfx.stopAll()
      // MANDATORY: unsubscribe events
      // MANDATORY: release any pools
    },
    onRender(ctx) {
      /* batch draws, camera apply */
    },
  };
}
```

### Pattern: shape atlas (no sprite art)

Pan Tvardowski ships shape-atlas only at 0.1.x. Every entity = composition of primitive Skia shapes. Keep a single `apps/<game>/src/shapes.ts`:

```ts
// apps/pan-tvardowski/src/shapes.ts
export type ShapeSpec =
  | { kind: "circle"; r: number; fill: number }
  | { kind: "triangle"; size: number; fill: number }
  | { kind: "ngon"; n: number; r: number; fill: number; stroke?: number }
  | { kind: "star"; points: number; r: number; fill: number }
  | {
      kind: "polyline";
      points: readonly number[];
      stroke: number;
      width: number;
    };

export function drawShape(
  canvas: SkCanvas,
  s: ShapeSpec,
  x: number,
  y: number,
  rot: number,
): void {
  // dispatch to Canvas.drawCircle / drawPath / drawRect / etc
}
```

Rules:

- ShapeSpec goes on a component, not a mutable field — set once at prefab time.
- Colors come from the zone palette constant, not scattered magic numbers.
- Promote `drawShape` to `@flare-engine/assets` only after a **second** game needs it.

### Pattern: zero-alloc bullet loop

Bullets are the hottest path. Rules:

- Single `Pool<Bullet>` per weapon type, prewarmed.
- `bullet.update(dt)` returns `boolean` (alive?); dead bullets go back to the pool.
- No `new` in the update loop. No array `.filter(...)`, use in-place swap-remove.
- Collision via `@flare-engine/physics` SpatialIndex `queryInto(out)`, never `query()` returning fresh arrays.

### Pattern: boss FSM

Each boss is an entity with an FSM component from `@flare-engine/ecs`. Each phase is a state:

```ts
const bossFsm = defineFsm<BossState>({
  states: {
    phase1: { onEnter: runPhase1Script, onExit: clearPhase1Bullets },
    phase2: { onEnter: runPhase2Script, onExit: clearPhase2Bullets },
    defeated: { onEnter: playDefeatSequence },
  },
  transitions: [
    { from: "phase1", to: "phase2", when: (e) => hp(e) <= phase1MaxHp },
    { from: "phase2", to: "defeated", when: (e) => hp(e) <= 0 },
  ],
});
```

- Phase scripts are coroutines — `yield ctx.wait(1.5); spawnPattern(...); yield ctx.wait(0.8); ...`.
- Test the FSM deterministically with `@flare-engine/testing` FakeClock + scripted HP decrements.

### Pattern: localization-first strings

Never inline a string. Every string goes through `@flare-engine/localization`:

```ts
// good
hudScore.text = t("hud.score", { score });

// bad
hudScore.text = `Score: ${score}`;
```

Keep `apps/<game>/locales/en.json` and `pl.json` in sync. A test can assert `Object.keys(en) === Object.keys(pl)`.

---

## Pitfalls (from `apps/demo` post-mortem)

Do not re-discover these:

1. **Audio leaks across scene transitions.** SFXPool continues playing if you forget `ctx.audio.sfx.stopAll()` in `scene.onExit`. Symptom: explosion SFX continues into the menu after game-over.
2. **Camera origin off-screen.** Skia's default origin is top-left; your world coords are centered. Every scene must `camera.center(viewport.w/2, viewport.h/2)` in `onEnter`, or spawns appear shifted.
3. **Touch responder hijacked by `<GameView>`.** `VirtualJoystick` and `VirtualButton` need `onStartShouldSetResponder` to claim RN touch events inside their bounds. Parent `<GameView>` otherwise eats the touch.
4. **Joystick uses page coords, not view-relative.** Use `locationX` / `locationY`, not `pageX` / `pageY`.
5. **`world.query(...)` per frame.** Archetype allocation cost adds up. Pre-create queries in `onEnter`.
6. **Boss-phase transition without `onExit` cleanup.** Phase 1 bullets persist into phase 2 unless you clear them. Symptom: boss "bullet soup" at phase change.
7. **Music volume persisted incorrectly.** Don't read volume from `AudioManager` at scene boot — read from `@flare-engine/storage` settings slot. AudioManager is not the source of truth after pause/resume.
8. **RN reduced-motion check on wrong thread.** `AccessibilityInfo.isReduceMotionEnabled()` is async. Cache in `@flare-engine/a11y` at app init, not per-frame.
9. **`PanResponder` + `GameView` on Android consumes back-button.** Guard back-button handler manually on Android.
10. **Bench scenes gated on `__DEV__` are invisible in release builds.** If you want to measure FPS in release, register the scene unconditionally and hide its entry point instead.

---

## Test strategy

**Worth testing deterministically:**

- Boss FSM phase transitions (HP threshold → state change)
- Score math (combo multipliers, bomb-HP formula)
- Dialogue graph branches (condition evaluation)
- ICU plural resolution (bombs remaining, shards collected)
- Save-file schema migration

**Not worth testing:**

- Rendering (visual — verify on device)
- Particle emitters (visual — verify on device)
- Audio (timing-sensitive — verify on device)
- Camera shake (visual)

Use `@flare-engine/testing`'s `createFakeClock()` + `createTestWorld()` for deterministic tests. Never use real-time timers in tests.

---

## Gate command reference

Copy-paste these; do not re-invent:

```bash
# typecheck
bun --cwd apps/<game> run typecheck

# lint (repo-wide, Biome)
bun run lint

# tests
bun --cwd apps/<game> test     # game-local
bun run test                    # repo-wide (only if game utilities might break packages)

# build (only if game has a build script)
bun --cwd apps/<game> run build

# device smoke (USER RUNS — do not auto-run)
bun --cwd apps/<game> run android --device
bun --cwd apps/<game> run ios --device
```

---

## Commit-message templates

```
feat(<game>): <milestone summary>
feat(<game>): <discrete feature, e.g. boss name + pattern>
test(<game>): deterministic tests for <feature>
docs(<game>): tick M<n> engine-coverage boxes
chore(<game>): add dep <name> for <reason>
fix(<game>): <what broke, what fixes it>
```

One milestone usually emits 2–4 commits. Split by concern, not by file count.
