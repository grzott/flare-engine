---
'@flare-engine/input': patch
---

HYG5-PRE: document `GamepadSource.poll()`'s freshness contract. Per ADR-0004.

`poll()` now documents that it returns fresh objects on every call: an implementation must not
reuse or mutate a snapshot (or its `buttons`/`axes` arrays) it previously returned, and a caller
may retain a returned snapshot across frames. This was previously unstated. `createWebGamepadSource`
already behaved this way — every call allocates a new snapshot, a new buttons array and a new axes
array per connected pad — so this documents existing behaviour rather than changing it. It matters
now because `GamepadSource` is a public interface the docstring explicitly invites native adapter
authors to implement, and the contract binds every adapter written after the October 20 flip.
