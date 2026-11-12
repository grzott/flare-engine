---
"@flare-engine/devtools": patch
---

`DevtoolsConfig.enabledOnNative` was defaulted but never read, so `false` changed nothing. On a native platform, `enabledOnNative: false` now makes `DevtoolsHUD` render nothing and stops `DevtoolsProvider` from capturing snapshots; flipping it back re-subscribes capture. Web ignores the flag. `DevtoolsContextValue` gains an optional `enabled` field carrying the result (absent means enabled).
