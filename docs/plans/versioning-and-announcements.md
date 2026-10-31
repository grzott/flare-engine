# Versioning and announcements

Source of truth for **what a version number means now that the packages are public**, how much each
package promises, how a public symbol is retired, and **which external posts have to change when the
engine does**. Referenced from `AGENTS.md`; the enforcement half is `scripts/check-bump-level.mjs` and
`docs/design/adr-0000-template.md`.

## The posture (post-flip, 2026-10-30)

The repo and all 42 `@flare-engine/*` packages have been public since 2026-10-26. Anyone can install
any version, so a breaking change now costs a stranger their build, not a migration we control.

- **`patch` is the default** and covers bug fixes, including ones that change observable behaviour.
- **Breaking changes batch into the next planned minor** (`0.5.0`), each behind an accepted ADR and
  the deprecation window below. Under lockstep that minor moves all 42 packages at once.
- **ADRs are for breaking changes only** — an exported symbol removed or changed, a peer floor raised,
  a documented contract changed. `check:bump` still refuses any above-`patch` changeset without one.

The pre-flip posture (2026-09-05 → 2026-10-26) deliberately unblocked minors because the only
consumers were owner-operated. It ended at the flip; ADR-0002 below is its worked example.

## Deprecation policy

A public symbol is never removed in the release that first warns about it:

1. In a `patch`, mark it `@deprecated` in JSDoc, naming its replacement. The changeset says so.
2. Remove it no earlier than the next minor. The removal's changeset and ADR name it.

A peer-floor raise follows the same shape: announce the new floor in a `patch` changeset first, raise
it in the next minor.

## Stability tiers

How much each package promises. **Stable** — used by at least one owner-operated consumer (Pan
Tvardowski, flare-engine-page, grzott-portfolio, or a `create` template) and covered by tests; its
public API changes only through the deprecation policy. **Beta** — tested, no consumer yet; it may
change in any minor. **Experimental** — an interface with Noop/in-memory implementations and no
platform adapter yet; the interface itself may change when the first real adapter lands.

Consumers were read from each consumer's `package.json` and source imports on 2026-10-30.

| Tier | Packages |
|---|---|
| **Stable** (38) | a11y, animation, assets, audio, cli, core, create, debug, deep-links, devtools, dialogue, dynamics, ecs, engine, errors, events, iap, iap-revenuecat, input, localization, math, particles, pathfinding, physics, postfx, progression, react, render, render-web, scene, shapes, share, simulation, storage, testing, tilemap, ui, ui-shop |
| **Beta** (1) | haptics |
| **Experimental** (3) | achievements, analytics, leaderboards |

`create` has no importing consumer by nature; it is stable because the owner's manual test window
exercised it end to end. A package moves tiers by editing this table in the same change that earns it.

## Reserved numbers

- **`0.4.x`** — the current line; patch-only.
- **`0.5.0`** — the next planned minor. It batches the breaking changes held back during `0.4.x`
  and is cut under an accepted ADR.
- **`1.0.0`** — the API-stability milestone. Its criteria come in a future ADR.

## Obligation when an above-`patch` change lands

An accepted ADR with `Consumer impact: breaking` (or any minor/major cut) creates a **posting
obligation**, not only a changelog entry:

1. **`flare-engine-page`** (`flareengine.dev`) — any page or post stating a version, a peer
   requirement, or a platform claim. See that repo's `AGENTS.md`.
2. **`grzott-portfolio`** — the announcement posts. The owner maintains it separately, so this file
   records the obligation and the text has to be carried over by hand.
3. This file, if the posture itself changes.

Record the obligation on the work item when the ADR is accepted, so it is not discovered at release
time.

## Worked example — ADR-0002 (pre-flip)

`@flare-engine/react` moved from Reanimated's deprecated `runOnUI` to `scheduleOnUI` from
`react-native-worklets`, raising the peer floor to Reanimated 4 and **ending old-architecture
support**. Pre-flip, that decision was cheap: no public consumer existed, every
`create-flare-app` template already shipped both packages at the required versions, and the claim
being dropped had never been verifiable (no scaffolder template can build an old-architecture app).
Post-flip the same change would follow the deprecation policy above and land in a planned minor.
