# Testing ui and ui-shop under bun test

How to import `@flare-engine/ui` and `@flare-engine/ui-shop` in a `bun test` file without a React Native runtime.

---

## The failure

A bare import of either package under `bun test` fails before the first test runs:

```ts
import { Label } from '@flare-engine/ui';
```

```text
27 | import typeof * as ReactNativePublicAPI from './index.js.flow';
            ^
error: Unexpected typeof
    at …/node_modules/react-native/index.js:27:8
```

The entry file of `react-native` is Flow source, which bun does not parse. Both packages value-import it at module scope (`View`, `Text`, `Pressable`, `StyleSheet` in `@flare-engine/ui`; `View` in `@flare-engine/ui-shop`), so loading either package loads `react-native` first. This is the peer contract, not a defect: the packages target a React Native runtime, where Metro strips the Flow types. Under bun the module has to be replaced before anything imports it.

---

## Focus logic only? Skip the mocks

`@flare-engine/ui/focus` exports `createFocusManager`, `createFocusKeyboardDriver` and their types with no React or React Native import. Import it directly and no stub is needed:

```ts
import { createFocusKeyboardDriver, createFocusManager } from '@flare-engine/ui/focus';
```

The rest of this recipe is for the `.` entry of `@flare-engine/ui` (components, theme, `FocusProvider`) and for `@flare-engine/ui-shop`.

---

## The four stubs

Put the stubs in one file, for example `test/flare-ui-mocks.ts`:

```ts
import { mock } from 'bun:test';

type Props = Record<string, unknown> | null;

const element = (type: unknown, props: Props) => ({ type, props: props ?? {} });

function childrenToArray(children: unknown): unknown[] {
  const out: unknown[] = [];
  const visit = (node: unknown): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    out.push(node);
  };
  visit(children);
  return out;
}

mock.module('react', () => ({
  Children: { toArray: childrenToArray },
  Fragment: 'Fragment',
  createContext: (defaultValue: unknown) => ({
    Provider: 'Provider',
    Consumer: 'Consumer',
    _current: defaultValue,
  }),
  createElement: (type: unknown, props: Props, ...children: unknown[]) =>
    element(type, { ...props, children }),
  useContext: (ctx: { _current: unknown }) => ctx._current,
  useEffect: () => {},
  useId: () => 'test-id',
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useState: (init: unknown) => [
    typeof init === 'function' ? (init as () => unknown)() : init,
    () => {},
  ],
}));

mock.module('react/jsx-runtime', () => ({ jsx: element, jsxs: element, Fragment: 'Fragment' }));

mock.module('react/jsx-dev-runtime', () => ({ jsxDEV: element, Fragment: 'Fragment' }));

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
}));
```

Elements are plain `{ type, props }` objects, and the React Native components are string tags, so a rendered `Label` is `{ type: 'Text', props: { … } }`. One `mock.module` per module the packages reach:

- `react-native` — the Flow entry above. Replacing it is what makes the import succeed at all.
- `react` — the components call hooks. With only `react-native` mocked both packages import, but calling a component throws `TypeError: null is not an object (evaluating 'dispatcher.useContext')`, because the real hooks need a renderer. The stub turns them into plain functions; `createContext` and `useContext` hand back the default value.
- `react/jsx-runtime` — the built packages compile JSX to `jsx` / `jsxs` calls. With `react` mocked, the real runtime throws `TypeError: undefined is not an object (evaluating 'ReactSharedInternals.recentlyCreatedOwnerStacks')`, so it is replaced too.
- `react/jsx-dev-runtime` — covers JSX written in your own `.tsx` test files, which bun compiles to `jsxDEV`.

A stub must export every name the packages import. A missing one fails at import time with `SyntaxError: Export named 'Children' not found in module '…/react/index.js'`. The `react` stub above carries the full set the two packages use: `Children`, `Fragment`, `createContext`, `createElement`, `useContext`, `useEffect`, `useId`, `useMemo`, `useRef`, `useState`.

---

## Load order

`mock.module` has to run before the module it replaces is loaded. Two ways to guarantee that:

**Preload** — register the stubs once for the whole run, then write ordinary static imports in every test file.

```toml
# bunfig.toml
[test]
preload = ["./test/flare-ui-mocks.ts"]
```

`bun test --preload ./test/flare-ui-mocks.ts` does the same for a single invocation.

**Per file** — load the stubs at the top of the test file and bring the packages in with a dynamic import. A static `import` of the package is hoisted above the `mock.module` calls and loads the real `react-native` first, so it must be `await import(...)`.

```ts
import './flare-ui-mocks';

const { Label } = await import('@flare-engine/ui');
const { RestorePurchasesButton } = await import('@flare-engine/ui-shop');
```

Pasting the stubs inline above the dynamic import works the same way.

Two caveats:

- Whichever file mocks `react` first freezes the named-export set bun uses for the rest of the run; a later file that adds a new key is silently ignored. Every file that mocks `react` must therefore carry the full key set — sharing the one stubs file above satisfies this automatically.
- A preload mocks React for every test file in the run. Tests that need the real React (anything driven by a renderer) belong in a separate `bun test` invocation without the preload.

---

## A render-shaped assertion

With the preload in place, components are plain functions that return `{ type, props }` objects:

```ts
import { expect, test } from 'bun:test';
import { Label } from '@flare-engine/ui';
import { RestorePurchasesButton } from '@flare-engine/ui-shop';

type Element = { type: unknown; props: Record<string, unknown> };

test('Label renders a Text carrying its children and numberOfLines', () => {
  const el = Label({ children: 'Score', numberOfLines: 1 }) as Element;
  expect(el.type).toBe('Text');
  expect(el.props.children).toBe('Score');
  expect(el.props.numberOfLines).toBe(1);
});

test('ui-shop loads under the same stubs', () => {
  expect(typeof RestorePurchasesButton).toBe('function');
});
```

---

## Scope

These stubs cover `@flare-engine/ui` and `@flare-engine/ui-shop` only. `@flare-engine/devtools` and `@flare-engine/react` also load `react-native` at module scope, and `@flare-engine/react` additionally loads `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-worklets` and `react-native-safe-area-context`; this recipe does not cover them.
