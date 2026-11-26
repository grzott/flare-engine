---
'@flare-engine/render': patch
---

Announces ADR-0012 row 12 (#100). In 0.5.0, `BitmapFont.kernings` is keyed `first * 0x200000 + second` instead of `first << 16 | second`, and `measureText` and `drawText` read text by code point. That lets glyph ids above 0xFFFF (emoji, supplementary-plane CJK) measure, draw and kern; today they are skipped. A map built by `parseBMFontJSON` and read through `getKerning` is unaffected. Code that fills or reads `kernings` by hand with today's formula has to switch to the new key in 0.5.0. Code that doesn't switch finds no pairs from then on: text still draws, but without kerning, and nothing fails to compile. Nothing changes in this release; the JSDoc of `BitmapFont.kernings` carries the note.
