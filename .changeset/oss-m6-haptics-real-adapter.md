---
"@flare-engine/haptics": minor
---

haptics ships concrete providers via injection, replacing the interface-only stub and the phantom `@flare-engine/haptics-expo`@0.2.0 promise.

- `createExpoHapticsProvider(expo)` over the structural `ExpoHapticsModule` shape (`{ impactAsync, notificationAsync, selectionAsync }`) — no `expo-haptics` dependency; cue kinds forward onto expo's string enums 1:1.
- `createWebVibrationProvider(vibrate?)` over structural `navigator.vibrate` (`WebVibrate`); impact scales the buzz with intensity, each notification category has a distinct pulse pattern, selection is a short tick. Absent `vibrate` returns the inert `NoopHapticsProvider`.
- `createNoopHapticsProvider(enabled?)` — a no-op provider with a REAL enabled gate, so a consumer's haptics toggle is unit-testable without a native backend. `NoopHapticsProvider` stays the immutable, inert context default.
