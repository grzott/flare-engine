# @flare-engine/ui

Skia-free UI kit for HUDs, menus, modals — `Panel`, `Button`, `Label`, `List`, `Modal`, `HUDBar`, `ProgressBar`, plus `DialoguePanel`, `ShopPanel`, `MainMenuKit` higher-level components. `ThemeProvider` injects design tokens; `FocusProvider` + `FocusManager` drive focus navigation; `createFocusKeyboardDriver` wires arrows/Tab/Enter/Space onto the manager (gamepad driver pending); `resolveLayout` is a pure flex-like layout resolver.

## Install

```sh
bun add @flare-engine/ui
```

Peer deps: `react`, `react-native`.

## Usage

```tsx
import { ThemeProvider, FocusProvider, Panel, Button, Label, darkTheme } from '@flare-engine/ui';

function PauseMenu({ onResume }: { onResume: () => void }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <FocusProvider>
        <Panel variant="elevated">
          <Label variant="lg">Pause</Label>
          <Button variant="primary" label="Resume" onPress={onResume} />
        </Panel>
      </FocusProvider>
    </ThemeProvider>
  );
}
```

## Keyboard navigation

```ts
import { createFocusManager, createFocusKeyboardDriver, type FocusKeySource } from '@flare-engine/ui';
// keys is any { wasPressed(code: string): boolean } — createKeyboard() from
// @flare-engine/input is structurally assignable, no hard dependency required.
declare const keys: FocusKeySource;
const manager = createFocusManager();
const driver = createFocusKeyboardDriver(manager, keys);
// per-frame game loop:
driver.update(); // ArrowDown/ArrowRight/Tab → next, ArrowUp/ArrowLeft → prev, Enter/Space → activate
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineui--6kb-gzip-target).

## License

MIT
