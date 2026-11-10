---
'@flare-engine/storage': patch
---

`createStorage` no longer writes a `__flare_version` key on `saveSlot`, and `createDocumentStore` no longer writes a `__flare_doc_version` key when it persists the document. Nothing in the package read either key: the version that drives migrations lives in each stored envelope, and those envelopes are unchanged, so existing data loads as before. Keys already present in a store are left in place, not deleted.

<!-- symbols-ok: __flare_version, __flare_doc_version -->
