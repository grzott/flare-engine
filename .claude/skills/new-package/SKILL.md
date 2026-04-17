---
name: new-package
description: Scaffold a new @flare/* package following the monorepo conventions
argument-hint: "[package-name] [layer-number]"
allowed-tools: Read, Write, Edit, Glob, Bash(mkdir:*), Bash(bun install:*), Bash(bun run build:*)
---

Scaffold a new `@flare/<package-name>` package in the Flare engine monorepo.

## Steps

1. Create directory `packages/<package-name>/`
2. Copy the structure from the nearest same-layer package as reference
3. Create `package.json` with:
   - `"name": "@flare/<package-name>"`
   - `"main": "./dist/index.cjs"`, `"module": "./dist/index.js"`, `"types": "./dist/index.d.ts"`
   - Only add dependencies that belong to layers **below** this package's layer
4. Create `tsconfig.json` extending `../../tsconfig.base.json`
5. Create `src/index.ts` with a named export placeholder
6. Create `tests/<package-name>.test.ts` with a placeholder test
7. Add the package to `turbo.json` pipeline if needed
8. Run `bun install` from repo root to link the workspace

## Layer dependency rule (downward only)
```
Layer 0: math, events          ← no @flare deps
Layer 1: core, ecs             ← can depend on layer 0
Layer 2: render, input, ...    ← can depend on layers 0-1
Layer 3: scene, animation, ... ← can depend on layers 0-2
Layer 4: react, engine         ← can depend on layers 0-3
```
