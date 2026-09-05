#!/usr/bin/env bash
# /close gate script. Runs lint -> typecheck -> test -> build, upserts a block
# to SESSION_LOG.md (a same-day re-run of the same goal replaces that row's
# block rather than appending a duplicate), and emits paste-ready commit blocks
# based on git diff.
#
# Usage: bash .claude/hooks/verify.sh "<session goal>" "<scope: engine|game|mixed>" ["<frictions>"]
#
# The optional 3rd arg is a one-line frictions self-report from the closing
# agent (corr:N / deny:N / gate:N / fixup:N / drift:N — see /close skill).
# Defaults to "none".
#
# Batch mode: when .claude/.batch-baseline exists (written by /start batch),
# the block + commit list cover only paths changed since the previous row's
# close; the baseline refreshes after each append.
#
# Exit codes:
#   0  -> all gates green, SESSION_LOG appended, commit blocks emitted
#   1  -> gate failed (output trimmed and printed)
#   2  -> argument error or git not initialised

set -u

GOAL="${1:-}"
SCOPE="${2:-}"
FRICTIONS="${3:-none}"

if [ -z "$GOAL" ] || [ -z "$SCOPE" ]; then
  echo "usage: verify.sh \"<goal>\" \"<engine|game|mixed>\"" >&2
  exit 2
fi

case "$SCOPE" in
  engine|game|mixed) ;;
  *) echo "scope must be one of: engine, game, mixed" >&2; exit 2;;
esac

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repo" >&2; exit 2; }
cd "$ROOT"

LOG="SESSION_LOG.md"
DATE=$(date +%Y-%m-%d)

# ---- Gates -----------------------------------------------------------------

