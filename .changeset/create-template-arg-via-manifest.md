---
'@flare-engine/create': patch
---

Internal refactor: the CLI's `--template` parser now validates through `isTemplateId` and builds its error message and help text from the keys of `TEMPLATES`, so the template ids are listed in one place. No behaviour or API change.
