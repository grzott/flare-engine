---
name: flare-scene
description: Deep knowledge of the @flare-engine/scene package — SceneManager, Scene interface, SceneFactory, Transition (fade, slide, none). Use when implementing game screens, scene transitions, or scene lifecycle (enter/exit/update/render).
---

# @flare-engine/scene

Scene lifecycle management with animated transitions. Layer 3 — depends on `@flare-engine/core`.

## Exports

```ts
import {
  SceneManager,
  noneTransition,
  fadeTransition,
  slideTransition,
  type Scene,
  type SceneFactory,
  type Transition,
  type TransitionState,
} from "@flare-engine/scene";
```

---

## Scene Interface

Every screen in the game implements `Scene`.

```ts
import type { Scene } from "@flare-engine/scene";

const MainMenuScene: Scene = {
  // Called once when first entered
  enter(manager: SceneManager) {
    // Spawn entities, load assets, start music...
  },

  // Called once when exiting (transition starts)
  exit() {
    // Stop music, clean up entities...
  },

  // Called every frame while active
  update(dt: number) {
    // Handle input, update entities...
  },

  // Called every frame to draw
  render(canvas: CanvasLike) {
    // Draw background, sprites, UI...
  },
};
```

---

## SceneFactory

A factory function `() => Scene` lets SceneManager create scenes lazily (avoids holding stale references).

```ts
import type { SceneFactory } from "@flare-engine/scene";

const makeGameScene: SceneFactory = () => {
  // closure holds scene-local state
  let player: Entity;

  return {
    enter(manager) { player = world.spawn(); /* ... */ },
    exit()         { world.despawn(player);  },
    update(dt)     { /* ... */ },
    render(canvas) { /* ... */ },
  };
};
```

---

## SceneManager

Orchestrates active scene and transitions.

```ts
const manager = new SceneManager();

// Register scenes by key
manager.register("menu",      makeMenuScene);
manager.register("game",      makeGameScene);
manager.register("gameover",  makeGameOverScene);

// Initial scene (no transition)
manager.start("menu");

// Switch to another scene
manager.goto("game");                             // immediate (noneTransition)
manager.goto("game", fadeTransition(0.4));        // 0.4s fade
manager.goto("game", slideTransition("left", 0.3)); // slide left 0.3s

// Each frame
manager.update(dt);
manager.render(canvas);

// Query state
manager.current;     // active scene key (string)
manager.isTransitioning; // boolean
```

---

## Transitions

Built-in transition factories:

```ts
import { noneTransition, fadeTransition, slideTransition } from "@flare-engine/scene";

// Instant cut (default)
noneTransition()

// Fade to black then in (cross-fade)
fadeTransition(duration: number)            // e.g. fadeTransition(0.5)

// Slide out old, slide in new
slideTransition(
  direction: "left" | "right" | "up" | "down",
  duration: number
)
// e.g. slideTransition("left", 0.3)
```

### Custom Transition

Implement the `Transition` interface:

```ts
import type { Transition, TransitionState } from "@flare-engine/scene";

const myTransition: Transition = {
  duration: 0.6,
  render(canvas, state: TransitionState) {
    // state.progress: 0 → 1
    // state.phase: "out" | "in"
    // Draw overlay, distortion effect, etc.
  },
};
```

---

## Typical Game Flow

```
SceneManager
  "menu"    → (fade) → "game"
  "game"    → (none) → "pause"
  "pause"   → (none) → "game"   (resume)
  "game"    → (fade) → "gameover"
  "gameover"→ (slide left) → "menu"
```
