# Pan Tvardowski

A vertical-scrolling shoot-em-up inspired by the Polish legend of **Pan Twardowski** — the alchemist who bargained with the Devil, served King Sigismund II Augustus at Wawel, and was exiled to the Moon. The canonical end-to-end showcase + integration smoke test for the [Flare engine](../../README.md).

`apps/pan-tvardowski` exercises every shipping `@flare-engine/*` package except `pathfinding` (post-launch) via at least one game mechanic. Free zones 1–3 replace the retired `apps/demo` as the canonical reference game. New-project scaffolds live in [`packages/create-flare-app`](../../packages/create-flare-app).

## Design docs

- Full build plan, story, bestiary, weapons, bosses, dialogue, localization keys, and publishing plan: [docs/plans/pan-tvardowski-build-plan.md](../../docs/plans/pan-tvardowski-build-plan.md)
- Folklore sources + due-diligence citations: [CREDITS.md](./CREDITS.md)

## Status

🟢 **M0–M9.6 + Bugfix-A + Bugfix-B bundles complete (2026-04-28).** All 8 zones playable end-to-end with main menu, save slots, settings, credits, codex, achievements, IAP shop + RevenueCat adapter, dialogue portraits, deep-links, screenshot capture, and Sentry-gated crash reporting. **354 tests green** (PT app), **288 localization keys** in PL+EN parity, BALANCE_FROZEN_AT = 2026-04-28. Remaining work for ship: store accounts, signing keys, store-page assets, EUIPO trademark filing, device smoke on iOS — see [docs/plans/release-readiness-checklist.md](../../docs/plans/release-readiness-checklist.md).

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
