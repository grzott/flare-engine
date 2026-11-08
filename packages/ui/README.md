# @flare-engine/ui

Skia-free UI kit for HUDs, menus, modals — `Panel`, `Button`, `Label`, `List`, `Modal`, `HUDBar`, `ProgressBar`, plus `DialoguePanel`, `MainMenuKit` higher-level components. `ThemeProvider` injects design tokens; `FocusProvider` + `FocusManager` drive focus navigation; `createFocusKeyboardDriver` wires arrows/Tab/Enter/Space onto the manager (gamepad driver pending); `resolveLayout` is a pure flex-like layout resolver. A shop list ships in `@flare-engine/ui-shop`, wired to `@flare-engine/iap`.

## Entry points

- **`.` (default)** — the whole kit: components, theme, focus, layout. Pulls in React Native at module scope.
- **`./focus`** — the RN-free focus core: `createFocusManager` + `createFocusKeyboardDriver` and their types (`FocusManager`, `FocusManagerOptions`, `FocusNode`, `FocusKeyboardDriver`, `FocusKeyboardDriverOptions`, `FocusKeySource`). No React or React Native import, so it is safe for `bun test` and Node harnesses. `.` re-exports the same names.

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
import { createFocusManager, createFocusKeyboardDriver, type FocusKeySource } from '@flare-engine/ui/focus';
// keys is any { wasPressed(code: string): boolean } — createKeyboard() from
// @flare-engine/input is structurally assignable, no hard dependency required.
declare const keys: FocusKeySource;
const manager = createFocusManager();
const driver = createFocusKeyboardDriver(manager, keys);
// per-frame game loop:
driver.update(); // ArrowDown/ArrowRight/Tab → next, ArrowUp/ArrowLeft → prev, Enter/Space → activate
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineui--6kb-gzip-target).

## Testing

The `.` entry loads `react-native` at module scope, and the `react-native` entry file is Flow source that bun does not parse, so importing it under `bun test` needs four `mock.module` stubs (`react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-native`). `./focus` needs none. The stubs, the load-order rules and a worked assertion: [Testing ui and ui-shop under bun test](https://github.com/grzott/flare-engine/blob/main/docs/recipes/testing-ui-under-bun.md).

## License

Apache-2.0
