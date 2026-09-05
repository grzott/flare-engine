# Versioning and announcements

Source of truth for **what a version number means before the public flip**, and for **which
external posts have to change when the engine does**. Referenced from `AGENTS.md`; the enforcement
half is `scripts/check-bump-level.mjs` and `docs/design/adr-0000-template.md`.

## The posture (owner decision, 2026-09-05)

The scope publishes `restricted` (`.changeset/config.json` → `"access": "restricted"`). There are
**no public consumers**: the only two are Pan Tvardowski and the portfolio, both owner-operated.
Until the public flip, that has a consequence worth stating plainly:

> **A breaking change costs a migration we control, not a stranger's build.** So `0.x` minors are
> deliberately unblocked pre-publish. We take the correct engineering change and let the version
> number follow, rather than contorting the engine to protect a compatibility promise nobody is
> relying on yet.

This is *not* a licence to skip the decision. `check:bump` still refuses any changeset above
`patch` without an accepted ADR — the point is that the answer to that decision is allowed to be
"yes" much more often before the flip than after it. After the flip the same gate stays, and the
calculus inverts: a break then costs strangers their build.

## What this means for announced version numbers

Version numbers stated in public posts are **provisional until the flip**. The engine has already
absorbed more pre-launch correction than originally forecast — that is normal for a pre-1.0
project, and it is better to renumber a post than to ship a worse engine to protect a number.

**Posts must therefore say what they depend on, not just what the number is.** Every post naming a
Flare version carries the qualifier that the final published version depends on the changes the
engine still needs. That sentence is what makes a later renumbering an update rather than a
correction.

### Obligation when an above-`patch` change lands

An accepted ADR with `Consumer impact: breaking` (or any minor/major cut) creates a **posting
obligation**, not only a changelog entry:

1. **`flare-engine-page`** (`flareengine.dev`) — any page or post stating a version, a peer
   requirement, or a platform claim. See that repo's `AGENTS.md`.
2. **`grzott-portfolio`** — the announcement posts. *Not present in this workspace as of
   2026-09-05*; the owner maintains it separately, so this file records the obligation and the
   text has to be carried over by hand.
3. This file, if the posture itself changes.

Record the obligation on the row in `todo.md` when the ADR is accepted, so it is not discovered at
freeze time.

## Reserved numbers

- **`0.4.0` is the freeze/launch cut.** 64 references across 12 planning documents pin it
  (roadmap, flip-runbook, manual-test-protocol, road-to-oss, `AGENTS.md`…), and a prior sweep
  already moved `0.3.0` → `0.4.0` once. Land pre-freeze minors as **unreleased changesets that ride
  into `0.4.0`** rather than cutting a separate release, unless a consumer genuinely needs the
  change earlier — in which case the references get swept again, deliberately.
- **`1.0.0` is the public launch**, and under lockstep any `major` reaches it across all 42
  packages at once. It is never a routine cut.

## Worked example — ADR-0002

`@flare-engine/react` moved from Reanimated's deprecated `runOnUI` to `scheduleOnUI` from
`react-native-worklets`, raising the peer floor to Reanimated 4 and **ending old-architecture
support**. Pre-flip, that decision was cheap: no public consumer existed, every
`create-flare-app` template already shipped both packages at the required versions, and the claim
being dropped had never been verifiable (no scaffolder template can build an old-architecture app).
Post-flip the same change would be a 1.0-class event needing a deprecation window.
