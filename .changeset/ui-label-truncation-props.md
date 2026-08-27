---
"@flare-engine/ui": patch
---

Add `numberOfLines`, `ellipsizeMode`, `adjustsFontSizeToFit`, `minimumFontScale` to `LabelProps` and forward them to the underlying RN `Text`. `ellipsizeMode` is typed via `TextProps['ellipsizeMode']` so it tracks the `react-native >=0.79.0` peer floor automatically. Omitting any prop preserves existing rendered output.
