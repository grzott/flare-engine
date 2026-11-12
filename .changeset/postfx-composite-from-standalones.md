---
"@flare-engine/postfx": patch
---

`COMPOSITE_SKSL`'s weather branches (rain, sun-shaft, dark-vignette, clouds) are now built from the same source fragments as the standalone `WEATHER_RAIN_SKSL`, `WEATHER_SUN_SHAFT_SKSL`, `WEATHER_DARK_VIGNETTE_SKSL` and `WEATHER_CLOUDS_SKSL` shaders, so an edit to one effect reaches both. Before, the composite carried hand-kept copies.

The standalone `WEATHER_*_SKSL` strings are byte-identical to 0.4.11, as is every other standalone `*_SKSL` export; a test now pins them.

The text of `COMPOSITE_SKSL` changed; its uniforms, their order and its behaviour did not. The differences are three shader-local variable names in the sun-shaft and dark-vignette branches, now spelled as in the standalones; the rain branch declaring its aspect ratio before its rotation angle; and comments. It is meant to render identically. No test compiles SkSL, so that is still to be checked visually.
