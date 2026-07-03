# Monetization Strategy — 2026-07-02 (rev. 2)

> **Partially superseded 2026-07-03.** The services-model / no-paid-packages / FUNDING.yml-tip-jar
> verdict stands. But the license is now **Apache-2.0**, not MIT — every "keep it 100% MIT" / "no
> dual licensing" line here is superseded by the OSS-E2 relicense (road-to-oss §16). Moved to
> `_local/` by OSS-A0.

Companion to [oss-launch-audit-2026-07.md](oss-launch-audit-2026-07.md). Reframed after owner clarification: this is a small project by design — self-use first, RN-ecosystem contribution second, adoption welcome but not the business. The owner already makes his living building applications and websites on the engine.

## The verdict

**The business model already exists and is the right one: the engine is owned infrastructure for a one-person services practice, plus a public-good contribution.** Nothing in the precedent data argues for changing that — it argues *against* every alternative. Do not build paid products around the engine; keep it 100% MIT; let it compound as credibility, delivery speed, and inbound-lead generation for the app/website work that pays.

## Why the precedents support exactly this (verified 2026-07-02)

Even celebrated OSS engines earn almost nothing *as engines*: Godot's fund is €31,194/mo after a decade as the category flagship; Bevy's foundation ($16,950/mo) covers roughly one salary; PixiJS at ~45k stars raises ~$39k/yr; Ebitengine's author sees ~$49/mo; Tiled — 15 years old, universally used — funds its maintainer 2 days/week. The models that do make money are capital-backed adjacent products: Phaser Editor ($12/mo) exists because of a $2M Open Core Ventures investment on top of a decade-old user base; Rive raised $14M+ for its editor; W4 raised $15M for console ports. A solo dev who already bills at professional RN rates out-earns all of these per person by default. The engine's economic job is to make that billing faster, better, and easier to win — which it demonstrably does (PT in alpha, two production websites, a second game scaffold, all on one codebase family).

## What this means in practice

1. **Keep the OSS promise exactly as published** (MIT, no dual licensing, no paywalled packages). It was already the only viable path; the public commitments (blog/LinkedIn/dev.to/Reddit) make it free to keep and expensive to break.
2. **Engine work is funded by the practice, so prioritize engine work that serves the practice**: the headless/RN-free path (the websites consume the engine headless), the `dynamics` lift (makes the portfolio's "built with my 2D engine" claim true — that claim sells the practice), the Tier-0 live-tweak inspector (the owner's own productivity tool first, demo material second), templates and docs (they convert readers of the weekly posts into users, and users into inbound leads).
3. **Sponsors = tip jar, not a plan.** Add FUNDING.yml + GitHub Sponsors at the flip because it costs an afternoon; expect $0–300/mo for a niche engine (that is the verified norm) and spend no ongoing effort on it. Sponsorware/early-access is available later if an audience actually forms — the weekly blog cadence is the funnel that would feed it.
4. **Grants fit better than products at this scale**: the portfolio's own funding roadmap (PWGW games grant ~Oct 2026 call, Digital Dragons, OSS patronage) stacks on the practice without adding a product to maintain. PT shipping is the unlock for those, not engine revenue.
5. **Two dormant options, with explicit triggers, in priority order if the community ever materializes** (order-of-magnitude signal: multiple third-party shipped games, sustained inbound):
   - *Hosted services open-core* — real paid backends behind the already-shipped `leaderboards`/`achievements`/`analytics` interfaces on Cloudflare Workers/DO, GDevelop-style €5–10/mo. Matches existing infra skills; engine stays MIT.
   - *Paid tooling/editor* — not credible solo (every precedent was capital-backed); if the category ever proves out, an OCV-style open-core investment is the realistic vehicle, not a solo build.
6. **Guardrail**: client work should keep feeding the engine via the existing lift-with-strip discipline (PT → engine → Berek/page proved the loop). That's the compounding mechanism that makes the "small project" durable without ever needing it to be a business.
