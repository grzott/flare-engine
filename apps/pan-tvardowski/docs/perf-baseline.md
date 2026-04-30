# Pan Tvardowski — Performance Baseline

## Targets

| Device tier | Metric | Target |
|---|---|---|
| Galaxy A54 (mid-tier reference) | Cold-start TTI | ≤ 3000 ms |
| Galaxy A54 | Sustained frame rate | 60 fps stable |
| Entry-level Android | Minimum frame rate | 30 fps floor |
| Any | Resident memory | ≤ 250 MB |

## How to measure

- **Boot trace** — call `getBootTrace()` after `first-frame` fires; subtract adjacent timestamps to isolate each phase cost.
- **Android** — Android Studio CPU Profiler (Callstack Sample or System Trace); start recording before app launch, stop after first frame.
- **iOS** — Xcode Instruments > Time Profiler; use "App Launch" template.
- **Hermes timeline** — enable `hermes.enableSampledTraceToFile` in `metro.config.js`, open trace in `chrome://tracing`.

## Boot trace milestones

| Milestone | Recorded by | Measures |
|---|---|---|
| `boot-start` | `markBootStart()` in `App.tsx` module scope | Module evaluation complete |
| `providers-mounted` | `AppRoot` mount `useEffect` | React tree rendered, all `useMemo` services constructed |
| `save-loaded` | `boot.ts` after `loadSave()` | MMKV read + save-schema migration |
| `audio-ready` | `boot.ts` after `initAudio()` | Audio graph constructed, channels attached |
| `first-frame` | `GameView.onReady` callback | Skia surface up, engine context live |

## Known cost contributors

- **RN bridge init** — JS bundle parse + bridge handshake; largest single cost on cold start.
- **Skia surface creation** — `GameView` waits for the native Skia context before firing `onReady`; varies with GPU driver init time.
- **MMKV first-load** — synchronous file open on the JS thread; negligible on fast flash, visible on slower eMMC.
- **Asset atlas decode** — `loadSpriteAtlas` runs at `bootstrap()` time inside `onReady`; PNG decode cost is proportional to atlas size.
- **react-native-purchases boot** — SDK handshake with the store; runs inside `mountTier2Wiring` and is async, but the SDK's own internal init competes with bridge bandwidth.

## How to read the trace

```ts
import { getBootTrace } from './src/perf/cold-start';

const trace = getBootTrace();
for (let i = 1; i < trace.length; i++) {
  const prev = trace[i - 1];
  const cur = trace[i];
  if (prev && cur) {
    console.log(`${prev.name} → ${cur.name}: ${(cur.t - prev.t).toFixed(1)} ms`);
  }
}
// Example output:
// boot-start → providers-mounted: 312.4 ms
// providers-mounted → first-frame: 1840.2 ms
// first-frame → save-loaded: 48.7 ms
// save-loaded → audio-ready: 210.9 ms
```

## Post-rebrand worst-case (session #75)

### Design targets (frame-budget guards)

| Budget dimension | Limit | Source |
|---|---|---|
| Draw calls (`posQuery.count`) | 920 | `BUDGET_LIMITS.draws` in `src/fx/budget.ts` |
| Particle entities (`lifetimeQuery.count`) | 480 | `BUDGET_LIMITS.particles` in `src/fx/budget.ts` |
| Active post-fx passes | 3 | `BUDGET_LIMITS.postfx` in `src/fx/budget.ts` |

The limits are enforced at runtime via `recordBudget()` (console.warn on breach). The chromatic-aberration effect is registered in the chain with `enabled: false` so it does not consume an active-postfx slot at rest.

### FPS watchdog threshold rationale

The watchdog fires when the 180-frame rolling average drops below **55 fps**. Rationale:

- 60 fps is the stable target on mid-tier devices (Galaxy A54).
- A sustained 55 fps average indicates genuine GPU pressure, not a transient spike.
- The only action on first trigger is disabling the chromatic-aberration pass (the cheapest effect to drop and the only one disabled by default). Vignette, bloom, and grayscale-flash are not dropped automatically.
- The drop is sticky for the scene lifetime; `resetFpsRing()` clears the watchdog flag on each zone enter so the effect can re-enable if conditions improve across zones.

### Real-device measurements

| Device | Cold-start TTI | Sustained fps | Notes |
|---|---|---|---|
| Galaxy A54 / iPhone 12 | — | — | Pending real-device measurement (session #59) |
