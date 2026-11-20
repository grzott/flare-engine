---
'@flare-engine/ui': patch
---

`Button`, `Panel` and `Label` accept an optional `ref` prop and pass it to their root element.

`ButtonProps` and `PanelProps` gain `ref?: Ref<View>`; `LabelProps` gains `ref?: Ref<Text>`. `Panel` passes the ref to its root `View`, `Button` to its root `Pressable` (whose instance is a `View`), and `Label` to its root `Text`.

This is React 19's ref-as-a-prop, which the package's `react` peer range (`>=19.0.0`) already requires; there is no `forwardRef` wrapper. Omitting `ref` renders exactly as before.

<!-- Third-party names: React's Ref and forwardRef; React Native's View, Text and Pressable. -->
<!-- symbols-ok: Ref, forwardRef, View, Text, Pressable -->
