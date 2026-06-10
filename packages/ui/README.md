# @flare-engine/ui

Skia-free UI kit for HUDs, menus, modals — `Panel`, `Button`, `Label`, `List`, `Modal`, `HUDBar`, `ProgressBar`, plus `DialoguePanel`, `ShopPanel`, `MainMenuKit` higher-level components. `ThemeProvider` injects design tokens; `FocusProvider` + `FocusManager` drive keyboard / gamepad navigation; `resolveLayout` is a pure flex-like layout resolver.

## Install

```sh
bun add @flare-engine/ui
```

Peer deps: `react`, `react-native`.

## Usage

```tsx
import { ThemeProvider, FocusProvider, Panel, Button, Label, darkTheme } from '@flare-engine/ui';

<ThemeProvider theme={darkTheme}>
  <FocusProvider>
    <Panel variant="elevated">
      <Label variant="lg">Pause</Label>
      <Button variant="primary" onPress={resume}>Resume</Button>
    </Panel>
  </FocusProvider>
</ThemeProvider>
```

See [API spec](../../docs/design/api-specs.md#flare-engineui--6kb-gzip-target).

## License

MIT
