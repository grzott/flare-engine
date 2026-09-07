# ADR-0000: <short decision, stated as a decision>

- **Status**: Proposed <!-- Proposed | Accepted | Superseded by ADR-NNNN -->
- **Date**: YYYY-MM-DD
- **Consumer impact**: none | additive | behaviour-change | breaking
- **Release level**: patch | minor | major

> This file is the template. Copy it to `adr-NNNN-<slug>.md`, do not edit it in place.
> `ADR-0000` is reserved and is never an authorising ADR — `check:bump` will not accept a
> citation of it, because the template's `Status` is `Proposed` by construction.

## When an ADR is required

**Always, before a `minor` or `major` changeset lands.** `check:bump` enforces exactly this: it
refuses any pending changeset above `patch` unless the changeset body cites an `ADR-NNNN` that
exists here with `Status: Accepted`. Versioning is lockstep (`.changeset/config.json` → `fixed`), so
one word in one changeset moves all 42 packages — a `minor` opens `0.4.0`, a `major` publishes
`1.0.0`, and npm does not take a publish back.

**Also — and the gate cannot see these — for any consumer-observable behaviour change that ships as
a `patch`.** Level is a proxy for risk, not risk itself. Flipping a boundary comparison from `<=` to
`<` in a collision predicate is a `patch` by semver and can still change what a consumer's game
does on screen. If a reasonable consumer could be surprised after `bun update`, write the ADR even
though nothing will stop you.

An ADR is *not* required for: bug fixes that restore documented behaviour, additive APIs that
cannot change an existing call's result, docs, tests, tooling, or performance work that leaves
observable behaviour identical.

## Context

What is true today that forces a decision. Prefer measurements and `file:line` over assertion — the
value of an ADR is that a reader six months out can check whether the premise still holds.

**If the decision came out of an audit, do not inherit the finding's prose.** A finding's Impact
paragraph and severity are the finder's argument, and its Verifier corrections may contradict them or
be silent on the part you are about to repeat. Re-verify against HEAD and write what you confirmed.
ADR-0004 shipped a claim about which input layout a bug affected that was simply wrong, borrowed from
a finding, and it was caught in review rather than by anyone reading the ADR — the consumer-facing
`Consumer impact` section is exactly where a borrowed overstatement does the most damage.

## Decision

The decision, in the active voice. One paragraph.

## Consumer impact

The section the release gate exists for. Be concrete:

- **Who breaks.** Which consumers, on which versions, doing what.
- **What they see.** Compile error, runtime throw, silently different behaviour — the last is the
  one that deserves the most words, because nothing surfaces it for them.
- **Migration.** The exact edit a consumer makes. If there isn't one, say so plainly.
- **Why now.** Particularly if this lands near a freeze; see `docs/plans/roadmap.md`.

## Alternatives considered

What else was on the table and why it lost. An ADR with no rejected alternative is usually a
decision that was never really made.

## What would reverse this

The conditions that should reopen it. Write them as things that could be *observed*, not as
feelings — and when one resolves, strike it through and record the evidence rather than deleting
it, so the reasoning stays auditable.
