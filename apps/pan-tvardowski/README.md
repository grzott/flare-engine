# Pan Tvardowski

A vertical-scrolling shoot-em-up inspired by the Polish legend of **Pan Twardowski** — the alchemist who bargained with the Devil, served King Sigismund II Augustus at Wawel, and was exiled to the Moon. The canonical showcase game for the [Flare engine](../../README.md).

**Not the engine demo.** [`apps/demo`](../demo) remains the minimal proof-of-concept + integration smoke test. `apps/pan-tvardowski` is the end-to-end showcase — every shipping `@flare-engine/*` package is exercised by at least one game mechanic.

## Design docs

- Full build plan, story, bestiary, weapons, bosses, dialogue, localization keys, and publishing plan: [docs/plans/pan-tvardowski-build-plan.md](../../docs/plans/pan-tvardowski-build-plan.md)
- Folklore sources + due-diligence citations: [CREDITS.md](./CREDITS.md)

## Status

📐 **Pre-production.** Design locked, implementation not started. Scaffolding lands at stage 11.11 of the engine build plan.

## Concept

- 8 zones (~38 min campaign), Polish-folklore themed (Kraków rooftops → Moon surface)
- 12 enemies, 4 mini-bosses, 8 bosses — all drawn from Polish mythology (Boruta, Baba Jaga, Bazyliszek, Mefistofeles, …)
- 4 weapons (Iskry, Piorun, Sól Święcona, Znak Pentagramu), 3 ships (Kogut Złoty, Alembik, Zwierciadło)
- PL + EN localization from day 1
- Shape-atlas visual style at 0.1.x (custom art post-launch)

## Art direction

**Shape atlas only** for 0.1.x — all entities composed of primitive Skia shapes (circle, polygon, star, polyline, gradient). No sprite art until post-launch. The entire visual brief lives in [`docs/plans/pan-tvardowski-build-plan.md`](../../docs/plans/pan-tvardowski-build-plan.md) §6.

## License

Game ships under [PolyForm Noncommercial 1.0.0](./LICENSE). Engine packages remain MIT.
