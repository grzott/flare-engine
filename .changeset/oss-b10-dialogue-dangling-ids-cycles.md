---
"@flare-engine/dialogue": minor
---

dialogue: dangling id diagnostics + cycle protection.

Adds `DialogueError` (typed error class with `code`, `nodeId`, `missingId`, `chain` fields) and `DialogueErrorCode` union type exported from the package. An optional `onError` hook on `DialogueRunnerOptions` receives a `DialogueError` when a transition targets a node id that does not exist in the graph; without the hook a `console.warn` is logged naming the graph, missing id, and source node — both paths end the conversation as before.

The recursive `processNode`/`processBranch`/`processAction` stack is replaced with a single iterative `run()` loop with a 1 000-step budget. A content-author cycle (`A→B→A` branch loop) now throws a typed `DialogueError` with `code: 'cycle'` and the last 12 visited node ids in `chain`, instead of overflowing the call stack with a `RangeError`.

All pre-existing runner tests remain green; three new tests cover the `onError` hook, the default `console.warn` fallback, and the cycle-throws-`DialogueError` contract.
