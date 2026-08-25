---
'@flare-engine/dynamics': minor
---

Export `BodyOptions`, `WorldOptions` and `isStatic` from the package barrel.

All three were already declared and emitted into `dist/index.d.mts`, but were
absent from the barrel's export list, so a TypeScript consumer could not write
`import type { BodyOptions } from '@flare-engine/dynamics'` and had no supported
way to test staticness — `static` is a `createBody` input, not a `Body` field, so
the only alternatives were `Parameters<typeof createBody>[0]` and an open-coded
`invMass === 0`.

The package's own row spec required exactly this surface (types `Body`,
`BodyOptions`, `World`, `WorldOptions`; values `createBody`, `isStatic`,
`createWorld`, `addBody`, `step`); the shipped 0.3.0 barrel carried six of the
nine names. Found by the first external consumer, `grzott-portfolio`, while
swapping its hand-rolled solver for this package.

Additive only — no existing export changes.
