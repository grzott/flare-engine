---
"@flare-engine/input": patch
---

New `applyRemapInto(snapshot, table, out)`: the zero-alloc form of `applyRemap`. It writes the remapped snapshot into a caller-owned `out` (resizing its `buttons` / `axes` to the table and reusing their records) and returns it. `applyRemap` is unchanged and still returns a new snapshot each call.

`InputManager.pollGamepads` now remaps into one snapshot it keeps per remapped pad, sized when `setGamepadRemap` installs or replaces the table, instead of building a new snapshot, `buttons` array, button records and `axes` array for that pad on every poll. It also reads the remap map once per pad rather than twice. Pads without a remap are unaffected, and snapshots returned by a `GamepadSource` are still never mutated.

`GestureDetector` no longer copies the two touch points at the start of a pinch (the copies were never read), and `pointerDown` writes the press position into one vector it owns instead of allocating one per press. Emitted gesture events are unchanged.
