---
'@flare-engine/storage': patch
---

`saveSlot(name, data, header?)` takes an optional JSON-serialisable header, stored in the slot
envelope beside `data` and omitted when not given, so a header-less save writes the same string as
before and a save without one drops the slot's previous header; a header that `JSON.stringify`
rejects fails the save before anything is written. `listSlotHeaders()` returns one `SlotHeader<H>`
(`{ name, version, header }`) per slot from the envelope alone, running no migration and no
schema: a malformed or unreadable slot lists as `version: null, header: null` without failing the
others, and only a rejecting `adapter.keys()` rejects the call. `Storage` and `createStorage` gain
a second generic `H = unknown`, inferred from the new `parseHeader` option, a `Sanitizer<H>` run on
each stored header at list time to repair stale shapes (headers are not migrated). `loadSlot` and
`listSlots` are unchanged.
