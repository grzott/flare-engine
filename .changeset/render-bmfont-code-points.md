---
'@flare-engine/render': patch
---

`measureText` and `drawText` read a string by code point instead of by UTF-16 unit. A glyph whose
BMFont `id` is above `0xFFFF` (an emoji, a supplementary-plane CJK character) was never matched, so
it added no advance and queued no draw; it now does both. Strings made only of BMP characters
measure and draw as before.

Kerning for those ids is fixed with it. The kerning key was `first << 16 | second`, which for an id
above `0xFFFF` produced the same key as the pair sharing its low 16 bits: `getKerning(font, 0x1F600,
65)` returned the amount stored for `(0xF600, 65)`, and a font kerning both pairs kept only one of
them. The key is now `first * 0x200000 + second`.

One visible difference: the keys of `BitmapFont.kernings` changed encoding. `parseBMFontJSON` and
`getKerning` agree on the new one; code that builds or reads that map by hand with the old formula
needs the new one, or `getKerning`.
