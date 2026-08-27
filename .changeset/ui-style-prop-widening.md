---
"@flare-engine/ui": patch
---

Widen `style` from `ViewStyle` to `StyleProp<ViewStyle>` (and `TextStyle` to `StyleProp<TextStyle>` on `Label`) across all eight component prop interfaces in `@flare-engine/ui`. Source-compatible for every caller passing a plain object; only code that reads the prop type observes this change (e.g. wrapper components that forward a style array).
