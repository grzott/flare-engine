# Flare Engine — Tooling Decisions

> Last updated: 2026-04-15

---

## Summary

| Aspect        | Choice                                | Alternative considered  | Why chosen                                                      |
| ------------- | ------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| Runtime + PM  | **Bun**                               | Node + pnpm             | Faster install/test, built-in test runner, TypeScript-native    |
| Monorepo      | **Turborepo**                         | Nx, Bun workspaces only | Simple, fast, works with Bun. 16+ packages needs orchestration. |
| Lint + Format | **Biome**                             | ESLint + Prettier       | Single Rust binary, ~100x faster, lint+format in one tool       |
| Commits       | **Conventional Commits** (commitlint) | No enforcement          | Clean changelogs, semantic versioning automation                |
| Versioning    | **Changesets** (SemVer)               | semantic-release        | Manual control over coordinated multi-package releases          |
| Build         | **tsup**                              | Bun bundler, rollup     | Mature dual CJS+ESM, .d.ts. Re-evaluate Bun bundler later.      |
| Testing       | **Bun test**                          | Vitest                  | Zero-config, fast, built into runtime. Enough for pure TS.      |
| CI            | **GitHub Actions**                    | —                       | Standard, free for OSS                                          |
| Git hooks     | **Husky** + lint-staged               | simple-git-hooks        | Ecosystem standard, reliable                                    |

---

## Commit Message Rules

| Rule              | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Format            | `<type>(<scope>): <description>`                                            |
| Types             | feat, fix, perf, refactor, test, docs, build, ci, chore                     |
| Scope             | Package name (optional): `feat(math): add Vec2.lerp`                        |
| Max header length | 72 chars                                                                    |
| Emoji             | **Forbidden** in subject line                                               |
| Body              | Optional. Use for breaking changes or complex context.                      |
| Breaking changes  | `feat(ecs)!: rename World.add to World.spawn` or `BREAKING CHANGE:` in body |

Examples:

```
feat(math): add Vec2.lerp and Vec2.slerp
fix(render): prevent double-draw on Camera.shake
perf(ecs): use bitmask for archetype queries
refactor(core): extract ScreenManager from GameLoop
test(physics): add AABB vs Circle edge cases
docs: add getting started guide
build: upgrade tsup to v9
ci: add release workflow
chore: remove unused .gitkeep files
```

---

## Biome Configuration

```jsonc
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "quoteStyle": "single",
  },
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedImports": "error" },
      "style": { "useConsistentArrayType": "error" },
    },
  },
  "organizeImports": { "enabled": true },
}
```

---

## Turborepo Pipeline

```jsonc
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
  },
}
```

---

## Changesets Configuration

- **Access:** public (npm)
- **Base branch:** main
- **Internal deps:** patch (updating a dep bumps the consumer's patch)
- **Independent versioning:** each package has its own version
- **Changelog:** `@changesets/changelog-github` format

---

## TypeScript Configuration

Base (`tsconfig.base.json`):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
  },
}
```

Each package extends base:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
  },
  "include": ["src"],
}
```
