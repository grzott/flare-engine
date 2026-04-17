# Flare Engine — Repo Conventions Discovered

## Biome Config

- `noNonNullAssertion` disabled — conflicts with TS `noUncheckedIndexedAccess`
- `useSingleVarDeclarator` disabled — Mat3 destructuring uses multi-var `const`
- `noBannedTypes` still active — use `// biome-ignore lint/complexity/noBannedTypes:` for generic handler casts in events
- Quote style: single quotes (biome auto-fixes double → single)

## PowerShell Pipeline Gotcha

- `bun run <script> 2>&1 | Select-Object` causes exit code 1 even when turbo reports all tasks successful
- Use `bun run <script> *>$null; echo $LASTEXITCODE` to get the real exit code

## Test Script in Scaffolds

- All 16 packages have `"test": "bun test"` — fails with exit code 1 when no test files exist
- Use `bunx turbo test --filter=@flare-engine/math --filter=@flare-engine/events` to test only implemented packages

## Size Budgets

- math: 23.6KB raw ESM, ~6KB gzip (spec says < 5KB gzip — 35 tree-shakeable easings push it slightly over)
- events: 2.1KB raw ESM, 621B gzip (spec says < 1KB — passes)
