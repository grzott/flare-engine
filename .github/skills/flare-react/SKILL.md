---
name: flare-react
description: Deep knowledge of the @flare-engine/react package — GameView, GameConfig, useGame, useEntity, useGameLoop, VirtualJoystick, VirtualButton, GameContext. Use when wiring Flare into a React Native app, reading game state in React components, or adding on-screen touch controls.
---

# @flare-engine/react

React Native integration layer for Flare. Layer 4 — topmost package.

## Exports

```ts
import {
  GameView,
  GameContext,
  useGame,
  useEntity,
  useGameLoop,
  VirtualJoystick,
  VirtualButton,
  type GameConfig,
  type GameViewProps,
  type GameContextValue,
} from "@flare-engine/react";
```

---

## GameView

Root component. Mounts a Skia `<Canvas>` and drives the game loop.

```tsx
import { GameView, type GameConfig } from "@flare-engine/react";

const config: GameConfig = {
  width: 390, // logical resolution
  height: 844,
  targetFps: 60,
  backgroundColor: { r: 20, g: 20, b: 30, a: 255 },
  fixedHz: 60, // physics tick rate (passed to GameLoop)
};

export function App() {
  return (
    <GameView
      config={config}
      style={{ flex: 1 }}
      onReady={(ctx) => {
        // ctx: GameContextValue — access world, loop, etc.
        ctx.world.spawn();
      }}
    />
  );
}
```

`GameView` automatically:

- Creates `World`, `GameLoop`, `Clock`, `ScreenManager`
- Attaches `AppLifecycle` (pauses loop in background)
- Provides `GameContext` to all children

---

## Hooks

### useGame

Access the `GameContextValue` anywhere inside `<GameView>`.

```tsx
import { useGame } from "@flare-engine/react";

function HUDOverlay() {
  const game = useGame();
  // game.world, game.loop, game.clock, game.screen, game.camera
  return <View />;
}
```

### useEntity

Subscribe to a specific entity's component data. Re-renders when the component value changes.

```tsx
import { useEntity } from "@flare-engine/react";
import { Health } from "../components";

function HealthBar({ entity }: { entity: number }) {
  const hp = useEntity(entity, Health);
  // hp: { current: number, max: number } | null

  if (!hp) return null;
  return <ProgressBar value={hp.current / hp.max} />;
}
```

### useGameLoop

Run a callback every game frame (outside the Skia canvas). Useful for syncing React state with game state.

```tsx
import { useGameLoop } from "@flare-engine/react";

function ScoreDisplay() {
  const [score, setScore] = useState(0);

  useGameLoop((dt) => {
    setScore(gameState.score); // pull from game each frame
  });

  return <Text>{score}</Text>;
}
```

**Warning:** `useGameLoop` callbacks run in the JS thread. Keep them fast. For rendering, draw inside `GameView` render pipeline instead.

---

## VirtualJoystick

On-screen analog stick for mobile input.

```tsx
import { VirtualJoystick } from "@flare-engine/react";

<VirtualJoystick
  size={120} // outer radius px
  knobSize={50} // inner knob diameter
  position={{ x: 80, y: 720 }} // screen position (logical px)
  deadZone={0.1} // 0–1, ignore tiny inputs
  onMove={(x, y) => {
    // x, y: normalized -1 to 1
    velocity.x = x * SPEED;
    velocity.y = y * SPEED;
  }}
  onRelease={() => {
    velocity.x = 0;
    velocity.y = 0;
  }}
/>;
```

---

## VirtualButton

On-screen tap button.

```tsx
import { VirtualButton } from "@flare-engine/react";

<VirtualButton
  size={64}
  position={{ x: 310, y: 720 }}
  label="A"
  onPress={() => {
    player.jump();
  }}
  onRelease={() => {
    /* held-button logic */
  }}
/>;
```

---

## GameContext

Access the context value directly (e.g., outside function components).

```tsx
import { GameContext, type GameContextValue } from "@flare-engine/react";

// In a class component or ref:
const value: GameContextValue = useContext(GameContext);

// GameContextValue shape:
// {
//   world: World,
//   loop: GameLoop,
//   clock: Clock,
//   screen: ScreenManager,
//   camera: Camera2D,
// }
```

---

## Minimal App Template

```tsx
import { GameView } from "@flare-engine/react";
import { VirtualJoystick } from "@flare-engine/react";
import { StyleSheet, View } from "react-native";

export default function Game() {
  return (
    <View style={styles.container}>
      <GameView
        config={{ width: 390, height: 844, targetFps: 60 }}
        style={StyleSheet.absoluteFill}
        onReady={(ctx) => {
          // Initialize world, spawn player, register systems...
        }}
      />
      <VirtualJoystick
        size={120}
        position={{ x: 80, y: 720 }}
        onMove={(x, y) => {
          /* move player */
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
```
