# @flare-engine/haptics

Typed `HapticsProvider` interface, a React context, and concrete providers you wire at the app boundary via **injection** — no `expo-haptics` or `react-native` dependency. Ships an Expo Haptics adapter, a Web Vibration adapter, and no-op fallbacks.

## Install

```sh
bun add @flare-engine/haptics
```

## Usage

Pick a provider at the app boundary and put it on the context. The cue surface is three semantic calls — `impact(style?)` for weapon / hit / bomb feel, `notification(type?)` for victory / error cues, and `selection()` for light UI ticks — plus an `isEnabled()` / `setEnabled(enabled)` gate. The gate keeps the user's haptics setting and the reduced-motion gate (`@flare-engine/a11y`) in one place; when disabled, cue methods are no-ops.

```tsx no-check
import * as Haptics from 'expo-haptics';
import {
  createExpoHapticsProvider,
  createWebVibrationProvider,
  HapticsContext,
} from '@flare-engine/haptics';

// Native: inject the expo-haptics module. Web: inject navigator.vibrate.
// Neither is a dependency of this package — the platform module is passed in.
const provider =
  typeof navigator !== 'undefined' && 'vibrate' in navigator
    ? createWebVibrationProvider(navigator.vibrate.bind(navigator))
    : createExpoHapticsProvider(Haptics);

export function App() {
  return (
    <HapticsContext.Provider value={provider}>
      {/* ... */}
    </HapticsContext.Provider>
  );
}
```

```tsx
import { Button } from 'react-native';
import { useHaptics } from '@flare-engine/haptics';

function FireButton() {
  const haptics = useHaptics();
  return <Button title="Fire" onPress={() => haptics.impact('heavy')} />;
}
```

`HapticsContext` defaults to `NoopHapticsProvider`, so `useHaptics()` is always safe to call. `createWebVibrationProvider(undefined)` (no Vibration API) returns that same inert no-op, so web code needs no feature-detect.

## Providers

| Factory | Backend | Notes |
| --- | --- | --- |
| `createExpoHapticsProvider(expo)` | `expo-haptics` (injected) | `expo` is the structural `{ impactAsync, notificationAsync, selectionAsync }` shape; cue kinds map onto expo's string enums 1:1. Starts enabled. |
| `createWebVibrationProvider(vibrate?)` | Web Vibration API | `vibrate` is `navigator.vibrate` bound to `navigator`. Impact scales the buzz with intensity; each notification category has its own pulse pattern; selection is a short tick. Absent `vibrate` → inert no-op. |
| `NoopHapticsProvider` | none | Immutable, always disabled — the context default and the safe fallback. `setEnabled` is inert by design. |
| `createNoopHapticsProvider(enabled?)` | none | No-op cues but a **real** enabled gate, so a consumer's haptics toggle is unit-testable without a native backend. Defaults to disabled. |

## Other backends

Any SDK works through injection — the same pattern the Expo and Web providers use. Wrap its calls in the `impact` / `notification` / `selection` shape and hand them to the shared gate, so your adapter never re-implements the enabled logic. For a native `Vibration` (from `react-native`) or a Core Haptics bridge, mirror `createExpoHapticsProvider`: accept the module, forward the cues, start enabled.
