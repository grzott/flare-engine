# @flare-engine/haptics

Typed `HapticsProvider` interface + `NoopHapticsProvider` + React context. Stub-only at 0.1.0; a concrete adapter (`@flare-engine/haptics-expo`, wrapping Expo Haptics) lands at 0.2.0.

## Install

```sh
bun add @flare-engine/haptics
```

## Usage

```tsx
import {
  HapticsContext,
  useHaptics,
  NoopHapticsProvider,
} from '@flare-engine/haptics';

export function App() {
  return (
    <HapticsContext.Provider value={NoopHapticsProvider}>
      {/* ... */}
    </HapticsContext.Provider>
  );
}
```

`useHaptics()` returns the provider; call `impact(style?)` for weapon / hit / bomb feel, `notification(type?)` for victory / error cues, and `selection()` for light UI ticks. The `isEnabled()` / `setEnabled(enabled)` gate lets the user's haptics setting and the reduced-motion gate (`@flare-engine/a11y`) live in one place — when disabled, the cue methods are no-ops. Swapping `NoopHapticsProvider` for a real adapter at 0.2.0 requires no consumer changes.

## Recipe — env-var-gated lazy load

When the 0.2.0 adapter lands, wrap it behind an env-var gate so CI / unit tests / dev builds without the native module fall back to `NoopHapticsProvider` and never touch the SDK. See the [Lazy-SDK adapter recipe](https://github.com/grzott/flare-engine/blob/main/.claude/skills/flare-tier2-stubs/SKILL.md#lazy-sdk-adapter-recipe) for the full pattern.
