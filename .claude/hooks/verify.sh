#!/usr/bin/env bash
# Gate script. Runs the full gate sequence below (lint, typecheck, test, build,
# typecheck:tests, test:scripts, check:deps, check:changeset, check:peers,
# check:bump, hook-guard, runner-loop, check:perf — the run_gate calls are the authoritative,
# order-accurate list). It only gates: since the 2026-11 PR workflow the agent
# commits on a claude/* branch, and the PR description carries the session
# record that SESSION_LOG.md used to hold.
#
# check:perf-freshness is deliberately NOT here. A cloud session cannot
# re-capture the perf lanes, so freshness is a release-time gate (release.yml
# and `bun run release`), batched for the workstation.
#
# Usage: bash .claude/hooks/verify.sh <engine|game|mixed>
#
# Exit codes:
#   0  -> all gates green
#   1  -> a gate failed (output trimmed and printed)
#   2  -> argument error or git not initialised

set -u

SCOPE="${1:-}"

case "$SCOPE" in
  engine|game|mixed) ;;
  *) echo "usage: verify.sh <engine|game|mixed>" >&2; exit 2;;
esac

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repo" >&2; exit 2; }
cd "$ROOT"

run_gate() {
  local name="$1"
  shift
  echo "==> $name"
  if ! "$@"; then
    echo ""
    echo "GATE FAILED: $name"
    exit 1
  fi
}

run_gate "lint"      bun run lint
run_gate "typecheck" bun run typecheck
run_gate "test"      bun run test

# Build only for engine + mixed (game apps don't always have a build script).
if [ "$SCOPE" != "game" ]; then
  run_gate "build" bun run build

  # `turbo typecheck` is per-package and src-only, so nothing type-checks the
  # files under packages/*/tests. The root tsconfig is the only config that
  # includes them.
  #
  # It runs AFTER build on purpose: a test importing a sibling by package name
  # (@flare-engine/render) resolves to that package's dist/*.d.mts, not its src.
  # Run before build and the probes measure the previous build.
  run_gate "typecheck:tests" bun run typecheck:tests
fi

# The repo's own tooling tests (risk classifier, gate, label sync, history scan).
run_gate "test:scripts" bun run test:scripts

# Guardrails: dependency/tier graph + changelog (changeset) coverage.
run_gate "deps"      bun run check:deps
run_gate "changeset" bun run check:changeset

# An undeclared transitive peer is a stranger's install failure, not ours —
# bun installs optional peers, npm/pnpm/yarn do not.
run_gate "peers"     bun run check:peers

# Versioning is lockstep, so one word in one changeset moves all 42 packages: a
# `minor` opens the next 0.x line, a `major` publishes 1.0.0. check:changeset
# gates coverage, never level. This gates level, and the only way through is an
# accepted ADR — deliberately not an env var, because a published major is not
# recoverable.
run_gate "bump"      bun run check:bump

# The contract suite for the sibling hook that keeps agents in the claude/* PR
# lane. It covers the documented bypasses (wrapper, eval, `git -C`, unnamed verbs).
run_gate "hook-guard" bash .claude/hooks/pre-bash-guard.test.sh

# The workstation runner's contract (scripts/runner/loop.sh) against a scripted stub.
run_gate "runner-loop" bash scripts/runner/loop.test.sh

# Perf counters (Track A). Engine + mixed only: a game-scope change cannot move an
# engine counter, and the gate needs built dists. `check:perf-bytes` runs in CI.
if [ "$SCOPE" != "game" ]; then
  run_gate "perf" bun run check:perf
fi

echo ""
echo "all gates green"
