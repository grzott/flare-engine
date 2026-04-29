# Pan Tvardowski — Reference Deck

The canonical visual specification lives at
[`apps/pan-tvardowski/docs/visual-reference.md`](../../apps/pan-tvardowski/docs/visual-reference.md).
That document is the single source of truth for all hex values, dimensions, particle counts,
easing curves, and frame-budget caps.

## About this directory

`Pan Tvardowski - Visual Reference.html` is preserved here as a **visual companion only** —
rendered previews, mood boards, concept art, and folio layout. It is not the spec.
Do not propagate values from the HTML deck into code without consulting the canonical doc first.
The deck contains three confirmed errors (listed below) where the canonical doc overrides it.

## Known deck errors

- **Ship art orientation** — `uploads/player1.jpg`, `player2.jpg`, `player3.jpg` show ships
  pointing down or sideways. Code is correct: the live `kogut-zloty` triangle in
  `apps/pan-tvardowski/src/shape-catalogue.ts` points up. Do not "fix" code to match the art.

- **DrawIO rotations** — `uploads/ships-design.drawio` mini-boss values (`-90°`, `-180°`, `112°`)
  imply sideways hulls. Live shapes are correct; treat the drawio as a scratch reference only.

- **HP-bar hex** — Folio IX uses `#2a0810`, but the named token `--crimson-deep` is `#7A1322`.
  These are not the same value: `#2a0810` is the HP-bar gradient empty-anchor only;
  `#7A1322` is the brand `crimson-deep` for text, borders, and everything else.
  Both are intentional. Do not unify them.
