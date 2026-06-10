#!/usr/bin/env bash
# /close gate script. Runs lint -> typecheck -> test -> build, appends a block
# to SESSION_LOG.md, and emits paste-ready commit blocks based on git diff.
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

# ---- Append SESSION_LOG block ---------------------------------------------

# Pick next session number by counting existing blocks.
N=$(grep -c '^## Session ' "$LOG" 2>/dev/null || echo 0)
N=$((N + 1))

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
echo "Appended session #$N block to $LOG."

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
