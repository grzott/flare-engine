---
'@flare-engine/progression': patch
---

Adds `createGameClock(config, state?)`: a 1440-minute game-day clock whose ordered segments each
run at their own real-seconds-per-game-hour rate, with `update(dt)` landing exactly on every
boundary it crosses, `advanceMinutes` / `skipTo` in game minutes, `pause` / `resume`,
`hold` / `release` (stop at the next phase boundary), `onSegmentChange` / `onPhaseChange`
callbacks, and a plain `serialize()` state that restores through the second argument.
