---
'@flare-engine/react': patch
---

Native `GameView` now binds a postfx pass's image children: a pass whose `children` is non-empty
(`createColorGradingLut`), and every pass before it, renders as a nested `<Shader>` chain on a
`<Rect>` with the scene texture and each child bound positionally as `<ImageShader>`s, while later
child-free passes stay `<RuntimeShader>` image filters — so the color-grading LUT pass grades on
device instead of being dropped by RN-Skia's single-child `<RuntimeShader>` filter. A chain with no
children renders the same `<Image>` tree as before.
