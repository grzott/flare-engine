<!-- Thanks for contributing to Flare! Keep the subject as a Conventional Commit,
     e.g. `feat(math): add Vec2.lerp` (≤72 chars, enforced by commitlint). -->

## Summary

<!-- What does this change and why? Link any related issue/discussion. -->

## Gate checklist

- [ ] `bun run lint` clean (Biome)
- [ ] `bun run typecheck` clean
- [ ] `bun test` green — new behavior and edge cases (`NaN`, `Infinity`, zero, negative) covered
- [ ] `bun run build` green (verifies the full dependency chain)
- [ ] `docs/design/api-specs.md` + the package README updated if the public API moved
- [ ] Changeset added for user-facing changes (`bun changeset`)

## Repo rules

- [ ] No `any`, no `as any`, no `@ts-ignore`; named exports only; `import type` for type-only imports
- [ ] Hot paths (`update()` / `render()`) stay zero-alloc — no `new` in the loop; `out`-param form where a value is consumed per frame
- [ ] Dependencies flow downward only (layer N imports only from layer < N)
