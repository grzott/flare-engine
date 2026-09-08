---
'@flare-engine/tilemap': patch
---

PF-1b: settle four small published-surface findings in `tilemap` before the freeze. Per ADR-0004.

- `TileLayer.tiles` is now `Uint32Array`, not `number[]` (owner-decided). `Uint32Array`, not `Float32Array` — a 24-bit mantissa cannot hold Tiled's flip-bit GIDs (`0x80000000` and up). This is a **type** decision for bulk numeric data, matching the repo's own convention — not a measured perf change: there is no tilemap benchmark, and the SMI-to-double transition this avoids is V8-only, while Hermes (the primary RN target) already stores every `number[]` element boxed. `parseTiled` and `parseLDtk` both build it with `Uint32Array.from`/`new Uint32Array(n)`; `getTileAt`'s `?? 0` stays (unreachable at runtime — the caller's bounds check guarantees an in-range index — but still required by `noUncheckedIndexedAccess`, which types every typed-array read as `number | undefined`).
- `TileData` — an exported interface nothing in the repo constructed or read — is deleted, along with its barrel export.
- `getTileSourceRectInto(tileset, gid, out)` is added as the zero-alloc form of `getTileSourceRect`, which now delegates to it. `TilemapRenderer`'s per-tile draw loop switches from its own inlined copy of the same math to the shared `…Into` form via a reusable buffer.
- `parseTiled` now validates its input the same way `parseLDtk` already does (`typeof json === 'object'`, array/number checks) and throws `TilemapParseError` instead of a raw `TypeError` on garbage input.

<!-- symbols-ok: noUncheckedIndexedAccess -->
<!-- reason: a TypeScript compiler flag from tsconfig.base.json, not an exported symbol. It is
     named here because it is the reason getTileAt keeps its `?? 0` after the Uint32Array switch:
     under that flag a typed-array index read is still `number | undefined`. -->
