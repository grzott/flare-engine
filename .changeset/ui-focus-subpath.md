---
'@flare-engine/ui': patch
---

`@flare-engine/ui/focus` is a new entry point that exports only the focus core —
`createFocusManager`, `createFocusKeyboardDriver` and their types (`FocusManager`, `FocusNode`,
`FocusKeyboardDriver`, `FocusKeyboardDriverOptions`, `FocusKeySource`). Its built output imports
neither `react` nor `react-native`, so a `bun test` or Node harness can drive focus without React
Native installed. The `.` entry still exports the same names and is unchanged.