run_gate() {
  local name="$1"
  shift
  echo "==> $name"
  if ! "$@"; then
    echo ""
    echo "GATE FAILED: $name"
    echo "Fix the failure and re-run /close. No session block appended."
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
  # 236 files under packages/*/tests. The root tsconfig is the only config that
  # includes them, and until HYG9 no command invoked it.
  #
  # It runs AFTER build on purpose: a test importing a sibling by package name
  # (@flare-engine/render) resolves to that package's dist/*.d.mts, not its src.
  # Run before build and the probes measure the previous build.
  run_gate "typecheck:tests" bun run typecheck:tests
fi

# Guardrails: dependency/tier graph + changelog (changeset) coverage.
run_gate "deps"      bun run check:deps
run_gate "changeset" bun run check:changeset

# An undeclared transitive peer is a stranger's install failure, not ours —
# bun installs optional peers, npm/pnpm/yarn do not. This is the class XR-1 and
# XR-12 both were; the check existed and no gate ran it until HYG9.
run_gate "peers"     bun run check:peers

# Versioning is lockstep, so one word in one changeset moves all 42 packages: a
# `minor` opens 0.4.0 (reserved for the freeze cut), a `major` publishes 1.0.0.
# check:changeset gates coverage, never level. This gates level, and the only way
# through is an accepted ADR — deliberately not an env var, because a stale
# benchmark is recoverable and a published major is not.
run_gate "bump"      bun run check:bump

# The contract suite for the sibling hook that enforces "builders never run
# git add/commit/push". It covers four documented bypasses (wrapper, eval,
# `git -C`, unnamed verbs) and, until HYG9, was invoked by nothing — so a
# regression in the guard would have reopened the boundary silently.
run_gate "hook-guard" bash .claude/hooks/pre-bash-guard.test.sh

# Perf (Track A). Engine + mixed only: a game-scope row cannot move an engine
# counter, and both gates need built dists.
#
# `check:perf-bytes` is deliberately NOT here — it packs 41 packages (~60 s) and
# CI runs it on every push, so the cost lands where it is affordable.
#
# check:perf-freshness goes red when a row touches a measured package. That is
# the point (the numbers now describe older code), and the fix is a re-capture:
#   bun run bench  x5 from a clean tree -> bench:promote -> bench:md
# To close a row without re-capturing, `$env:FLARE_PERF_ALLOW_STALE=1` and say
# so in the session block.
if [ "$SCOPE" != "game" ]; then
  run_gate "perf"           bun run check:perf
  run_gate "perf-freshness" bun run check:perf-freshness
fi

# ---- Diff snapshot ---------------------------------------------------------

CHANGED=$(git status --porcelain | awk '{print $2}' | sort -u)

BASELINE_FILE=".claude/.batch-baseline"
ALL_CHANGED="$CHANGED"
if [ -f "$BASELINE_FILE" ]; then
  CHANGED=$(comm -13 <(sort -u "$BASELINE_FILE") <(printf '%s\n' "$ALL_CHANGED"))
fi

if [ -z "$CHANGED" ]; then
  echo "no changes in working tree — nothing to close"
  exit 1
fi

# ---- Upsert SESSION_LOG block ---------------------------------------------
#
# Idempotent per row: re-running the gate for the SAME goal on the SAME day
# REPLACES that row's trailing block instead of stacking a duplicate (the
# fix-loop friction — a builder's re-gate must not mint 215/216/217/218). A
# different goal, or a new day, appends a fresh incremented block.

LAST_HDR=$(grep -n '^## Session ' "$LOG" 2>/dev/null | tail -1)
REPLACE=0
if [ -n "$LAST_HDR" ]; then
  LAST_HDR_LINE=${LAST_HDR%%:*}
  LAST_GOAL=$(grep -F '**Goal:** ' "$LOG" | tail -1 | sed 's/\*\*Goal:\*\* //')
  LAST_DATE=$(grep '^## Session ' "$LOG" | tail -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  LAST_N=$(grep '^## Session ' "$LOG" | tail -1 | sed -E 's/^## Session ([0-9]+).*/\1/')
  if [ "$LAST_GOAL" = "$GOAL" ] && [ "$LAST_DATE" = "$DATE" ]; then
    REPLACE=1
  fi
fi

if [ "$REPLACE" -eq 1 ]; then
  N="$LAST_N"
  # Drop the trailing block (its blank separator + header through EOF),
  # keeping everything up to the previous block's closing '---'.
  head -n "$((LAST_HDR_LINE - 2))" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
else
  # Pick next session number by counting existing blocks.
  N=$(grep -c '^## Session ' "$LOG" 2>/dev/null || echo 0)
  N=$((N + 1))
fi

{
  echo ""
  echo "## Session $N — $DATE (scope: $SCOPE)"
  echo ""
  echo "**Goal:** $GOAL"
  echo ""
  echo "**Touched files**"
  while IFS= read -r f; do
    [ -n "$f" ] && echo "- \`$f\`"
  done <<< "$CHANGED"
  echo ""
  echo "**Gates**"
  echo "- lint: green"
  echo "- typecheck: green"
  echo "- test: green"
  [ "$SCOPE" != "game" ] && echo "- build: green"
  echo ""
  echo "**Frictions:** $FRICTIONS"
  echo ""
  echo "**Next:** see \`docs/plans/todo.md\`."
  echo ""
  echo "---"
} >> "$LOG"

if [ -f "$BASELINE_FILE" ]; then
  printf '%s\n' "$ALL_CHANGED" > "$BASELINE_FILE"
fi

echo ""
if [ "$REPLACE" -eq 1 ]; then
  echo "Upserted session #$N block in $LOG (same-day re-run of same goal — replaced, not duplicated)."
else
  echo "Appended session #$N block to $LOG."
fi

# ---- Emit commit blocks ----------------------------------------------------
#
# Single bundled commit by default. Builders may split manually before running
# the emitted block if logically multiple commits are warranted.

echo ""
echo "=== Paste-ready commit block ==="
echo ""
echo "\`\`\`bash"
echo "git add \\"
FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && FILES+=("$f")
done <<< "$CHANGED"
LAST=$((${#FILES[@]} - 1))
for i in "${!FILES[@]}"; do
  if [ "$i" -lt "$LAST" ]; then
    echo "  ${FILES[$i]} \\"
  else
    echo "  ${FILES[$i]}"
  fi
done
# Subject = first 60 chars of goal, lowercased.
SUBJECT=$(printf '%s' "$GOAL" | tr '[:upper:]' '[:lower:]' | cut -c1-60)
echo "git commit -m \"$SUBJECT\""
echo "\`\`\`"
echo ""
echo "Edit the subject + split commits before running if needed."
echo "Constraints: <=72 chars, no body, no Co-Authored-By trailer."

exit 0
