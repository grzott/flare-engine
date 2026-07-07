---
"@flare-engine/storage": patch
---

storage: fix importJSON atomicity and runMigrations gap enforcement. `importJSON` now validates every entry is a string before calling `adapter.clear()`, so a corrupt payload leaves storage untouched. `runMigrations` now throws on version gaps in the migrations list and on a highest migration version that exceeds the target, matching the existing doc comment contract.
