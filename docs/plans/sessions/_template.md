# Session row template

Copy this shape when drafting rows in [../sessions.md](../sessions.md).

## Field conventions

| Field | Format | Notes |
|-------|--------|-------|
| `#` | integer | Monotonic per repo. Never reused. Never renumbered. |
| `status` | `pending` \| `in_progress` \| `done` \| `blocked` | Lowercase. No custom values. |
| `scope` | `[engine]` \| `[game]` \| `[mixed]` | Exactly one tag. `[mixed]` means an engine capability is blocking a game milestone and they ship together. |
| `goal` | imperative sentence, ≤ 80 chars | e.g. "wire localization ICU plurals into PT HUD score readout" |
| `touched paths` | repo-root-relative, comma-separated | Globs allowed (`packages/scene/**`). No wildcards that span the repo (`**/*.ts`). |
| `gates` | condensed gate set | e.g. `lint, typecheck, test (+2), build, size≤6KB` |
| `target commits` | int or range | Matches the concern split — `feat+test+docs` = 3; `feat+fix+test+docs+chore` = 5. |
| `depends on` | `#N` references or `—` | List prior session ids that must be `done` first. |
| `opened` | `YYYY-MM-DD` | Stamped by `/session-start`. Blank while `pending`. |
| `closed` | `YYYY-MM-DD` | Stamped by `/session-close`. Blank until `done`. |

## Example rows

```
| 1 | pending | [engine]  | add size-budget CI check to turbo test pipeline        | scripts/check-size.ts, turbo.json                  | lint, typecheck, test (+1)             | 2 | —   | — | — |
| 2 | pending | [game]    | PT zone 4 scene + 3 enemy types + deterministic tests   | apps/pan-tvardowski/src/scenes/zone-4.ts, src/enemies/*.ts, tests/zone-4.test.ts | typecheck, lint, test (+8), device-smoke | 4 | —   | — | — |
| 3 | pending | [mixed]   | extend @flare-engine/ui HUDBar with icon slot + use in PT | packages/ui/src/hud-bar.ts, apps/pan-tvardowski/src/hud/*.ts | lint, typecheck, test (+3), build, device-smoke | 5 | #1  | — | — |
```

## Anti-patterns

- Session that says "finish the game" — reject, break into milestone → milestone sessions.
- Session without a testable assertion — reject, route to `architect` or `engine-researcher` instead.
- Session spanning > 4 packages — reject, break along layer boundaries.
- Session with `gates: none` — reject, every session has at least lint + typecheck.
- `touched paths` that include `**/*.ts` — reject, too broad for diff-audit discipline.
