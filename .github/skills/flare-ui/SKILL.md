---
name: flare-ui
description: Deep knowledge of the @flare-engine/ui package — Panel, Button, Label, List, Modal, HUDBar, ProgressBar, ThemeProvider, FocusProvider, focus navigation, flex-like layout resolver. Use when building HUDs, menus, pause screens, or modal dialogs in a Flare game.
---

# `@flare-engine/ui`

Layer 3.5. React-Native-only peer deps — no Skia. Menus render through the platform view tree so Skia canvas stays focused on the game.

## Exports

```ts
import {
  darkTheme,
  lightTheme,
  type Theme,
  ThemeProvider,
  useTheme,
  createFocusManager,
  type FocusManager,
  FocusProvider,
  FocusContext,
  useFocusManager,
  resolveLayout,
  type LayoutRect,
  Panel,
  Label,
  Button,
  ProgressBar,
  HUDBar,
  List,
  Modal,
} from "@flare-engine/ui";
```

## Usage sketch

```tsx
<ThemeProvider theme={darkTheme}>
  <FocusProvider>
    <Panel variant="elevated">
      <Label variant="lg">Pause</Label>
      <List direction="column" gap="md">
        <Button variant="primary" onPress={resume}>
          Resume
        </Button>
        <Button variant="ghost" onPress={quit}>
          Quit
        </Button>
      </List>
      <HUDBar kind="hp" value={playerHP} max={100} />
    </Panel>
  </FocusProvider>
</ThemeProvider>
```

## Rules

- `FocusManager.register(node)` returns a `dispose` — wire it to `useEffect` cleanup.
- Button/List auto-register with `FocusManager` when one is in scope — use `tabIndex` to control traversal order.
- `resolveLayout` is pure math — no React — use it for custom components.

Spec: [docs/design/api-specs.md § @flare-engine/ui](../../../docs/design/api-specs.md).
